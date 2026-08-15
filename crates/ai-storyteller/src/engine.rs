use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde::Deserialize;

use uuid::Uuid;

use crate::agents::{self, Agent};
use crate::combat::{self, CombatOutcome, CombatState};
use crate::error::AppResult;
use crate::memory::MemoryManager;
use crate::modes;
use crate::npc;
use crate::providers::HttpProvider;
use crate::security::cot::extract_chain_of_thought;
use crate::security::json::parse_model_json;
use crate::security::path::resolve_save_file;
use crate::types::{
    Achievement, Action, ActionKind, AgentResponse, AgentRole, ChatMessage, ChatOptions, ChatRole, EconomyItemType,
    GameConfig, GameMode, InventoryItem, InventoryItemType, LiveRelationship, PlotPoint, PlotStatus,
    ProviderFactoryConfig, Quest, QuestStatus, SaveData, SaveSummary, SceneState, TimePeriod, TurnRecord, TurnResult,
};

const IDLE: &str = "<WAIT>";
const IDLE_DESC: &str = "玩家静静地待在原地，观察着时间的流逝和周围的变化。";

pub struct GameEngine {
    config: GameConfig,
    provider_cfg: ProviderFactoryConfig,
    providers: Vec<HttpProvider>,
    state: SceneState,
    save_root: PathBuf,
    memory: MemoryManager,
    turn_count: u32,
    rulebook: String,
    unlocked: HashSet<String>,
    last_action: Instant,
    uses_tavern_schedule: bool,
}

impl GameEngine {
    pub fn new(
        config: GameConfig,
        provider_cfg: ProviderFactoryConfig,
        data_path: PathBuf,
        memory_db: &str,
        session_id: String,
        initial: Option<SceneState>,
    ) -> AppResult<Self> {
        let providers = crate::providers::build_all(&provider_cfg);
        let memory = MemoryManager::new(memory_db, session_id, config.memory_max_context_chars)?;
        let seeded = initial.is_none();
        let mut engine = Self {
            config,
            provider_cfg,
            providers,
            state: initial.unwrap_or_else(SceneState::default_opening),
            save_root: data_path,
            memory,
            turn_count: 0,
            rulebook: String::new(),
            unlocked: HashSet::new(),
            last_action: Instant::now(),
            uses_tavern_schedule: false,
        };
        if seeded {
            engine.apply_mode_template(None);
        }
        Ok(engine)
    }

    pub fn config(&self) -> &GameConfig {
        &self.config
    }

    pub fn set_config(&mut self, config: GameConfig) {
        self.config = config;
    }

    pub fn apply_mode_template(&mut self, template_id: Option<&str>) {
        self.reset();
        let seed = modes::resolve_seed(self.config.mode, template_id);
        modes::apply_seed(&mut self.state, seed);
        self.uses_tavern_schedule = !modes::tavern_profiles(seed).is_empty();
        self.sync_schedules();
        self.state.relationships = npc::seed_relationships(
            &self.state.present_npcs,
            &self.state.player_state.name,
            self.uses_tavern_schedule,
        );
        self.init_combat_if_needed();
        self.touch();
    }

    fn init_combat_if_needed(&mut self) {
        if self.config.mode == GameMode::AiBattle {
            let player = self.state.player_state.name.clone();
            self.state.combat = Some(CombatState::fresh(&player, "灰刃"));
            if let Some(npc) = self.state.present_npcs.iter_mut().find(|n| n.id == "opponent") {
                npc.health = Some(30);
            }
        } else {
            self.state.combat = None;
        }
    }

    fn apply_battle_round(&mut self, player_input: &str, responses: &[AgentResponse]) -> Option<String> {
        if self.config.mode != GameMode::AiBattle {
            return None;
        }
        let combat = self.state.combat.as_mut()?;
        if combat.outcome != CombatOutcome::Ongoing {
            return Some(combat.last_summary.clone());
        }
        let player_act = combat::parse_player_action(player_input);
        let foe_text = responses
            .iter()
            .find(|r| r.from == AgentRole::NpcDirector)
            .map(|r| r.content.as_str())
            .unwrap_or("进攻");
        let foe_act = combat::parse_foe_action(foe_text);
        let report = combat::resolve(combat, player_act, foe_act);
        self.state.player_state.health = combat.player.hp;
        if let Some(npc) = self.state.present_npcs.iter_mut().find(|n| n.id == "opponent") {
            npc.health = Some(combat.foe.hp);
        }
        Some(report.summary)
    }

    pub fn should_auto_tick(&self) -> bool {
        self.config.auto_world_tick
            && self.last_action.elapsed().as_secs() >= u64::from(self.config.idle_timeout.max(10))
    }

    fn touch(&mut self) {
        self.last_action = Instant::now();
    }

    fn sync_schedules(&mut self) {
        if self.uses_tavern_schedule {
            self.state.present_npcs = npc::snapshot_cast(npc::TAVERN_CAST, self.state.world_time.hour);
        }
    }

    fn extra_for(&self, role: AgentRole) -> String {
        match role {
            AgentRole::Narrator => {
                let mut extra = modes::narrator_extra(self.config.mode).to_string();
                if let Some(c) = &self.state.combat {
                    extra.push_str("\n必须按战斗结算描写伤害与胜负，不要改写 HP 数字。\n");
                    extra.push_str(&c.last_summary);
                }
                if let Some(end) = &self.state.ending {
                    extra.push_str("\n旅程已有结局，收束叙事，不要再开新主线：");
                    extra.push_str(end);
                }
                extra
            }
            AgentRole::NpcDirector if self.config.mode == GameMode::AiBattle => modes::opponent_extra().into(),
            AgentRole::RuleArbiter if !self.rulebook.is_empty() => format!("规则书：\n{}", self.rulebook),
            _ => String::new(),
        }
    }

