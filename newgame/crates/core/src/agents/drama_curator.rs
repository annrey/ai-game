use super::{AIProvider, AgentResponse, BaseAgent, Message};
use anyhow::Result;
use std::sync::Arc;

pub struct DramaCuratorAgent {
    provider: Arc<dyn AIProvider>,
    temperature: f32,
    current_arc: String,
    foreshadowing: Vec<String>,
}

impl DramaCuratorAgent {
    pub fn new(provider: Arc<dyn AIProvider>) -> Self {
        Self {
            provider,
            temperature: 0.7,
            current_arc: "setup".to_string(),
            foreshadowing: Vec::new(),
        }
    }

    pub fn set_arc(&mut self, arc: &str) {
        self.current_arc = arc.to_string();
    }

    pub fn add_foreshadowing(&mut self, hint: &str) {
        self.foreshadowing.push(hint.to_string());
    }

    pub fn resolve_foreshadowing(&mut self, hint: &str) {
        self.foreshadowing.retain(|h| h != hint);
    }
}

#[async_trait::async_trait]
impl BaseAgent for DramaCuratorAgent {
    fn name(&self) -> &str {
        "DramaCurator"
    }

    fn system_prompt(&self) -> String {
        let foreshadowing_section = if self.foreshadowing.is_empty() {
            "当前无活跃伏笔。".to_string()
        } else {
            format!(
                "当前活跃伏笔：\n{}",
                self.foreshadowing
                    .iter()
                    .enumerate()
                    .map(|(i, h)| format!("  {}. {}", i + 1, h))
                    .collect::<Vec<_>>()
                    .join("\n")
            )
        };

        format!(
            r#"你是互动小说游戏的剧情策划（Drama Curator）。
你的职责是管理叙事节奏，确保故事具有张力和情感深度。

核心任务：
1. 伏笔管理：埋设、追踪和回收伏笔，确保前后呼应
2. 高潮调度：判断当前剧情距离高潮的远近，调整紧张感
3. 情感曲线：监控玩家情绪状态，在压抑与释放之间保持平衡
4. 叙事节奏：避免信息过载或节奏拖沓，保持恰当的推进速度

当前剧情阶段：{arc}
{foreshadowing}

思考时，请使用以下思维链格式：
【观察】分析当前剧情状态和玩家输入
【分析】评估伏笔、高潮距离和情感曲线
【行动】决定如何调整叙事节奏（埋设新伏笔、推进高潮、放缓节奏等）

最后输出简洁的剧情策划建议，供叙事者参考。"#,
            arc = self.current_arc,
            foreshadowing = foreshadowing_section
        )
    }

    async fn process_action(
        &self,
        context: &str,
        player_input: &str,
        history: &[Message],
    ) -> Result<AgentResponse> {
        let messages = self.build_messages(context, player_input, history);
        let raw_response = self
            .provider
            .generate_response(&messages, self.temperature)
            .await?;

        Ok(self.extract_chain_of_thought(&raw_response))
    }
}
