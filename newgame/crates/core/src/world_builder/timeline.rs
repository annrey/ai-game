/**
 * 世界时间线与事件系统
 *
 * 管理世界历史、重大事件和时间线：
 * - 历史时期划分
 * - 重大事件链
 * - 条件触发事件
 * - 世界状态演变
 */

use serde::{Deserialize, Serialize};

/// 世界时间线
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldTimeline {
    pub eras: Vec<Era>,
    pub events: Vec<TimelineEvent>,
    pub current_era: String,
    pub current_year: i32,
    pub current_season: String,
    pub day: u32,
    pub time_of_day: TimeOfDay,
}

impl WorldTimeline {
    pub fn new() -> Self {
        Self {
            eras: vec![],
            events: vec![],
            current_era: String::new(),
            current_year: 1,
            current_season: "春".to_string(),
            day: 1,
            time_of_day: TimeOfDay::Morning,
        }
    }

    pub fn add_era(&mut self, era: Era) {
        if self.current_era.is_empty() {
            self.current_era = era.id.clone();
        }
        self.eras.push(era);
    }

    pub fn add_event(&mut self, event: TimelineEvent) {
        self.events.push(event);
    }

    pub fn advance_time(&mut self, hours: u32) {
        // 简化的时间推进逻辑
        let days_advanced = hours / 24;
        self.day += days_advanced;

        // 更新时间段
        let hour = hours % 24;
        self.time_of_day = match hour {
            5..=8 => TimeOfDay::Dawn,
            9..=11 => TimeOfDay::Morning,
            12..=14 => TimeOfDay::Noon,
            15..=17 => TimeOfDay::Afternoon,
            18..=20 => TimeOfDay::Dusk,
            21..=23 => TimeOfDay::Evening,
            _ => TimeOfDay::Night,
        };
    }

    pub fn get_active_events(&self) -> Vec<&TimelineEvent> {
        self.events
            .iter()
            .filter(|e| e.is_active && e.trigger_condition.is_none())
            .collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Era {
    pub id: String,
    pub name: String,
    pub description: String,
    pub start_year: i32,
    pub end_year: Option<i32>,
    pub theme: String,
    pub major_events: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub id: String,
    pub name: String,
    pub description: String,
    pub event_type: EventType,
    pub year: i32,
    pub season: String,
    pub day: u32,
    pub location_id: Option<String>,
    pub involved_characters: Vec<String>,
    pub involved_factions: Vec<String>,
    pub trigger_condition: Option<String>,
    pub consequences: Vec<String>,
    pub is_active: bool,
    pub is_repeatable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    Historical,
    Political,
    Military,
    Natural,
    Magical,
    Economic,
    Social,
    Personal,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TimeOfDay {
    Dawn,
    Morning,
    Noon,
    Afternoon,
    Dusk,
    Evening,
    Night,
    Midnight,
}

impl std::fmt::Display for TimeOfDay {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TimeOfDay::Dawn => write!(f, "黎明"),
            TimeOfDay::Morning => write!(f, "早晨"),
            TimeOfDay::Noon => write!(f, "正午"),
            TimeOfDay::Afternoon => write!(f, "下午"),
            TimeOfDay::Dusk => write!(f, "黄昏"),
            TimeOfDay::Evening => write!(f, "傍晚"),
            TimeOfDay::Night => write!(f, "夜晚"),
            TimeOfDay::Midnight => write!(f, "午夜"),
        }
    }
}
