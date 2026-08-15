use std::time::{SystemTime, UNIX_EPOCH};

use serde::Deserialize;

use crate::error::AppResult;
use crate::providers::HttpProvider;
use crate::security::cot::extract_chain_of_thought;
use crate::security::json::parse_model_json;
use crate::types::{AgentResponse, AgentRole, ChatMessage, ChatOptions, ChatRole};

pub fn builtin_prompt(role: AgentRole) -> &'static str {
    match role {
        AgentRole::Narrator => {
            r#"你是一位经验丰富的主叙述者（Narrator），负责协调一场精彩的冒险故事。
用第二人称写 200-400 字沉浸式叙事，不要给固定选项。
仔细阅读上下文中的 inventory 和 quests。
若输入表示等待/闲置，描写环境自然演变。
生成响应时尽量使用：【观察】【分析】【推理】【决策】【行动】"#
        }
        AgentRole::WorldKeeper => {
            r#"你是世界观守护者。确保叙事符合设定，提供地理/文化/历史细节。
回复格式：【设定确认】【细节】【建议】，控制在 100-200 字。"#
        }
        AgentRole::NpcDirector => {
            r#"你是 NPC 导演。给出在场 NPC 的反应、语气和动作，不要代替玩家行动。"#
        }
        AgentRole::RuleArbiter => {
            r#"你是规则仲裁者。处理检定、战斗与边界情况。
回复格式：【判定类型】【难度】【骰子】【结果】【效果】【说明】"#
        }
        AgentRole::DramaCurator => {
            r#"你是剧情策划。评估节奏、伏笔与情感曲线，向 Narrator 提供建议，不直接对玩家说话。"#
        }
    }
}

pub fn system_prompt(role: AgentRole) -> String {
    match crate::skills::prompt_for(role) {
        Some(skill) => format!("{skill}\n\n---\n运行时约束：\n{}", builtin_prompt(role)),
        None => builtin_prompt(role).to_string(),
    }
}

pub struct Agent<'a> {
    pub role: AgentRole,
    provider: &'a HttpProvider,
    model: Option<String>,
    extra: String,
}

impl<'a> Agent<'a> {
    pub fn new(role: AgentRole, provider: &'a HttpProvider, model: Option<String>) -> Self {
        Self { role, provider, model, extra: String::new() }
    }

    pub fn with_extra(mut self, extra: String) -> Self {
        self.extra = extra;
        self
    }

    pub async fn process(&self, content: &str, context: &str) -> AppResult<AgentResponse> {
        let start = now_ms();
        let mut system = system_prompt(self.role).to_string();
        if !self.extra.is_empty() {
            system.push_str("\n\n");
            system.push_str(&self.extra);
        }
        let messages = vec![
            ChatMessage { role: ChatRole::System, content: system },
            ChatMessage { role: ChatRole::User, content: format!("{content}\n\n上下文：{context}") },
        ];
        let options = ChatOptions {
            model: self.model.clone(),
            temperature: Some(match self.role {
                AgentRole::Narrator => 0.8,
                AgentRole::RuleArbiter => 0.3,
                AgentRole::WorldKeeper => 0.5,
                _ => 0.7,
            }),
            ..Default::default()
        };
        let reply = self.provider.chat(&messages, &options).await?;
        let end = now_ms();
        Ok(AgentResponse {
            from: self.role,
            content: reply.content.clone(),
            chain_of_thought: Some(extract_chain_of_thought(&reply.content, self.role, start, end)),
        })
    }

    pub async fn process_stream<F>(&self, content: &str, context: &str, on_chunk: F) -> AppResult<AgentResponse>
    where
        F: FnMut(&str),
    {
        let start = now_ms();
        let mut system = system_prompt(self.role).to_string();
        if !self.extra.is_empty() {
            system.push_str("\n\n");
            system.push_str(&self.extra);
        }
        let messages = vec![
            ChatMessage { role: ChatRole::System, content: system },
            ChatMessage { role: ChatRole::User, content: format!("{content}\n\n上下文：{context}") },
        ];
        let options = ChatOptions {
            model: self.model.clone(),
            temperature: Some(0.8),
            ..Default::default()
        };
        let reply = self.provider.chat_stream(&messages, &options, on_chunk).await?;
        let end = now_ms();
        Ok(AgentResponse {
            from: self.role,
            content: reply.content.clone(),
            chain_of_thought: Some(extract_chain_of_thought(&reply.content, self.role, start, end)),
        })
    }
}

#[derive(Deserialize)]
struct ConsultPlan {
    #[serde(default)]
    consult: Vec<String>,
}

pub async fn plan_consults(provider: &HttpProvider, model: Option<String>, player_input: &str, context: &str) -> Vec<AgentRole> {
    let analysis = Agent::new(AgentRole::Narrator, provider, model)
        .process(
            &format!(
                "分析以下玩家输入，判断需要咨询哪些专家（返回 JSON）：角色列表：world-keeper, npc-director, rule-arbiter, drama-curator\n玩家输入：{player_input}\n请返回 JSON：{{\"consult\":[\"角色名\"],\"reason\":\"原因\"}}"
            ),
            context,
        )
        .await;
    let names = match analysis {
        Ok(resp) => parse_model_json::<ConsultPlan>(&resp.content).map(|p| p.consult).unwrap_or_default(),
        Err(_) => vec![
            "world-keeper".into(),
            "npc-director".into(),
            "rule-arbiter".into(),
            "drama-curator".into(),
        ],
    };
    names
        .into_iter()
        .filter_map(|name| match name.as_str() {
            "world-keeper" => Some(AgentRole::WorldKeeper),
            "npc-director" => Some(AgentRole::NpcDirector),
            "rule-arbiter" => Some(AgentRole::RuleArbiter),
            "drama-curator" => Some(AgentRole::DramaCurator),
            _ => None,
        })
        .collect()
}

pub async fn narrate(
    provider: &HttpProvider,
    model: Option<String>,
    player_input: &str,
    context: &str,
    consults: &[AgentResponse],
    extra: String,
) -> AppResult<AgentResponse> {
    let consult_ctx = if consults.is_empty() {
        String::new()
    } else {
        let joined = consults
            .iter()
            .map(|r| format!("【{}】：{}", r.from.as_str(), r.content))
            .collect::<Vec<_>>()
            .join("\n\n");
        format!("\n\n其他说书人的意见：\n{joined}")
    };
    Agent::new(AgentRole::Narrator, provider, model)
        .with_extra(extra)
        .process(&format!("{player_input}{consult_ctx}"), context)
        .await
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}
