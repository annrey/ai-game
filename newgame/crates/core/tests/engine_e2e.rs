//! 端到端集成测试：验证 Engine 完整事件循环
//!
//! 测试路径：build_default → dispatch_player_input → 等待 narrative_generated
//! 验证点：
//! - 收到 narrative_generated 事件
//! - 事件 payload.content 非空
//! - state.narrative 被更新
//! - turn_count 增加

use async_trait::async_trait;
use game_core::{
    engine_factory::EngineFactory,
    events::GameEvent,
    engine::GameEngine,
    event_bus::EventBus,
    state_store::StateStore,
    rules::RuleEngine,
    agents::{AIProvider, Message, AgentManager, narrator::NarratorAgent},
};
use memory::in_memory::InMemoryStore;
use std::sync::Arc;
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

/// A1: 验证 narrative_generated 事件包含 thought_process 字段
#[tokio::test]
async fn test_narrative_generated_event_has_thought_process() {
    let bundle = EngineFactory::build_default()
        .await
        .expect("EngineFactory::build_default should succeed");

    let engine = bundle.handle;

    engine.start().await;

    let mut event_rx = engine.event_bus().subscribe();
    engine.dispatch_player_input("测试思考过程").await;

    let event = tokio::time::timeout(Duration::from_secs(5), async {
        while let Ok(event) = event_rx.recv().await {
            if event.event_type == "narrative_generated" {
                return event;
            }
        }
        panic!("No narrative_generated event received");
    })
    .await
    .expect("Timed out");

    let payload = &event.payload;
    assert!(payload.get("content").and_then(|v| v.as_str()).is_some());
    assert!(payload.get("thought_process").is_some(), "thought_process field should exist");
}

/// A2: 验证 payload 为直接字符串格式的兼容解析
#[tokio::test]
async fn test_player_input_payload_direct_string() {
    let bundle = EngineFactory::build_default()
        .await
        .expect("EngineFactory::build_default should succeed");

    let engine = bundle.handle;
    let state_store = engine.state_store();

    engine.start().await;

    let mut event_rx = engine.event_bus().subscribe();

    let direct_string_event = GameEvent {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: "player_input".to_string(),
        payload: serde_json::json!("直接字符串输入"),
        timestamp: chrono::Utc::now().timestamp_millis(),
    };
    engine.event_bus().publish(direct_string_event).unwrap();

    let event = tokio::time::timeout(Duration::from_secs(5), async {
        while let Ok(event) = event_rx.recv().await {
            if event.event_type == "narrative_generated" {
                return event;
            }
        }
        panic!("No narrative_generated event");
    })
    .await
    .expect("Timed out");

    assert!(!event.payload.get("content").and_then(|v| v.as_str()).unwrap_or("").is_empty());

    let turn_count = state_store.read(|s| s.turn_count).await;
    assert_eq!(turn_count, 13, "turn_count should be incremented");
}

/// A3: 验证空 payload 兜底处理，不会 panic
#[tokio::test]
async fn test_player_input_payload_empty_missing() {
    let bundle = EngineFactory::build_default()
        .await
        .expect("EngineFactory::build_default should succeed");

    let engine = bundle.handle;
    let state_store = engine.state_store();

    engine.start().await;

    let mut event_rx = engine.event_bus().subscribe();

    let empty_payload_event = GameEvent {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: "player_input".to_string(),
        payload: serde_json::json!({}),
        timestamp: chrono::Utc::now().timestamp_millis(),
    };
    engine.event_bus().publish(empty_payload_event).unwrap();

    let event = tokio::time::timeout(Duration::from_secs(5), async {
        while let Ok(event) = event_rx.recv().await {
            if event.event_type == "narrative_generated" {
                return event;
            }
        }
        panic!("No narrative_generated event");
    })
    .await
    .expect("Timed out");

    let content = event.payload.get("content").and_then(|v| v.as_str()).unwrap_or("");
    assert!(!content.is_empty(), "should generate narrative even with empty input");

    let turn_count = state_store.read(|s| s.turn_count).await;
    assert_eq!(turn_count, 13, "turn_count should still increment");
}

/// A4: 验证 start() 多次调用幂等
#[tokio::test]
async fn test_engine_start_idempotent() {
    let bundle = EngineFactory::build_default()
        .await
        .expect("EngineFactory::build_default should succeed");

    let engine = bundle.handle;

    engine.start().await;
    engine.start().await;
    engine.start().await;

    let mut event_rx = engine.event_bus().subscribe();
    engine.dispatch_player_input("幂等性测试").await;

    let event = tokio::time::timeout(Duration::from_secs(5), async {
        while let Ok(event) = event_rx.recv().await {
            if event.event_type == "narrative_generated" {
                return event;
            }
        }
        panic!("No narrative_generated event");
    })
    .await
    .expect("Timed out");

    assert!(
        !event.payload.get("content").and_then(|v| v.as_str()).unwrap_or("").is_empty(),
        "multiple start() calls should not break event processing"
    );
}

