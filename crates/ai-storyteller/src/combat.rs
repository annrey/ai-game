use rand::Rng;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CombatAction {
    Attack,
    Defend,
    Feint,
    Recover,
    Wait,
}

impl CombatAction {
    pub fn as_zh(self) -> &'static str {
        match self {
            Self::Attack => "进攻",
            Self::Defend => "防御",
            Self::Feint => "佯攻",
            Self::Recover => "调息",
            Self::Wait => "观察",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CombatOutcome {
    Ongoing,
    PlayerWin,
    PlayerLose,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Fighter {
    pub name: String,
    pub hp: i32,
    pub max_hp: i32,
    pub atk: i32,
    pub def: i32,
    pub hits: u32,
}

impl Fighter {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            hp: 30,
            max_hp: 30,
            atk: 8,
            def: 6,
            hits: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CombatState {
    pub player: Fighter,
    pub foe: Fighter,
    pub round: u32,
    pub target_hits: u32,
    pub outcome: CombatOutcome,
    pub last_summary: String,
}

impl CombatState {
    pub fn fresh(player: &str, foe: &str) -> Self {
        Self {
            player: Fighter::new(player),
            foe: Fighter::new(foe),
            round: 0,
            target_hits: 3,
            outcome: CombatOutcome::Ongoing,
            last_summary: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CombatReport {
    pub player_action: CombatAction,
    pub foe_action: CombatAction,
    pub player_roll: u8,
    pub foe_roll: u8,
    pub damage_to_player: i32,
    pub damage_to_foe: i32,
    pub heal_player: i32,
    pub outcome: CombatOutcome,
    pub summary: String,
}

pub fn parse_player_action(input: &str) -> CombatAction {
    let t = input.to_lowercase();
    if ["佯", "骗", "虚晃", "feint", "feign"].iter().any(|k| t.contains(k)) {
        CombatAction::Feint
    } else if ["守", "挡", "架", "defend", "block", "guard"].iter().any(|k| t.contains(k)) {
        CombatAction::Defend
    } else if ["调息", "疗", "喘", "recover", "heal", "rest"].iter().any(|k| t.contains(k)) {
        CombatAction::Recover
    } else if ["等", "观", "wait", "idle", "观察"].iter().any(|k| t.contains(k)) || t.contains("<wait>") {
        CombatAction::Wait
    } else {
        CombatAction::Attack
    }
}

pub fn parse_foe_action(text: &str) -> CombatAction {
    let after_mark = text.split('】').nth(1).unwrap_or(text);
    parse_player_action(after_mark)
}

fn strike(atk: i32, def: i32, roll: u8, defended: bool) -> i32 {
    let dc = if defended { 14 } else { 10 };
    let margin = i32::from(roll) + atk - def - dc;
    if margin < 0 {
        0
    } else {
        4 + margin / 3
    }
}

pub fn resolve(state: &mut CombatState, player: CombatAction, foe: CombatAction) -> CombatReport {
    let mut rng = rand::rng();
    let player_roll = rng.random_range(1u8..=20);
    let foe_roll = rng.random_range(1u8..=20);

    let mut damage_to_foe = 0;
    let mut damage_to_player = 0;
    let mut heal_player = 0;

    let foe_defending = foe == CombatAction::Defend && player != CombatAction::Feint;
    let player_defending = player == CombatAction::Defend && foe != CombatAction::Feint;

    match player {
        CombatAction::Attack | CombatAction::Feint => {
            damage_to_foe = strike(state.player.atk, state.foe.def, player_roll, foe_defending);
            if player == CombatAction::Feint && foe == CombatAction::Defend {
                damage_to_foe += 3;
            }
        }
        CombatAction::Recover => {
            heal_player = 6;
        }
        CombatAction::Wait | CombatAction::Defend => {}
    }

    match foe {
        CombatAction::Attack | CombatAction::Feint => {
            damage_to_player = strike(state.foe.atk, state.player.def, foe_roll, player_defending);
            if foe == CombatAction::Feint && player == CombatAction::Defend {
                damage_to_player += 3;
            }
        }
        CombatAction::Recover => {
            state.foe.hp = (state.foe.hp + 6).min(state.foe.max_hp);
        }
        CombatAction::Wait | CombatAction::Defend => {}
    }

    if player == CombatAction::Recover && damage_to_player > 0 {
        damage_to_player += 2;
    }

    state.round += 1;
    state.player.hp = (state.player.hp - damage_to_player + heal_player).clamp(0, state.player.max_hp);
    state.foe.hp = (state.foe.hp - damage_to_foe).clamp(0, state.foe.max_hp);
    if damage_to_foe > 0 {
        state.player.hits += 1;
    }
    if damage_to_player > 0 {
        state.foe.hits += 1;
    }

    state.outcome = if state.foe.hp <= 0 || state.player.hits >= state.target_hits {
        CombatOutcome::PlayerWin
    } else if state.player.hp <= 0 || state.foe.hits >= state.target_hits {
        CombatOutcome::PlayerLose
    } else {
        CombatOutcome::Ongoing
    };

    let summary = format!(
        "第{}回合：你{}(d20={})，对手{}(d20={})。你受到{}伤、造成{}伤。HP 你{}/{} 对手{}/{}。有效命中 {}-{}。{}",
        state.round,
        player.as_zh(),
        player_roll,
        foe.as_zh(),
        foe_roll,
        damage_to_player,
        damage_to_foe,
        state.player.hp,
        state.player.max_hp,
        state.foe.hp,
        state.foe.max_hp,
        state.player.hits,
        state.foe.hits,
        match state.outcome {
            CombatOutcome::Ongoing => "对局继续。",
            CombatOutcome::PlayerWin => "你获胜。",
            CombatOutcome::PlayerLose => "你落败。",
        }
    );
    state.last_summary = summary;
    rebalance(state);

    CombatReport {
        player_action: player,
        foe_action: foe,
        player_roll,
        foe_roll,
        damage_to_player,
        damage_to_foe,
        heal_player,
        outcome: state.outcome,
        summary: state.last_summary.clone(),
    }
}

/// Nudge stats when one side is clearly dominating so later rounds stay contestable.
pub fn rebalance(state: &mut CombatState) {
    if state.outcome != CombatOutcome::Ongoing || state.round < 2 {
        return;
    }
    let player_ratio = if state.player.max_hp > 0 {
        state.player.hp as f32 / state.player.max_hp as f32
    } else {
        1.0
    };
    let foe_ratio = if state.foe.max_hp > 0 {
        state.foe.hp as f32 / state.foe.max_hp as f32
    } else {
        1.0
    };
    if player_ratio - foe_ratio > 0.35 && state.foe.atk < 12 {
        state.foe.atk += 1;
        state.last_summary.push_str(" 对手开始认真起来。");
    } else if foe_ratio - player_ratio > 0.35 && state.player.def < 10 {
        state.player.def += 1;
        state.last_summary.push_str(" 你稳住了步法。");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_chinese_and_english() {
        assert_eq!(parse_player_action("我举剑进攻"), CombatAction::Attack);
        assert_eq!(parse_player_action("架住来剑"), CombatAction::Defend);
        assert_eq!(parse_player_action("虚晃一枪"), CombatAction::Feint);
        assert_eq!(parse_player_action("先调息一口"), CombatAction::Recover);
    }

    #[test]
    fn feint_beats_defend() {
        let mut hits = 0;
        for _ in 0..40 {
            let mut s = CombatState::fresh("你", "灰刃");
            s.player.atk = 12;
            s.foe.def = 6;
            let r = resolve(&mut s, CombatAction::Feint, CombatAction::Defend);
            if r.damage_to_foe > 0 {
                hits += 1;
            }
        }
        assert!(hits >= 20, "feint should usually pierce defend, hits={hits}");
    }

    #[test]
    fn three_hits_wins() {
        let mut s = CombatState::fresh("你", "灰刃");
        s.player.hits = 2;
        s.player.atk = 20;
        s.foe.def = 0;
        let mut won = false;
        for _ in 0..8 {
            let r = resolve(&mut s, CombatAction::Attack, CombatAction::Wait);
            if r.outcome == CombatOutcome::PlayerWin {
                won = true;
                break;
            }
        }
        assert!(won);
    }

    #[test]
    fn rebalance_buffs_losing_side() {
        let mut s = CombatState::fresh("你", "灰刃");
        s.round = 3;
        s.player.hp = 28;
        s.foe.hp = 8;
        let atk = s.foe.atk;
        rebalance(&mut s);
        assert!(s.foe.atk > atk);
        assert!(s.last_summary.contains("认真"));
    }
}