    fn build_context(&self, query: &str) -> String {
        let mut ctx = self.state.context_summary();
        ctx["mode"] = serde_json::json!(self.config.mode);
        ctx["npcSchedule"] = serde_json::json!(npc::context_note(
            &self.state.present_npcs,
            self.state.world_time.hour,
            self.state.world_time.period,
            &self.state.relationships,
        ));
        let mem = self.memory.context_snippet(query);
        if !mem.is_empty() {
            ctx["memories"] = serde_json::Value::String(mem);
        }
        ctx.to_string()
    }

    pub fn state(&self) -> &SceneState {
        &self.state
    }

    pub fn turn_count(&self) -> u32 {
        self.turn_count
    }

    pub fn set_rulebook(&mut self, text: String) {
        self.rulebook = text;
    }

    pub fn memory(&self) -> &MemoryManager {
        &self.memory
    }

    pub fn memory_mut(&mut self) -> &mut MemoryManager {
        &mut self.memory
    }

    fn provider_for(&self, role: AgentRole) -> &HttpProvider {
        let kind = self
            .provider_cfg
            .agent_overrides
            .get(&role)
            .map(|o| o.provider_type)
            .unwrap_or(self.provider_cfg.default_provider);
        self.providers
            .iter()
            .find(|p| p.kind() == kind)
            .or_else(|| self.providers.iter().find(|p| p.kind() == self.provider_cfg.default_provider))
            .or_else(|| self.providers.first())
            .expect("at least one provider")
    }

    fn model_for(&self, role: AgentRole) -> Option<String> {
        self.provider_cfg.agent_overrides.get(&role).and_then(|o| o.model.clone())
    }

    pub fn set_provider_config(&mut self, cfg: ProviderFactoryConfig) {
        self.providers = crate::providers::build_all(&cfg);
        self.provider_cfg = cfg;
    }

    pub async fn process_turn(&mut self, player_input: &str) -> AppResult<TurnResult> {
        let (actual, mut context_s, mut responses) = self.begin_turn(player_input).await;
        if let Some(summary) = self.apply_battle_round(&actual, &responses) {
            context_s.push_str("\n【战斗结算，叙事必须遵守】");
            context_s.push_str(&summary);
        }
        let narrator_p = self.provider_for(AgentRole::Narrator).clone();
        let narrator_m = self.model_for(AgentRole::Narrator);
        let narrative_resp = agents::narrate(
            &narrator_p,
            narrator_m,
            &actual,
            &context_s,
            &responses,
            self.extra_for(AgentRole::Narrator),
        )
        .await?;
        let narrative = narrative_resp.content.clone();
        responses.push(narrative_resp);
        self.finish_turn(&actual, &narrative, &context_s, responses).await
    }

    pub async fn process_turn_stream<F>(&mut self, player_input: &str, mut emit: F) -> AppResult<TurnResult>
    where
        F: FnMut(serde_json::Value),
    {
        let (actual, mut context_s, mut responses) = self.begin_turn(player_input).await;
        if let Some(summary) = self.apply_battle_round(&actual, &responses) {
            context_s.push_str("\n【战斗结算，叙事必须遵守】");
            context_s.push_str(&summary);
            emit(serde_json::json!({ "type": "combat", "summary": summary, "combat": self.state.combat }));
        }
        emit(serde_json::json!({ "type": "analysis_complete", "consultedAgents": responses.iter().map(|r| r.from).collect::<Vec<_>>() }));
        for resp in &responses {
            emit(serde_json::json!({ "type": "agent", "role": resp.from, "content": resp.content }));
        }
        let narrator_p = self.provider_for(AgentRole::Narrator).clone();
        let narrator_m = self.model_for(AgentRole::Narrator);
        let consult_ctx = if responses.is_empty() {
            String::new()
        } else {
            let joined = responses
                .iter()
                .map(|r| format!("【{}】：{}", r.from.as_str(), r.content))
                .collect::<Vec<_>>()
                .join("\n\n");
            format!("\n\n其他说书人的意见：\n{joined}")
        };
        let narrative_resp = Agent::new(AgentRole::Narrator, &narrator_p, narrator_m)
            .with_extra(self.extra_for(AgentRole::Narrator))
            .process_stream(&format!("{actual}{consult_ctx}"), &context_s, |delta| {
                emit(serde_json::json!({ "type": "chunk", "content": delta }));
            })
            .await?;
        let narrative = narrative_resp.content.clone();
        responses.push(narrative_resp);
        let result = self.finish_turn(&actual, &narrative, &context_s, responses).await?;
        emit(serde_json::json!({ "type": "done", "full": result.narrative, "agentResponses": result.agent_details }));
        Ok(result)
    }

    async fn begin_turn(&mut self, player_input: &str) -> (String, String, Vec<AgentResponse>) {
        self.touch();
        self.turn_count += 1;
        self.memory.set_turn(self.turn_count);
        let idle = player_input == IDLE;
        let actual = if idle { IDLE_DESC.to_string() } else { player_input.to_string() };
        self.record_action(&actual);
        if self.turn_count.is_multiple_of(5) {
            self.advance_time(30);
        }
        if idle {
            self.advance_time(10);
        }
        let context_s = self.build_context(&actual);
        let responses = self.consult_agents(&actual, &context_s).await;
        (actual, context_s, responses)
    }