/// A5: 验证非 player_input 事件不会触发叙事生成
#[tokio::test]
async fn test_non_player_input_event_ignored() {
    let bundle = EngineFactory::build_default()
        .await
        .expect("EngineFactory::build_default should succeed");

    let engine = bundle.handle;
    let state_store = engine.state_store();

    let initial_turn_count = state_store.read(|s| s.turn_count).await;

    engine.start().await;

    let mut event_rx = engine.event_bus().subscribe();

    let system_event = GameEvent {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: "system_tick".to_string(),
        payload: serde_json::json!({"tick": 1}),
        timestamp: chrono::Utc::now().timestamp_millis(),
    };
    engine.event_bus().publish(system_event).unwrap();

    let found_narrative = tokio::time::timeout(Duration::from_secs(2), async {
        while let Ok(event) = event_rx.recv().await {
            if event.event_type == "narrative_generated" {
                return true;
            }
        }
        false
    })
    .await
    .unwrap_or(false);

    assert!(!found_narrative, "non-player_input events should not trigger narrative generation");

    let final_turn_count = state_store.read(|s| s.turn_count).await;
    assert_eq!(final_turn_count, initial_turn_count, "turn_count should not change for system events");
}

/// D1: 验证 narrative_history 时间戳单调递增
#[tokio::test]
async fn test_narrative_history_timestamps_are_monotonic() {
    let bundle = EngineFactory::build_default()
        .await
        .expect("EngineFactory::build_default should succeed");

    let engine = bundle.handle;
    let state_store = engine.state_store();

    engine.start().await;

    for i in 0..3 {
        let mut event_rx = engine.event_bus().subscribe();
        engine.dispatch_player_input(&format!("时间戳测试 {}", i + 1)).await;

        let _ = tokio::time::timeout(Duration::from_secs(5), async {
            while let Ok(event) = event_rx.recv().await {
                if event.event_type == "narrative_generated" {
                    return;
                }
            }
        })
        .await;
    }

    let history = state_store.read(|s| s.narrative_history.clone()).await;
    assert_eq!(history.len(), 3);

    for i in 1..history.len() {
        assert!(
            history[i].timestamp >= history[i - 1].timestamp,
            "timestamps must be monotonically non-decreasing: {} >= {}",
            history[i].timestamp,
            history[i - 1].timestamp
        );
    }
}

/// D2: 验证 state.narrative 始终等于最后一次 narrative_generated 事件的 content
#[tokio::test]
async fn test_state_narrative_equals_last_event_content() {
    let bundle = EngineFactory::build_default()
        .await
        .expect("EngineFactory::build_default should succeed");

    let engine = bundle.handle;
    let state_store = engine.state_store();

    engine.start().await;

    for i in 0..3 {
        let mut event_rx = engine.event_bus().subscribe();
        engine.dispatch_player_input(&format!("同步测试 {}", i + 1)).await;

        let event = tokio::time::timeout(Duration::from_secs(5), async {
            while let Ok(event) = event_rx.recv().await {
                if event.event_type == "narrative_generated" {
                    return event;
                }
            }
            panic!("No event");
        })
        .await
        .expect("Timed out");

        let event_content = event.payload.get("content").and_then(|v| v.as_str()).unwrap_or("");
        let state_narrative = state_store.read(|s| s.narrative.clone()).await;

        assert_eq!(state_narrative, event_content,
            "state.narrative should match event payload.content at iteration {}", i + 1);
    }
}

struct ErrorProvider;

#[async_trait]
impl AIProvider for ErrorProvider {
    async fn generate_response(&self, _messages: &[Message], _temperature: f32) -> Result<String, anyhow::Error> {
        Err(anyhow::anyhow!("模拟 AI 服务调用失败"))
    }
}

fn build_test_engine(provider: Arc<dyn AIProvider>) -> GameEngine {
    let event_bus = EventBus::new(16);
    let state_store = StateStore::new("/tmp/test_engine_e2e_saves");
    let rule_engine = RuleEngine::new();
    let memory_store = Arc::new(InMemoryStore::default());
    let agent_manager = Arc::new(AgentManager::new());
    let narrator = NarratorAgent::new(provider, Arc::clone(&agent_manager));
    let agent_manager_for_engine = (*agent_manager).clone();
    GameEngine::new(event_bus, state_store, rule_engine, narrator, memory_store, agent_manager_for_engine)
}

/// B1: 验证 AI 生成失败时产生 fallback 文本，且 thought_process 为 None
#[tokio::test]
async fn test_narrator_error_produces_fallback() {
    let engine = build_test_engine(Arc::new(ErrorProvider));
    let state_store = engine.state_store();

    engine.start().await;

    let mut event_rx = engine.event_bus().subscribe();

    let input_event = GameEvent {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: "player_input".to_string(),
        payload: serde_json::json!({"content": "触发失败"}),
        timestamp: chrono::Utc::now().timestamp_millis(),
    };
    engine.event_bus().publish(input_event).unwrap();

    let event = tokio::time::timeout(Duration::from_secs(5), async {
        while let Ok(event) = event_rx.recv().await {
            if event.event_type == "narrative_generated" {
                return event;
            }
        }
        panic!("No narrative_generated event");
    })
    .await
    .expect("Timed out");

    let content = event.payload.get("content").and_then(|v| v.as_str()).unwrap_or("");
    assert!(content.contains("说书人"), "fallback should contain '说书人', got: {}", content);
    assert!(content.contains("模拟 AI 服务调用失败"), "fallback should contain error message, got: {}", content);

    let thought_process = event.payload.get("thought_process");
    assert!(
        thought_process.map_or(true, |v| v.is_null()),
        "thought_process should be null on error, got: {:?}",
        thought_process
    );

    let state_narrative = state_store.read(|s| s.narrative.clone()).await;
    assert_eq!(state_narrative, content, "state.narrative should match fallback content");

    let turn_count = state_store.read(|s| s.turn_count).await;
    assert_eq!(turn_count, 13, "turn_count should increment on error as well");

    let history = state_store.read(|s| s.narrative_history.clone()).await;
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].content, content);
    assert!(!history[0].is_player, "error fallback should still be non-player entry");
}
