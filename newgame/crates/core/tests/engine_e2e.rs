//! 端到端集成测试：验证 Engine 完整事件循环
//!
//! 测试路径：build_default → dispatch_player_input → 等待 narrative_generated
//! 验证点：
//! - 收到 narrative_generated 事件
//! - 事件 payload.content 非空
//! - state.narrative 被更新
//! - turn_count 增加

use game_core::{
    engine_factory::EngineFactory,
    events::GameEvent,
};
use std::time::Duration;

/// 测试：派发玩家输入后，能收到 narrative_generated 事件且状态正确更新
#[tokio::test]
async fn test_dispatch_player_input_generates_narrative() {
    // 1. 构建默认引擎（使用 EchoProvider 兜底，无需外部 AI）
    let bundle = EngineFactory::build_default()
        .await
        .expect("EngineFactory::build_default should succeed");

    let engine = bundle.handle;
    let state_store = engine.state_store();

    // 2. 启动引擎事件循环
    engine.start().await;

    // 3. 订阅事件总线
    let mut event_rx = engine.event_bus().subscribe();

    // 4. 派发玩家输入
    let test_input = "探索前方的道路";
    engine.dispatch_player_input(test_input).await;

    // 5. 等待 narrative_generated 事件（最多 5 秒）
    let timeout_result = tokio::time::timeout(Duration::from_secs(5), async {
        while let Ok(event) = event_rx.recv().await {
            if event.event_type == "narrative_generated" {
                return Some(event);
            }
        }
        None
    })
    .await;

    // 6. 验证收到了事件
    let narrative_event: GameEvent = timeout_result
        .expect("Timed out waiting for narrative_generated event")
        .expect("Event channel closed without receiving narrative_generated");

    // 7. 验证事件 payload.content 非空
    let content = narrative_event
        .payload
        .get("content")
        .and_then(|v| v.as_str())
        .expect("narrative_generated event should have content field");

    assert!(
        !content.is_empty(),
        "narrative content should not be empty, got: {:?}",
        content
    );

    // 8. 验证 state.narrative 已被更新（与事件内容一致）
    let state_narrative = state_store
        .read(|s| s.narrative.clone())
        .await;

    assert_eq!(
        state_narrative, content,
        "state.narrative should match event payload.content"
    );

    // 9. 验证 turn_count 已增加（从默认值 12 增加到 13，因为 WorldState::default 里 turn_count=12）
    let turn_count = state_store.read(|s| s.turn_count).await;
    assert_eq!(turn_count, 13, "turn_count should be incremented to 13");

    // 10. 验证 narrative_history 有记录
    let history_len = state_store.read(|s| s.narrative_history.len()).await;
    assert_eq!(history_len, 1, "narrative_history should have 1 entry");

    let history_entry = state_store
        .read(|s| s.narrative_history.first().cloned())
        .await;
    assert!(
        history_entry.is_some(),
        "narrative_history should have first entry"
    );
    let entry = history_entry.unwrap();
    assert_eq!(entry.content, content, "history entry content should match");
    assert!(!entry.is_player, "history entry should not be marked as player");
}

/// 测试：多次输入产生多条叙事历史记录
#[tokio::test]
async fn test_multiple_inputs_accumulate_history() {
    let bundle = EngineFactory::build_default()
        .await
        .expect("EngineFactory::build_default should succeed");

    let engine = bundle.handle;
    let state_store = engine.state_store();

    engine.start().await;

    // 连续发送 3 次输入
    for i in 0..3 {
        let mut event_rx = engine.event_bus().subscribe();
        let input = format!("动作 {}", i + 1);
        engine.dispatch_player_input(&input).await;

        // 等待 narrative_generated
        let _ = tokio::time::timeout(Duration::from_secs(5), async {
            while let Ok(event) = event_rx.recv().await {
                if event.event_type == "narrative_generated" {
                    return;
                }
            }
        })
        .await;
    }

    // 验证历史记录有 3 条
    let history_len = state_store.read(|s| s.narrative_history.len()).await;
    assert_eq!(history_len, 3, "narrative_history should have 3 entries");

    // 验证 turn_count = 12 + 3 = 15
    let turn_count = state_store.read(|s| s.turn_count).await;
    assert_eq!(turn_count, 15, "turn_count should be 15 after 3 inputs");
}