    async fn consult_agents(&self, actual: &str, context_s: &str) -> Vec<AgentResponse> {
        let enabled = self.config.enabled_agents.clone();
        let mode = self.config.mode;
        let narrator_p = self.provider_for(AgentRole::Narrator).clone();
        let narrator_m = self.model_for(AgentRole::Narrator);
        let roster: Vec<(AgentRole, HttpProvider, Option<String>, String)> = AgentRole::ALL
            .into_iter()
            .map(|role| (role, self.provider_for(role).clone(), self.model_for(role), self.extra_for(role)))
            .collect();
        let mut planned = if enabled.iter().any(|r| *r != AgentRole::Narrator) {
            agents::plan_consults(&narrator_p, narrator_m, actual, context_s).await
        } else {
            vec![]
        };
        if mode == GameMode::AiBattle && !planned.contains(&AgentRole::NpcDirector) {
            planned.push(AgentRole::NpcDirector);
        }
        let mut jobs = Vec::new();
        for role in planned {
            if !(enabled.contains(&role) || mode == GameMode::AiBattle && role == AgentRole::NpcDirector) {
                continue;
            }
            let Some((_, provider, model, extra)) = roster.iter().find(|(r, ..)| *r == role) else { continue };
            let provider = provider.clone();
            let model = model.clone();
            let extra = extra.clone();
            let actual = actual.to_string();
            let context_s = context_s.to_string();
            jobs.push(async move {
                Agent::new(role, &provider, model)
                    .with_extra(extra)
                    .process(&actual, &context_s)
                    .await
                    .ok()
            });
        }
        futures_util::future::join_all(jobs).await.into_iter().flatten().collect()
    }

    async fn finish_turn(
        &mut self,
        actual: &str,
        narrative: &str,
        context_s: &str,
        responses: Vec<AgentResponse>,
    ) -> AppResult<TurnResult> {
        self.resolve_state(actual, narrative, context_s).await?;
        self.apply_heuristic_relations(actual, narrative);
        self.evaluate_ending();
        self.sync_schedules();
        let summary: String = narrative.chars().take(200).collect();
        let _ = self.memory.remember(
            &format!("回合{}: 玩家行动「{}」→ {}", self.turn_count, actual, summary),
            importance(actual, narrative),
            &extract_tags(actual, narrative),
        );
        if self.turn_count.is_multiple_of(5) {
            let _ = self.memory.maintain(self.turn_count);
        }
        if self.config.auto_save_interval > 0 && self.turn_count.is_multiple_of(self.config.auto_save_interval) {
            let _ = self.save(&format!("auto-save-{}", now_ms()));
        }
        self.check_achievements();
        self.record_turn(actual, narrative, &responses);
        let mut warnings = Vec::new();
        if let Some(err) = &self.state.last_state_error {
            warnings.push(err.clone());
        }
        Ok(TurnResult {
            narrative: narrative.into(),
            agent_details: responses,
            state_snapshot: self.state.context_summary(),
            warnings,
        })
    }

    pub async fn auto_world_tick(&mut self) -> AppResult<Option<String>> {
        if !self.should_auto_tick() {
            return Ok(None);
        }
        self.touch();
        self.advance_time(60);
        self.sync_schedules();
        let context = self.build_context("世界正在无人注意时变化");
        let provider = self.provider_for(AgentRole::WorldKeeper).clone();
        let model = self.model_for(AgentRole::WorldKeeper);
        let resp = Agent::new(AgentRole::WorldKeeper, &provider, model)
            .with_extra("玩家处于闲置。用 80 字以内描写世界自己发生的变化，不要点名要求玩家行动。".into())
            .process("生成一次安静的世界演化。", &context)
            .await?;
        self.state.last_world_event = Some(resp.content.clone());
        let _ = self.memory.remember(&format!("世界自动演化：{}", resp.content), 0.5, &["world".into()]);
        Ok(Some(resp.content))
    }

    fn record_action(&mut self, description: &str) {
        let (kind, target) = classify_action(description, &self.state.present_npcs);
        self.state.player_actions.push(Action {
            id: Uuid::new_v4().to_string(),
            actor: "player".into(),
            kind,
            description: description.into(),
            target,
            timestamp: now_ms(),
        });
        if self.state.player_actions.len() > 50 {
            let extra = self.state.player_actions.len() - 50;
            self.state.player_actions.drain(0..extra);
        }
    }

    fn advance_time(&mut self, minutes: u32) {
        let mut total = self.state.world_time.hour * 60 + self.state.world_time.minute + minutes;
        let extra_days = total / (24 * 60);
        total %= 24 * 60;
        self.state.world_time.day += extra_days;
        self.state.world_time.hour = total / 60;
        self.state.world_time.minute = total % 60;
        self.state.world_time.period = TimePeriod::from_hour(self.state.world_time.hour);
        self.sync_schedules();
    }

