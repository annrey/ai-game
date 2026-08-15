use serde::Serialize;

use crate::types::{LiveRelationship, NpcDisposition, NpcState, TimePeriod};

#[derive(Debug, Clone, Copy)]
pub struct ScheduleEntry {
    pub start_hour: u32,
    pub end_hour: u32,
    pub activity: &'static str,
    pub present: bool,
    pub mood: &'static str,
}

#[derive(Debug, Clone, Copy)]
pub struct NpcProfile {
    pub id: &'static str,
    pub name: &'static str,
    pub disposition: NpcDisposition,
    pub default_activity: &'static str,
    pub schedule: &'static [ScheduleEntry],
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Relationship {
    pub a: &'static str,
    pub b: &'static str,
    pub kind: &'static str,
    pub status: &'static str,
    pub affinity: i32,
    pub description: &'static str,
}

pub const TAVERN_CAST: &[NpcProfile] = &[
    NpcProfile {
        id: "bard-elara",
        name: "艾拉（吟游诗人）",
        disposition: NpcDisposition::Friendly,
        default_activity: "在角落整理乐谱",
        schedule: &[
            ScheduleEntry { start_hour: 8, end_hour: 12, activity: "在角落整理乐谱", present: true, mood: "calm" },
            ScheduleEntry { start_hour: 12, end_hour: 14, activity: "在吧台享用午餐", present: true, mood: "happy" },
            ScheduleEntry { start_hour: 14, end_hour: 18, activity: "外出寻找灵感", present: false, mood: "curious" },
            ScheduleEntry { start_hour: 18, end_hour: 22, activity: "在舞台演奏", present: true, mood: "happy" },
            ScheduleEntry { start_hour: 22, end_hour: 2, activity: "与客人交谈并接受点歌", present: true, mood: "friendly" },
            ScheduleEntry { start_hour: 2, end_hour: 8, activity: "在客房休息", present: true, mood: "tired" },
        ],
    },
    NpcProfile {
        id: "barkeep-thomas",
        name: "托马斯（酒馆老板）",
        disposition: NpcDisposition::Friendly,
        default_activity: "擦拭酒杯",
        schedule: &[
            ScheduleEntry { start_hour: 7, end_hour: 12, activity: "整理酒架并备货", present: true, mood: "busy" },
            ScheduleEntry { start_hour: 12, end_hour: 22, activity: "在吧台招待客人", present: true, mood: "friendly" },
            ScheduleEntry { start_hour: 22, end_hour: 2, activity: "收拾残局、送走醉客", present: true, mood: "tired" },
            ScheduleEntry { start_hour: 2, end_hour: 7, activity: "打烊休息", present: false, mood: "asleep" },
        ],
    },
    NpcProfile {
        id: "guard-marcus",
        name: "马库斯（守卫）",
        disposition: NpcDisposition::Neutral,
        default_activity: "在门口警戒",
        schedule: &[
            ScheduleEntry { start_hour: 8, end_hour: 16, activity: "在城门巡逻", present: false, mood: "alert" },
            ScheduleEntry { start_hour: 16, end_hour: 20, activity: "来酒馆吃晚饭", present: true, mood: "relaxed" },
            ScheduleEntry { start_hour: 20, end_hour: 8, activity: "夜巡", present: false, mood: "alert" },
        ],
    },
];

pub const TAVERN_RELATIONS: &[Relationship] = &[
    Relationship {
        a: "艾拉（吟游诗人）",
        b: "托马斯（酒馆老板）",
        kind: "colleague",
        status: "friendly",
        affinity: 30,
        description: "艾拉在酒馆表演，托马斯提供场地和食宿",
    },
    Relationship {
        a: "托马斯（酒馆老板）",
        b: "马库斯（守卫）",
        kind: "colleague",
        status: "neutral",
        affinity: 10,
        description: "马库斯常来吃午餐，托马斯给他优惠",
    },
    Relationship {
        a: "卢卡斯（商人）",
        b: "马库斯（守卫）",
        kind: "colleague",
        status: "strained",
        affinity: -10,
        description: "马库斯怀疑卢卡斯部分货物来路不明",
    },
];

pub fn hour_in_range(hour: u32, start: u32, end: u32) -> bool {
    if start == end {
        return true;
    }
    if start < end {
        hour >= start && hour < end
    } else {
        hour >= start || hour < end
    }
}

pub fn entry_for(profile: &NpcProfile, hour: u32) -> Option<&'static ScheduleEntry> {
    profile.schedule.iter().find(|e| hour_in_range(hour, e.start_hour, e.end_hour))
}

