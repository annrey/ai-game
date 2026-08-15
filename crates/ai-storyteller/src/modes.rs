use serde::Serialize;

use crate::npc::{snapshot_cast, NpcProfile, TAVERN_CAST};
use crate::types::{GameMode, NpcDisposition, NpcState, PlotPoint, PlotStatus, SceneState};

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModeTemplate {
    pub id: &'static str,
    pub name: &'static str,
    pub location: &'static str,
    pub description: &'static str,
    pub theme: &'static str,
}

#[derive(Debug, Clone, Copy)]
struct SeedNpc {
    id: &'static str,
    name: &'static str,
    disposition: NpcDisposition,
    activity: &'static str,
}

pub(crate) struct Seed {
    template: ModeTemplate,
    npcs: &'static [SeedNpc],
    plot: Option<(&'static str, &'static str)>,
    use_tavern_cast: bool,
}

const ADVENTURE: Seed = Seed {
    template: ModeTemplate {
        id: "crossroads",
        name: "十字路口",
        location: "迷雾十字路口",
        description: "四条道路没入薄雾。路边立着一块被藤蔓缠住的路牌，字迹几乎看不清。",
        theme: "fantasy",
    },
    npcs: &[SeedNpc {
        id: "traveler",
        name: "蒙面旅人",
        disposition: NpcDisposition::Neutral,
        activity: "在路牌下整理行囊",
    }],
    plot: Some(("迷雾之路", "有人在路口失踪，旅人似乎知道内情。")),
    use_tavern_cast: false,
};

const SANDBOX: &[Seed] = &[
    Seed {
        template: ModeTemplate {
            id: "medieval",
            name: "中世纪奇幻",
            location: "王都・弗洛拉城",
            description: "石板路两旁商铺林立，远处城堡尖塔在阳光下闪耀。",
            theme: "sandbox",
        },
        npcs: &[
            SeedNpc { id: "blacksmith", name: "铁匠老约翰", disposition: NpcDisposition::Friendly, activity: "在铺子里打铁" },
            SeedNpc { id: "merchant", name: "行商丽莎", disposition: NpcDisposition::Neutral, activity: "在广场摆摊" },
            SeedNpc { id: "guard", name: "守卫队长马克", disposition: NpcDisposition::Neutral, activity: "在城门巡逻" },
        ],
        plot: Some(("城中流言", "铁匠铺失窃，卫队正在排查外来者。")),
        use_tavern_cast: false,
    },
    Seed {
        template: ModeTemplate {
            id: "tavern",
            name: "醉仙楼",
            location: "长安・醉仙楼",
            description: "江湖人聚集的酒楼。二楼传来划拳声，说书先生正讲昨日武林大会。",
            theme: "sandbox",
        },
        npcs: &[],
        plot: Some(("酒楼秘事", "有人出高价打听一把失踪的古剑。")),
        use_tavern_cast: true,
    },
    Seed {
        template: ModeTemplate {
            id: "cyberpunk",
            name: "赛博朋克",
            location: "新东京・下层区",
            description: "霓虹从不熄灭。全息广告在雨里闪烁，空气里是电子烟和拉面味。",
            theme: "sandbox",
        },
        npcs: &[
            SeedNpc { id: "fixer", name: "掮客小K", disposition: NpcDisposition::Neutral, activity: "在酒吧暗角等客户" },
            SeedNpc { id: "hacker", name: "骇客Zero", disposition: NpcDisposition::Friendly, activity: "在网吧改代码" },
            SeedNpc { id: "corp", name: "企业安保・田中", disposition: NpcDisposition::Hostile, activity: "在街角监视" },
        ],
        plot: Some(("下层委托", "有人要一份不该存在的企业档案。")),
        use_tavern_cast: false,
    },
];

const ROLEPLAY: &[Seed] = &[
    Seed {
        template: ModeTemplate {
            id: "detective",
            name: "侦探推理",
            location: "雷恩庄园客厅",
            description: "壁炉将熄。管家刚通报主人死于书房，所有人都还没离开庄园。",
            theme: "roleplay",
        },
        npcs: &[
            SeedNpc { id: "butler", name: "管家阿福", disposition: NpcDisposition::Neutral, activity: "紧握托盘，回避目光" },
            SeedNpc { id: "alice", name: "小姐爱丽丝", disposition: NpcDisposition::Unknown, activity: "坐在窗边擦眼泪" },
            SeedNpc { id: "gardener", name: "园丁老张", disposition: NpcDisposition::Neutral, activity: "站在门口搓手" },
        ],
        plot: Some(("庄园命案", "找出谁在昨夜进过书房。")),
        use_tavern_cast: false,
    },
    Seed {
        template: ModeTemplate {
            id: "office",
            name: "职场风云",
            location: "科技公司・产品部",
            description: "周一站会刚散。白板上写着不可能的截止日期。",
            theme: "roleplay",
        },
        npcs: &[
            SeedNpc { id: "boss", name: "张总", disposition: NpcDisposition::Neutral, activity: "在玻璃办公室打电话" },
            SeedNpc { id: "lin", name: "小林", disposition: NpcDisposition::Friendly, activity: "过来分享八卦" },
            SeedNpc { id: "kevin", name: "Kevin", disposition: NpcDisposition::Neutral, activity: "戴耳机写代码" },
        ],
        plot: Some(("版本发布", "三天后要上线，需求还在变。")),
        use_tavern_cast: false,
    },
];