    async fn resolve_state(&mut self, player_input: &str, narrative: &str, context: &str) -> AppResult<()> {
        #[derive(Deserialize, Default)]
        #[serde(rename_all = "camelCase")]
        struct Parsed {
            location_change: Option<LocationChange>,
            time_advance_minutes: Option<u32>,
            environment_change: Option<EnvChange>,
            inventory_change: Option<serde_json::Value>,
            quest_update: Option<serde_json::Value>,
            relationship_update: Option<serde_json::Value>,
            plot_status: Option<PlotStatus>,
            ending: Option<String>,
        }
        #[derive(Deserialize)]
        struct LocationChange {
            name: Option<String>,
            description: Option<String>,
        }
        #[derive(Deserialize)]
        struct EnvChange {
            weather: Option<String>,
            lighting: Option<String>,
        }
        #[derive(Deserialize)]
        struct InvChange {
            item: String,
            action: String,
            quantity: u32,
            description: Option<String>,
            #[serde(rename = "type")]
            kind: Option<EconomyItemType>,
        }
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct QuestUpd {
            quest_id: String,
            title: String,
            status: QuestStatus,
            description: Option<String>,
            objectives: Option<Vec<String>>,
        }
        #[derive(Deserialize)]
        struct RelUpd {
            npc: String,
            delta: i32,
            note: Option<String>,
        }

        let provider = self.provider_for(AgentRole::RuleArbiter).clone();
        let prompt = format!(
            "你是游戏状态解析器。根据玩家行动和叙事提取 JSON 状态变化。\n玩家：{player_input}\n叙事：{narrative}\n场景：{context}\n返回严格 JSON：locationChange,timeAdvanceMinutes,environmentChange,inventoryChange,questUpdate,relationshipUpdate,plotStatus,ending。questUpdate 可含 objectives。relationshipUpdate 为 {{npc,delta,note}} 或数组。"
        );
        self.state.last_state_error = None;
        let reply = provider
            .chat(
                &[ChatMessage { role: ChatRole::System, content: prompt }],
                &ChatOptions {
                    response_format: crate::types::ResponseFormat::Json,
                    temperature: Some(0.1),
                    ..Default::default()
                },
            )
            .await;
        let reply = match reply {
            Ok(r) => r,
            Err(err) => {
                self.state.last_state_error = Some(format!("状态解析请求失败：{err}"));
                return Ok(());
            }
        };
        let parsed: Parsed = match parse_model_json(&reply.content) {
            Ok(v) => v,
            Err(err) => {
                self.state.last_state_error = Some(format!("状态 JSON 无法解析：{err}"));
                return Ok(());
            }
        };
        if let Some(loc) = parsed.location_change {
            if let Some(name) = loc.name {
                if !self.state.player_state.visited_locations.contains(&name) {
                    self.state.player_state.visited_locations.push(name.clone());
                }
                self.state.current_location = name;
                if let Some(d) = loc.description {
                    self.state.location_description = d;
                }
            }
        }
        if let Some(mins) = parsed.time_advance_minutes {
            if mins > 0 {
                self.advance_time(mins);
            }
        }
        if let Some(env) = parsed.environment_change {
            if let Some(w) = env.weather {
                self.state.environment.weather = w;
            }
            if let Some(l) = env.lighting {
                self.state.environment.lighting = l;
            }
        }
        if let Some(inv) = parsed.inventory_change {
            let items: Vec<InvChange> = if inv.is_array() {
                serde_json::from_value(inv).unwrap_or_default()
            } else {
                serde_json::from_value(inv).ok().into_iter().collect()
            };
            for change in items {
                self.apply_inventory(change.item, &change.action, change.quantity, change.description, change.kind);
            }
        }
        if let Some(qu) = parsed.quest_update {
            let ups: Vec<QuestUpd> = if qu.is_array() {
                serde_json::from_value(qu).unwrap_or_default()
            } else {
                serde_json::from_value(qu).ok().into_iter().collect()
            };
            for up in ups {
                self.apply_quest(up.quest_id, up.title, up.status, up.description, up.objectives);
            }
        }
        if let Some(rel) = parsed.relationship_update {
            let ups: Vec<RelUpd> = if rel.is_array() {
                serde_json::from_value(rel).unwrap_or_default()
            } else {
                serde_json::from_value(rel).ok().into_iter().collect()
            };
            for up in ups {
                self.apply_relationship_delta(&up.npc, up.delta, up.note.as_deref());
            }
        }
        if let Some(status) = parsed.plot_status {
            if let Some(plot) = self.state.active_plots.first_mut() {
                plot.status = status;
            }
        }
        if let Some(ending) = parsed.ending {
            let ending = ending.trim();
            if ending.chars().count() >= 4 && ending.chars().count() <= 200 {
                self.state.ending = Some(ending.to_string());
            }
        }
        Ok(())
    }

    fn apply_relationship_delta(&mut self, npc_ref: &str, delta: i32, note: Option<&str>) {
        let delta = delta.clamp(-25, 25);
        if delta == 0 {
            return;
        }
        let needle = npc_ref.trim();
        if needle.is_empty() {
            return;
        }
        let npc = self.state.present_npcs.iter().find(|n| n.id == needle || n.name.contains(needle)).cloned();
        let Some(npc) = npc else { return };
        if let Some(rel) = self
            .state
            .relationships
            .iter_mut()
            .find(|r| r.involves("player") && r.involves(&npc.id))
        {
            rel.affinity = (rel.affinity + delta).clamp(-100, 100);
            rel.status = LiveRelationship::status_from_affinity(rel.affinity).into();
            if let Some(note) = note.filter(|n| !n.trim().is_empty()) {
                rel.description = note.chars().take(160).collect();
            }
        } else {
            self.state.relationships.push(LiveRelationship {
                a_id: "player".into(),
                a_name: self.state.player_state.name.clone(),
                b_id: npc.id.clone(),
                b_name: npc.name.clone(),
                kind: "acquaintance".into(),
                status: LiveRelationship::status_from_affinity(delta).into(),
                affinity: delta.clamp(-100, 100),
                description: note.unwrap_or("新建立的关系").chars().take(160).collect(),
            });
        }
        let aff = self
            .state
            .relationships
            .iter()
            .find(|r| r.involves("player") && r.involves(&npc.id))
            .map(|r| r.affinity)
            .unwrap_or(0);
        if let Some(n) = self.state.present_npcs.iter_mut().find(|n| n.id == npc.id) {
            n.disposition = LiveRelationship::disposition_from_affinity(aff);
            if self.config.mode == GameMode::ChatRoleplay {
                n.mood = Some(LiveRelationship::mood_from_affinity(aff).into());
            }
        }
    }

