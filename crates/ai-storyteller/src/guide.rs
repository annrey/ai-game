use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum GuideStepId {
    AiConfig,
    BasicSetup,
    WorldInit,
    BasicTutorial,
    AdvancedFeatures,
    Completed,
}

impl GuideStepId {
    pub const ORDER: [GuideStepId; 5] = [
        Self::AiConfig,
        Self::BasicSetup,
        Self::WorldInit,
        Self::BasicTutorial,
        Self::AdvancedFeatures,
    ];

    pub fn title(self) -> &'static str {
        match self {
            Self::AiConfig => "AI 配置",
            Self::BasicSetup => "基础设置",
            Self::WorldInit => "世界初始化",
            Self::BasicTutorial => "基础教学",
            Self::AdvancedFeatures => "进阶功能",
            Self::Completed => "完成",
        }
    }

    pub fn description(self) -> &'static str {
        match self {
            Self::AiConfig => "选择并测试本地或云端模型",
            Self::BasicSetup => "创建角色与世界名称",
            Self::WorldInit => "生成初始场景",
            Self::BasicTutorial => "移动、对话与观察",
            Self::AdvancedFeatures => "物品栏与任务",
            Self::Completed => "引导结束",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GuideStepStatus {
    Pending,
    Active,
    Completed,
    Skipped,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuideDraft {
    pub player_name: Option<String>,
    pub world_name: Option<String>,
    pub world_type: Option<String>,
    pub provider_ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuideStepView {
    pub id: GuideStepId,
    pub title: String,
    pub description: String,
    pub status: GuideStepStatus,
}

pub struct GuideManager {
    current: GuideStepId,
    completed: Vec<GuideStepId>,
    active: bool,
    pub draft: GuideDraft,
}

impl Default for GuideManager {
    fn default() -> Self {
        Self {
            current: GuideStepId::AiConfig,
            completed: vec![],
            active: true,
            draft: GuideDraft::default(),
        }
    }
}

impl GuideManager {
    pub fn start(&mut self, id: GuideStepId) {
        self.current = id;
        self.active = true;
    }

    pub fn can_complete(&self, id: GuideStepId) -> Result<(), String> {
        let prev = match id {
            GuideStepId::AiConfig => None,
            GuideStepId::BasicSetup => Some(GuideStepId::AiConfig),
            GuideStepId::WorldInit => Some(GuideStepId::BasicSetup),
            GuideStepId::BasicTutorial => Some(GuideStepId::WorldInit),
            GuideStepId::AdvancedFeatures => Some(GuideStepId::BasicTutorial),
            GuideStepId::Completed => Some(GuideStepId::AdvancedFeatures),
        };
        if let Some(prev) = prev {
            if !self.completed.contains(&prev) {
                return Err(format!("请先完成「{}」", prev.title()));
            }
        }
        Ok(())
    }

    pub fn complete(&mut self, id: GuideStepId) {
        if !self.completed.contains(&id) {
            self.completed.push(id);
        }
        self.current = GuideStepId::ORDER
            .iter()
            .copied()
            .find(|s| !self.completed.contains(s))
            .unwrap_or(GuideStepId::Completed);
        if matches!(self.current, GuideStepId::Completed) {
            self.active = false;
        }
    }

    pub fn skip(&mut self, id: GuideStepId) {
        self.complete(id);
    }

    pub fn ingest_chat(&mut self, message: &str) -> String {
        let msg = message.trim();
        if let Some(name) = extract_after(msg, &["我叫", "名字是", "角色名", "我的名字"]) {
            self.draft.player_name = Some(name.clone());
            return format!("记下了，你叫「{name}」。世界叫什么？");
        }
        if let Some(world) = extract_after(msg, &["世界叫", "世界名称", "世界是", "世界名"]) {
            self.draft.world_name = Some(world.clone());
            return format!("世界就叫「{world}」。点「下一步」我会据此初始化场景。");
        }
        if msg.contains("酒馆") || msg.contains("沙盒") {
            self.draft.world_type = Some("tavern".into());
            return "好，初始化时会倾向酒馆/沙盒模板。".into();
        }
        if msg.contains("对战") || msg.contains("战斗") {
            self.draft.world_type = Some("arena".into());
            return "好，初始化时会倾向竞技场。进攻、防御、佯攻、调息会按骰子结算。".into();
        }
        match self.current {
            GuideStepId::AiConfig => {
                if msg.to_ascii_lowercase().contains("ollama") {
                    "先运行 ollama serve，再 pull 一个指令模型。默认连 http://127.0.0.1:11434。".into()
                } else if msg.to_ascii_lowercase().contains("lm") || msg.contains("工作室") {
                    "打开 LM Studio → Local Server → Start。默认 http://127.0.0.1:1234/v1。".into()
                } else {
                    self.hint()
                }
            }
            GuideStepId::BasicSetup => "可以说「我叫林晚」或「世界叫雾港」。".into(),
            GuideStepId::WorldInit => "点下一步会用你刚才的名字和世界名生成开场。也可以先去设置里换模式模板。".into(),
            GuideStepId::BasicTutorial => "在主输入框写「向北走」或「和旅人说话」。".into(),
            GuideStepId::AdvancedFeatures => "背包和任务会在叙事里出现。完成后可以存档。".into(),
            GuideStepId::Completed => "引导结束，自由探索即可。".into(),
        }
    }

    pub fn hint(&self) -> String {
        match self.current {
            GuideStepId::AiConfig => "先启动 Ollama 或 LM Studio，然后点下一步，我会探测接口是否活着。".into(),
            GuideStepId::BasicSetup => format!(
                "当前角色：{}；世界：{}。在下面输入「我叫…」「世界叫…」。",
                self.draft.player_name.as_deref().unwrap_or("未定"),
                self.draft.world_name.as_deref().unwrap_or("未定")
            ),
            GuideStepId::WorldInit => "下一步会调用 bootstrap，把角色和世界写进场景。".into(),
            GuideStepId::BasicTutorial => "先在主界面做一次行动，再点下一步。".into(),
            GuideStepId::AdvancedFeatures => "看看物品栏和任务面板，然后结束引导。".into(),
            GuideStepId::Completed => "已经完成。".into(),
        }
    }

    pub fn payload(&self) -> serde_json::Value {
        let total = GuideStepId::ORDER.len();
        let done = self.completed.len();
        let current = self.current_step();
        let next = current.clone();
        serde_json::json!({
            "isActive": self.active && !matches!(self.current, GuideStepId::Completed),
            "isCompleted": matches!(self.current, GuideStepId::Completed),
            "progress": if total == 0 { 0 } else { done * 100 / total },
            "currentStep": current,
            "nextStep": next,
            "completedStepsCount": done,
            "totalStepsCount": total,
            "draft": self.draft,
        })
    }

    fn current_step(&self) -> Option<GuideStepView> {
        if matches!(self.current, GuideStepId::Completed) {
            return None;
        }
        Some(GuideStepView {
            id: self.current,
            title: self.current.title().into(),
            description: self.current.description().into(),
            status: GuideStepStatus::Active,
        })
    }
}

fn extract_after(message: &str, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(rest) = message.split(key).nth(1) {
            let name = rest
                .trim()
                .trim_start_matches(['：', ':', '是', '为'])
                .trim_matches(|c: char| c.is_ascii_punctuation() || "。！？，、\"“”".contains(c))
                .trim();
            if (2..=20).contains(&name.chars().count()) {
                return Some(name.to_string());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_names_from_chat() {
        let mut g = GuideManager::default();
        g.ingest_chat("我叫林晚");
        g.ingest_chat("世界叫雾港");
        assert_eq!(g.draft.player_name.as_deref(), Some("林晚"));
        assert_eq!(g.draft.world_name.as_deref(), Some("雾港"));
    }

    #[test]
    fn blocks_out_of_order_complete() {
        let g = GuideManager::default();
        assert!(g.can_complete(GuideStepId::WorldInit).is_err());
        assert!(g.can_complete(GuideStepId::AiConfig).is_ok());
    }
}