const BATTLE: Seed = Seed {
    template: ModeTemplate {
        id: "arena",
        name: "战术擂台",
        location: "石阵竞技场",
        description: "圆形沙地，四周是低矮石桩。对面的对手已经拔出训练剑。",
        theme: "strategy",
    },
    npcs: &[SeedNpc {
        id: "opponent",
        name: "对手・灰刃",
        disposition: NpcDisposition::Hostile,
        activity: "观察你的步法和重心",
    }],
    plot: Some(("三局两胜", "先击破对方防御三次者获胜。")),
    use_tavern_cast: false,
};

pub fn templates_for(mode: GameMode) -> Vec<ModeTemplate> {
    match mode {
        GameMode::TextAdventure => vec![ADVENTURE.template],
        GameMode::NpcSandbox => SANDBOX.iter().map(|s| s.template).collect(),
        GameMode::ChatRoleplay => ROLEPLAY.iter().map(|s| s.template).collect(),
        GameMode::AiBattle => vec![BATTLE.template],
    }
}

fn seeds(mode: GameMode) -> Vec<&'static Seed> {
    match mode {
        GameMode::TextAdventure => vec![&ADVENTURE],
        GameMode::NpcSandbox => SANDBOX.iter().collect(),
        GameMode::ChatRoleplay => ROLEPLAY.iter().collect(),
        GameMode::AiBattle => vec![&BATTLE],
    }
}

pub(crate) fn resolve_seed(mode: GameMode, template_id: Option<&str>) -> &'static Seed {
    let list = seeds(mode);
    template_id
        .and_then(|id| list.iter().copied().find(|s| s.template.id == id))
        .unwrap_or(list[0])
}

pub(crate) fn apply_seed(state: &mut SceneState, seed: &Seed) {
    state.current_location = seed.template.location.into();
    state.location_description = seed.template.description.into();
    state.player_state.world_name = Some(seed.template.name.into());
    state.player_state.genre = Some(seed.template.theme.into());
    state.player_state.visited_locations = vec![seed.template.location.into()];
    state.present_npcs = if seed.use_tavern_cast {
        snapshot_cast(TAVERN_CAST, state.world_time.hour)
    } else {
        seed.npcs
            .iter()
            .map(|n| NpcState {
                id: n.id.into(),
                name: n.name.into(),
                disposition: n.disposition,
                current_activity: n.activity.into(),
                health: None,
                mood: None,
            })
            .collect()
    };
    state.active_plots = seed
        .plot
        .map(|(name, desc)| {
            vec![PlotPoint {
                id: uuid::Uuid::new_v4().to_string(),
                name: name.into(),
                status: PlotStatus::Active,
                description: desc.into(),
            }]
        })
        .unwrap_or_default();
}

pub(crate) fn tavern_profiles(seed: &Seed) -> &'static [NpcProfile] {
    if seed.use_tavern_cast {
        TAVERN_CAST
    } else {
        &[]
    }
}

pub fn narrator_extra(mode: GameMode) -> &'static str {
    match mode {
        GameMode::TextAdventure => {
            "当前是文字冒险。推进探索与选择后果，保持第二人称，不要列出编号选项。"
        }
        GameMode::NpcSandbox => {
            "当前是 NPC 沙盒。让在场 NPC 按日程和关系自己活动，玩家可以自由交谈或走开。"
        }
        GameMode::ChatRoleplay => {
            "当前是角色扮演。重点写对话、语气和关系变化，少做规则判定，关闭大规模战斗描写。"
        }
        GameMode::AiBattle => {
            "当前是战术对战。每回合先交代对手动作与战场位置，再等待玩家宣告自己的行动。保持公平，不要替玩家取胜。"
        }
    }
}

pub fn opponent_extra() -> &'static str {
    "你是竞技场里的 AI 对手「灰刃」。分析玩家站位，选择一个不过分完美的行动。\n回复：【决策】【理由】【嘲讽/鼓励】"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sandbox_medieval_spawns_three_npcs() {
        let mut state = SceneState::default_opening();
        apply_seed(&mut state, resolve_seed(GameMode::NpcSandbox, Some("medieval")));
        assert_eq!(state.present_npcs.len(), 3);
        assert!(state.current_location.contains("弗洛拉"));
        assert!(!state.active_plots.is_empty());
    }

    #[test]
    fn unknown_template_falls_back() {
        let seed = resolve_seed(GameMode::ChatRoleplay, Some("nope"));
        assert_eq!(seed.template.id, "detective");
    }
}