    fn apply_heuristic_relations(&mut self, input: &str, narrative: &str) {
        let blob = format!("{input}\n{narrative}");
        let delta = relation_delta(&blob);
        if delta == 0 {
            return;
        }
        let target = self
            .state
            .present_npcs
            .iter()
            .find(|n| input.contains(&n.name) || input.contains(&n.id) || narrative.contains(&n.name))
            .map(|n| n.id.clone())
            .or_else(|| {
                (self.state.present_npcs.len() == 1).then(|| self.state.present_npcs[0].id.clone())
            });
        if let Some(id) = target {
            self.apply_relationship_delta(&id, delta, None);
        }
    }

    fn evaluate_ending(&mut self) {
        if self.state.ending.is_some() {
            return;
        }
        match self.config.mode {
            GameMode::TextAdventure => {
                let plots_done = !self.state.active_plots.is_empty()
                    && self.state.active_plots.iter().all(|p| p.status == PlotStatus::Resolved);
                let explored = self.state.player_state.visited_locations.len() >= 4
                    && self.state.player_state.quests.iter().any(|q| q.status == QuestStatus::Completed);
                if plots_done || explored {
                    self.state.ending = Some("迷雾散去。你选定了一条离开此地的路，这段旅程告一段落。".into());
                }
            }
            GameMode::AiBattle => {
                if let Some(c) = &self.state.combat {
                    self.state.ending = match c.outcome {
                        CombatOutcome::PlayerWin => Some("灰刃倒下。你赢得了这场对决。".into()),
                        CombatOutcome::PlayerLose => Some("你力竭跪地。灰刃收剑，对局结束。".into()),
                        CombatOutcome::Ongoing => None,
                    };
                }
            }
            GameMode::ChatRoleplay => {
                let close = self
                    .state
                    .relationships
                    .iter()
                    .filter(|r| r.involves("player") && r.affinity.abs() >= 40)
                    .count();
                if close >= 2 && self.turn_count >= 12 {
                    self.state.ending = Some("这段关系已经走到一个可以落幕的节点。".into());
                }
            }
            GameMode::NpcSandbox => {}
        }
    }

    fn apply_inventory(&mut self, name: String, action: &str, qty: u32, desc: Option<String>, kind: Option<EconomyItemType>) {
        let Some(name) = sanitize_item_name(&name) else { return };
        let qty = qty.clamp(1, 99);
        let inv = &mut self.state.player_state.inventory;
        if action == "add" {
            if let Some(existing) = inv.iter_mut().find(|i| i.name == name) {
                existing.quantity = (existing.quantity + qty).min(99);
            } else {
                if inv.len() >= 40 {
                    return;
                }
                inv.push(InventoryItem {
                    id: Uuid::new_v4().to_string(),
                    name,
                    description: desc.filter(|d| !d.trim().is_empty()).map(|d| d.chars().take(200).collect()),
                    quantity: qty,
                    kind: kind.map(EconomyItemType::to_inventory).unwrap_or(InventoryItemType::Misc),
                });
            }
        } else if action == "remove" {
            if let Some(pos) = inv.iter().position(|i| i.name == name) {
                inv[pos].quantity = inv[pos].quantity.saturating_sub(qty);
                if inv[pos].quantity == 0 {
                    inv.remove(pos);
                }
            }
        }
    }

    fn apply_quest(
        &mut self,
        quest_id: String,
        title: String,
        status: QuestStatus,
        description: Option<String>,
        objectives: Option<Vec<String>>,
    ) {
        let Some(title) = sanitize_quest_title(&title) else { return };
        let quest_id = quest_id.trim();
        if quest_id.is_empty() || quest_id.chars().count() > 64 {
            return;
        }
        let quest_id = quest_id.to_string();
        let description = description
            .unwrap_or_default()
            .trim()
            .chars()
            .take(1000)
            .collect::<String>();
        let objectives = sanitize_objectives(objectives.unwrap_or_default());
        if let Some(q) = self.state.player_state.quests.iter_mut().find(|q| q.quest_id == quest_id) {
            q.title = title;
            q.status = status;
            if !description.is_empty() {
                q.description = description;
            }
            if !objectives.is_empty() {
                q.objectives = objectives;
            }
        } else {
            if self.state.player_state.quests.len() >= 20 {
                return;
            }
            self.state.player_state.quests.push(Quest {
                id: Uuid::new_v4().to_string(),
                quest_id: quest_id.clone(),
                title,
                description,
                status,
                objectives,
            });
        }
        if status == QuestStatus::Completed {
            self.apply_inventory(
                format!("{quest_id}的谢礼"),
                "add",
                1,
                Some("任务完成后获得的消耗品。".into()),
                Some(EconomyItemType::Consumable),
            );
        }
    }

    fn record_turn(&mut self, input: &str, narrative: &str, responses: &[AgentResponse]) {
        let narrator_cot = responses
            .iter()
            .rev()
            .find(|r| r.from == AgentRole::Narrator)
            .and_then(|r| r.chain_of_thought.clone())
            .unwrap_or_else(|| extract_chain_of_thought(narrative, AgentRole::Narrator, now_ms().saturating_sub(1), now_ms()));
        let record = TurnRecord {
            turn: self.turn_count,
            input: input.into(),
            narrative: narrative.into(),
            timestamp: now_ms(),
            chain_of_thought: Some(narrator_cot),
            agent_thoughts: responses
                .iter()
                .filter_map(|r| r.chain_of_thought.clone())
                .filter(|c| !c.steps.is_empty())
                .collect(),
        };
        self.state.current_turn = Some(record.clone());
        self.state.history.push(record);
        let max = self.config.max_history_turns.max(1);
        if self.state.history.len() > max {
            let extra = self.state.history.len() - max;
            self.state.history.drain(0..extra);
        }
    }

