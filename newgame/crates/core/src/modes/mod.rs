pub mod ai_battle;
pub mod chat_roleplay;
pub mod creator_mode;
pub mod npc_sandbox;
pub mod stardew_valley;
pub mod text_adventure;

use crate::state_store::WorldState;
use async_trait::async_trait;

/// 游戏模式统一接口
///
/// 每种游戏模式实现此 trait，提供模式名称、初始化世界状态、
/// 以及处理玩家回合的核心逻辑。
#[async_trait]
pub trait GameMode: Send + Sync {
    /// 返回模式名称
    fn name(&self) -> &'static str;

    /// 初始化世界状态，返回初始叙事/开场白
    async fn initialize(&self) -> anyhow::Result<(WorldState, String)>;

    /// 处理玩家输入，返回更新后的世界状态与叙事响应
    async fn process_turn(
        &self,
        state: &mut WorldState,
        player_input: &str,
    ) -> anyhow::Result<String>;
}