pub fn snapshot_cast(profiles: &[NpcProfile], hour: u32) -> Vec<NpcState> {
    profiles
        .iter()
        .filter_map(|p| {
            let entry = entry_for(p, hour);
            let present = entry.map(|e| e.present).unwrap_or(true);
            if !present {
                return None;
            }
            Some(NpcState {
                id: p.id.into(),
                name: p.name.into(),
                disposition: p.disposition,
                current_activity: entry.map(|e| e.activity.to_string()).unwrap_or_else(|| p.default_activity.into()),
                health: None,
                mood: Some(entry.map(|e| e.mood.to_string()).unwrap_or_else(|| "neutral".into())),
            })
        })
        .collect()
}

pub fn relations_for(present: &[NpcState]) -> Vec<Relationship> {
    let names: Vec<&str> = present.iter().map(|n| n.name.as_str()).collect();
    TAVERN_RELATIONS
        .iter()
        .copied()
        .filter(|r| names.contains(&r.a) && names.contains(&r.b))
        .collect()
}

pub fn tavern_live_relations() -> Vec<LiveRelationship> {
    TAVERN_RELATIONS
        .iter()
        .filter_map(|r| {
            let a = TAVERN_CAST.iter().find(|p| p.name == r.a)?;
            let b = TAVERN_CAST.iter().find(|p| p.name == r.b)?;
            Some(LiveRelationship {
                a_id: a.id.into(),
                a_name: a.name.into(),
                b_id: b.id.into(),
                b_name: b.name.into(),
                kind: r.kind.into(),
                status: LiveRelationship::status_from_affinity(r.affinity).into(),
                affinity: r.affinity,
                description: r.description.into(),
            })
        })
        .collect()
}

pub fn player_ties(npcs: &[NpcState], player_name: &str) -> Vec<LiveRelationship> {
    npcs.iter()
        .map(|n| LiveRelationship {
            a_id: "player".into(),
            a_name: player_name.into(),
            b_id: n.id.clone(),
            b_name: n.name.clone(),
            kind: "acquaintance".into(),
            status: "neutral".into(),
            affinity: 0,
            description: format!("{player_name}刚认识{}", n.name),
        })
        .collect()
}

pub fn seed_relationships(npcs: &[NpcState], player_name: &str, tavern: bool) -> Vec<LiveRelationship> {
    let mut rels = if tavern { tavern_live_relations() } else { vec![] };
    for tie in player_ties(npcs, player_name) {
        if !rels.iter().any(|r| r.key() == tie.key()) {
            rels.push(tie);
        }
    }
    rels
}

pub fn context_note(present: &[NpcState], hour: u32, period: TimePeriod, relationships: &[LiveRelationship]) -> String {
    let people = if present.is_empty() {
        "目前没有熟悉的 NPC 在场。".into()
    } else {
        present
            .iter()
            .map(|n| format!("{}（{}，心情{:?}）", n.name, n.current_activity, n.mood))
            .collect::<Vec<_>>()
            .join("；")
    };
    let present_ids: Vec<&str> = present.iter().map(|n| n.id.as_str()).collect();
    let ties: Vec<String> = relationships
        .iter()
        .filter(|r| {
            (present_ids.contains(&r.a_id.as_str()) || r.a_id == "player")
                && (present_ids.contains(&r.b_id.as_str()) || r.b_id == "player")
        })
        .map(|r| format!("{}与{}是{}，亲和{}（{}）", r.a_name, r.b_name, r.status, r.affinity, r.description))
        .collect();
    let ties = if ties.is_empty() {
        String::new()
    } else {
        format!(" 关系：{}", ties.join("；"))
    };
    format!("时刻 {hour}:00（{period:?}）。在场：{people}.{ties}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wraps_overnight_shift() {
        assert!(hour_in_range(23, 22, 2));
        assert!(hour_in_range(1, 22, 2));
        assert!(!hour_in_range(10, 22, 2));
    }

    #[test]
    fn afternoon_hides_bard() {
        let cast = snapshot_cast(TAVERN_CAST, 15);
        assert!(cast.iter().all(|n| n.id != "bard-elara"));
        assert!(cast.iter().any(|n| n.id == "barkeep-thomas"));
    }

    #[test]
    fn seeds_player_and_tavern_ties() {
        let cast = snapshot_cast(TAVERN_CAST, 12);
        let rels = seed_relationships(&cast, "冒险者", true);
        assert!(rels.iter().any(|r| r.a_id == "player" && r.b_id == "barkeep-thomas"));
        assert!(rels.iter().any(|r| r.key() == LiveRelationship::pair_key("bard-elara", "barkeep-thomas")));
    }
}