    fn check_achievements(&mut self) {
        let p = &self.state.player_state;
        if self.turn_count >= 1 {
            self.unlocked.insert("first_step".into());
        }
        if self.turn_count >= 10 {
            self.unlocked.insert("story_beginner".into());
        }
        if self.turn_count >= 50 {
            self.unlocked.insert("story_enthusiast".into());
        }
        if self.turn_count >= 100 {
            self.unlocked.insert("legend".into());
        }
        if p.visited_locations.len() >= 3 {
            self.unlocked.insert("explorer".into());
        }
        if p.visited_locations.len() >= 10 {
            self.unlocked.insert("world_traveler".into());
        }
        if self.state.combat.is_some() || self.state.player_actions.iter().any(|a| a.kind == ActionKind::Combat) {
            self.unlocked.insert("first_blood".into());
        }
        if self.state.combat.as_ref().is_some_and(|c| c.outcome == CombatOutcome::PlayerWin) {
            self.unlocked.insert("victory".into());
        }
        let talked: std::collections::HashSet<&str> = self
            .state
            .player_actions
            .iter()
            .filter(|a| a.kind == ActionKind::Talk)
            .filter_map(|a| a.target.as_deref())
            .collect();
        if talked.len() >= 5 {
            self.unlocked.insert("socialite".into());
        }
        if talked.len() >= 10 {
            self.unlocked.insert("diplomat".into());
        }
        let unique_items = p.inventory.len();
        if unique_items >= 5 {
            self.unlocked.insert("collector".into());
        }
        if unique_items >= 15 {
            self.unlocked.insert("treasure_hunter".into());
        }
        if matches!(self.state.world_time.period, TimePeriod::Night | TimePeriod::Midnight) {
            self.unlocked.insert("night_owl".into());
        }
        if p.max_health > 0 && p.health > 0 && p.health * 100 / p.max_health <= 20 {
            self.unlocked.insert("survivor".into());
        }
        let public = ACHIEVEMENT_DEFS.iter().filter(|d| !d.secret).count();
        let unlocked_public = ACHIEVEMENT_DEFS
            .iter()
            .filter(|d| !d.secret && self.unlocked.contains(d.id))
            .count();
        if unlocked_public >= public {
            self.unlocked.insert("master".into());
        }
    }

    pub fn achievements(&self) -> Vec<Achievement> {
        ACHIEVEMENT_DEFS
            .iter()
            .map(|d| Achievement {
                id: d.id.into(),
                name: d.name.into(),
                description: d.description.into(),
                kind: d.kind.into(),
                icon: d.icon.into(),
                unlocked: self.unlocked.contains(d.id),
                unlocked_at: None,
            })
            .collect()
    }

    pub fn unlocked_count(&self) -> usize {
        self.unlocked.len()
    }

    pub fn save(&self, name: &str) -> AppResult<String> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let data = SaveData {
            id: id.clone(),
            name: name.into(),
            mode: self.config.mode,
            scene_state: self.state.clone(),
            created_at: now.clone(),
            updated_at: now,
            history: self.state.player_actions.clone(),
            metadata: serde_json::json!({
                "turnCount": self.turn_count,
                "sessionId": self.memory.session_id(),
                "unlockedAchievements": self.unlocked.iter().cloned().collect::<Vec<_>>(),
            }),
        };
        let path = resolve_save_file(&self.save_root, &id)?;
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        std::fs::write(path, serde_json::to_vec_pretty(&data)?)?;
        Ok(id)
    }

    pub fn load(&mut self, id: &str) -> AppResult<()> {
        let path = resolve_save_file(&self.save_root, id)?;
        let raw = std::fs::read_to_string(path)?;
        let data: SaveData = serde_json::from_str(&raw)?;
        self.state = data.scene_state;
        self.turn_count = data.metadata.get("turnCount").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
        self.memory.set_turn(self.turn_count);
        if let Some(sid) = data.metadata.get("sessionId").and_then(|v| v.as_str()) {
            self.memory.set_session_id(sid.to_string());
        }
        self.unlocked = data
            .metadata
            .get("unlockedAchievements")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|x| x.as_str().map(str::to_string)).collect())
            .unwrap_or_default();
        Ok(())
    }

    pub fn list_saves(&self, limit: usize) -> AppResult<Vec<SaveSummary>> {
        let dir = self.save_root.join("saves");
        if !dir.exists() {
            return Ok(vec![]);
        }
        let mut saves = Vec::new();
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            if entry.path().extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            if let Ok(raw) = std::fs::read_to_string(entry.path()) {
                if let Ok(data) = serde_json::from_str::<SaveData>(&raw) {
                    saves.push(SaveSummary {
                        id: data.id,
                        name: data.name,
                        mode: data.mode,
                        created_at: data.created_at,
                        updated_at: data.updated_at,
                    });
                }
            }
        }
        saves.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        saves.truncate(limit.clamp(1, 200));
        Ok(saves)
    }

    pub fn delete_save(&self, id: &str) -> AppResult<()> {
        let path = resolve_save_file(&self.save_root, id)?;
        if path.exists() {
            std::fs::remove_file(path)?;
        }
        Ok(())
    }

    pub fn reset(&mut self) {
        self.state = SceneState::default_opening();
        self.turn_count = 0;
        self.unlocked.clear();
        self.uses_tavern_schedule = false;
        self.touch();
        let _ = self.memory.clear();
    }

    pub fn apply_identity(&mut self, world_name: Option<String>, player_name: Option<String>) {
        if let Some(name) = player_name {
            self.state.player_state.name = name;
        }
        if let Some(world) = world_name {
            self.state.player_state.world_name = Some(world);
        }
        if let Some(combat) = &mut self.state.combat {
            combat.player.name = self.state.player_state.name.clone();
        }
    }

    pub fn bootstrap(&mut self, world_name: Option<String>, location: Option<String>, player_name: Option<String>, conflict: Option<String>) {
        self.reset();
        if let Some(loc) = location {
            self.state.current_location = loc.clone();
            self.state.player_state.visited_locations = vec![loc];
        }
        if let Some(name) = player_name {
            self.state.player_state.name = name;
        }
        self.state.player_state.world_name = world_name;
        if let Some(c) = conflict {
            self.state.active_plots.push(PlotPoint {
                id: Uuid::new_v4().to_string(),
                name: c.clone(),
                status: PlotStatus::Active,
                description: c,
            });
        }
    }

    pub fn rebuild_session(&mut self) {
        self.memory.set_session_id(format!("session-{}", now_ms()));
    }
}

struct AchievementDef {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    kind: &'static str,
    icon: &'static str,
    secret: bool,
}

const ACHIEVEMENT_DEFS: &[AchievementDef] = &[
    AchievementDef { id: "first_step", name: "第一步", description: "完成第一次行动", kind: "story", icon: "🌟", secret: false },
    AchievementDef { id: "story_beginner", name: "故事开始", description: "完成第10个回合", kind: "story", icon: "📖", secret: false },
    AchievementDef { id: "story_enthusiast", name: "故事爱好者", description: "完成第50个回合", kind: "story", icon: "📚", secret: false },
    AchievementDef { id: "legend", name: "传说", description: "完成第100个回合", kind: "story", icon: "🏆", secret: false },
    AchievementDef { id: "explorer", name: "探索者", description: "访问3个不同地点", kind: "exploration", icon: "🗺️", secret: false },
    AchievementDef { id: "world_traveler", name: "世界旅人", description: "访问10个不同地点", kind: "exploration", icon: "🌍", secret: false },
    AchievementDef { id: "first_blood", name: "初战", description: "参与第一次战斗", kind: "combat", icon: "⚔️", secret: false },
    AchievementDef { id: "victory", name: "胜利", description: "赢得一场战斗", kind: "combat", icon: "🛡️", secret: false },
    AchievementDef { id: "socialite", name: "社交达人", description: "与5个不同NPC对话", kind: "social", icon: "💬", secret: false },
    AchievementDef { id: "diplomat", name: "外交官", description: "与10个不同NPC对话", kind: "social", icon: "🤝", secret: false },
    AchievementDef { id: "collector", name: "收藏家", description: "获得5件不同物品", kind: "collection", icon: "🎒", secret: false },
    AchievementDef { id: "treasure_hunter", name: "寻宝猎人", description: "获得15件不同物品", kind: "collection", icon: "💎", secret: false },
    AchievementDef { id: "night_owl", name: "夜猫子", description: "在夜晚进行行动", kind: "special", icon: "🌙", secret: false },
    AchievementDef { id: "survivor", name: "幸存者", description: "在生命值低于20%时存活", kind: "special", icon: "❤️", secret: false },
    AchievementDef { id: "master", name: "大师", description: "解锁所有非隐藏成就", kind: "special", icon: "👑", secret: true },
];

fn sanitize_item_name(name: &str) -> Option<String> {
    let trimmed = name.trim();
    let count = trimmed.chars().count();
    if count == 0 || count > 40 {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn sanitize_quest_title(title: &str) -> Option<String> {
    let trimmed = title.trim();
    let count = trimmed.chars().count();
    if !(2..=100).contains(&count) {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn sanitize_objectives(raw: Vec<String>) -> Vec<String> {
    raw.into_iter()
        .map(|s| s.trim().chars().take(120).collect::<String>())
        .filter(|s| !s.is_empty())
        .take(10)
        .collect()
}

fn classify_action(description: &str, npcs: &[crate::types::NpcState]) -> (ActionKind, Option<String>) {
    let target = npcs
        .iter()
        .find(|n| description.contains(&n.name) || description.contains(&n.id))
        .map(|n| n.id.clone());
    let kind = if ["打", "攻", "杀", "战斗", "进攻", "attack"].iter().any(|k| description.to_lowercase().contains(k)) {
        ActionKind::Combat
    } else if ["走", "去", "前往", "离开", "move"].iter().any(|k| description.to_lowercase().contains(k)) {
        ActionKind::Move
    } else if ["看", "观察", "检查", "examine"].iter().any(|k| description.contains(*k)) {
        ActionKind::Examine
    } else if ["用", "喝", "吃", "装备"].iter().any(|k| description.contains(*k)) {
        ActionKind::Use
    } else if target.is_some() || ["说", "问", "跟", "对话", "聊"].iter().any(|k| description.contains(*k)) {
        ActionKind::Talk
    } else {
        ActionKind::Custom
    };
    (kind, target)
}

fn relation_delta(blob: &str) -> i32 {
    let low = blob.to_lowercase();
    if ["侮辱", "威胁", "攻击", "嘲笑", "打了", "偷"].iter().any(|k| blob.contains(*k)) {
        -8
    } else if ["礼物", "帮助", "治疗", "道歉", "谢谢", "赠"].iter().any(|k| blob.contains(*k)) {
        8
    } else if ["说", "问", "对话", "聊", "交谈"].iter().any(|k| blob.contains(*k)) || low.contains("talk") {
        3
    } else {
        0
    }
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn importance(input: &str, narrative: &str) -> f64 {
    let combined = format!("{input}{narrative}");
    if ["战斗", "死亡", "发现", "宝藏"].iter().any(|k| combined.contains(k)) {
        0.8
    } else if ["对话", "探索"].iter().any(|k| combined.contains(k)) {
        0.6
    } else {
        0.4
    }
}

fn extract_tags(input: &str, narrative: &str) -> Vec<String> {
    let combined = format!("{input} {narrative}");
    ["战斗", "对话", "探索", "任务"]
        .into_iter()
        .filter(|k| combined.contains(k))
        .map(str::to_string)
        .collect()
}

#[allow(dead_code)]
fn _path(_: &Path) {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::GameMode;

    #[test]
    fn default_scene_has_typed_inventory() {
        let s = SceneState::default_opening();
        assert_eq!(s.player_state.inventory[0].kind, InventoryItemType::Weapon);
        assert!(s.history.is_empty());
    }

    #[test]
    fn mode_presets_are_distinct() {
        let a = GameConfig::for_mode(GameMode::TextAdventure);
        let b = GameConfig::for_mode(GameMode::AiBattle);
        let c = GameConfig::for_mode(GameMode::ChatRoleplay);
        assert_ne!(a.enabled_agents, b.enabled_agents);
        assert!(a.auto_world_tick);
        assert!(!b.auto_world_tick);
        assert!(!c.enable_combat);
    }

    fn test_engine() -> (tempfile::TempDir, GameEngine) {
        let dir = tempfile::tempdir().unwrap();
        let engine = GameEngine::new(
            GameConfig::default(),
            ProviderFactoryConfig::default(),
            dir.path().to_path_buf(),
            dir.path().join("mem.db").to_str().unwrap(),
            "test-session".into(),
            None,
        )
        .unwrap();
        (dir, engine)
    }

    #[test]
    fn rejects_invalid_items_and_keeps_objectives() {
        let (_dir, mut e) = test_engine();
        e.apply_inventory(String::new(), "add", 1, None, None);
        e.apply_inventory("x".repeat(80), "add", 1, None, None);
        e.apply_inventory("短剑".into(), "add", 500, Some("锋利".into()), Some(EconomyItemType::Weapon));
        assert_eq!(e.state.player_state.inventory.iter().filter(|i| i.name == "短剑").count(), 1);
        assert_eq!(e.state.player_state.inventory.iter().find(|i| i.name == "短剑").unwrap().quantity, 99);

        e.apply_quest("q1".into(), "王国的危机".into(), QuestStatus::Active, Some("调查异常".into()), Some(vec!["找到线人".into(), "  ".into(), "回报领主".into()]));
        let q = e.state.player_state.quests.iter().find(|q| q.quest_id == "q1").unwrap();
        assert_eq!(q.objectives, vec!["找到线人".to_string(), "回报领主".to_string()]);
        e.apply_quest("".into(), "坏".into(), QuestStatus::Active, None, None);
        assert_eq!(e.state.player_state.quests.len(), 1);
    }

    #[test]
    fn achievement_catalog_unlocks_from_progress() {
        let (_dir, mut e) = test_engine();
        assert!(e.achievements().len() >= 12);
        assert!(e.achievements().iter().all(|a| !a.unlocked));

        e.turn_count = 10;
        e.state.player_state.visited_locations = vec!["a".into(), "b".into(), "c".into()];
        e.state.world_time.period = TimePeriod::Night;
        e.state.player_state.health = 5;
        e.state.player_state.max_health = 100;
        e.state.combat = Some(CombatState::fresh("p", "f"));
        e.state.combat.as_mut().unwrap().outcome = CombatOutcome::PlayerWin;
        for i in 0..5 {
            e.apply_inventory(format!("物{i}"), "add", 1, None, Some(EconomyItemType::Misc));
        }
        e.check_achievements();
        let unlocked: Vec<_> = e.achievements().into_iter().filter(|a| a.unlocked).map(|a| a.id).collect();
        assert!(unlocked.contains(&"first_step".into()));
        assert!(unlocked.contains(&"story_beginner".into()));
        assert!(unlocked.contains(&"explorer".into()));
        assert!(unlocked.contains(&"night_owl".into()));
        assert!(unlocked.contains(&"survivor".into()));
        assert!(unlocked.contains(&"victory".into()));
        assert!(unlocked.contains(&"collector".into()));
    }

    #[test]
    fn relationships_shift_and_adventure_can_end() {
        let (_dir, mut e) = test_engine();
        e.config.mode = GameMode::TextAdventure;
        e.state.present_npcs.push(crate::types::NpcState {
            id: "traveler".into(),
            name: "蒙面旅人".into(),
            disposition: crate::types::NpcDisposition::Neutral,
            current_activity: "等".into(),
            health: None,
            mood: None,
        });
        e.state.relationships = npc::player_ties(&e.state.present_npcs, "冒险者");
        e.apply_relationship_delta("traveler", 12, Some("聊得很投机"));
        let rel = e.state.relationships.iter().find(|r| r.involves("traveler")).unwrap();
        assert!(rel.affinity >= 12);
        assert_eq!(rel.status, "neutral");

        e.state.active_plots = vec![PlotPoint {
            id: "p".into(),
            name: "迷雾之路".into(),
            status: PlotStatus::Resolved,
            description: "done".into(),
        }];
        e.evaluate_ending();
        assert!(e.state.ending.is_some());
    }
}
