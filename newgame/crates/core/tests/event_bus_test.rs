//! EventBus 测试 - 验证事件发布/订阅机制

use game_core::event_bus::EventBus;
use game_core::events::GameEvent;

#[tokio::test]
async fn test_event_bus_publish_subscribe() {
    let bus = EventBus::new(16);
    let mut rx = bus.subscribe();

    let event = GameEvent {
        id: "test-1".to_string(),
        event_type: "test_event".to_string(),
        payload: serde_json::json!({"data": "hello"}),
        timestamp: 1234567890,
    };

    // 发布事件
    let result = bus.publish(event.clone());
    assert!(result.is_ok());

    // 订阅者应该收到事件
    let received = rx.recv().await.unwrap();
    assert_eq!(received.id, event.id);
    assert_eq!(received.event_type, event.event_type);
}

#[tokio::test]
async fn test_event_bus_multiple_subscribers() {
    let bus = EventBus::new(16);
    let mut rx1 = bus.subscribe();
    let mut rx2 = bus.subscribe();

    let event = GameEvent {
        id: "test-2".to_string(),
        event_type: "broadcast".to_string(),
        payload: serde_json::json!(null),
        timestamp: 1234567890,
    };

    bus.publish(event.clone()).unwrap();

    // 两个订阅者都应该收到
    let received1 = rx1.recv().await.unwrap();
    let received2 = rx2.recv().await.unwrap();

    assert_eq!(received1.id, event.id);
    assert_eq!(received2.id, event.id);
}

#[tokio::test]
async fn test_event_bus_receiver_cleanup() {
    let bus = EventBus::new(16);

    {
        let _rx = bus.subscribe();
        // rx 在这里被创建
        let result = bus.publish(GameEvent {
            id: "test".to_string(),
            event_type: "cleanup".to_string(),
            payload: serde_json::json!(null),
            timestamp: 1,
        });
        // 有活跃接收者时应该成功（返回 Ok(接收者数量)）
        assert!(result.is_ok());
    } // rx 在这里被 drop

    // rx 被清理后，再次发布事件 - 如果没有其他接收者可能会失败
    // broadcast channel 的行为是：没有接收者时返回错误
}

#[tokio::test]
async fn test_event_bus_backpressure() {
    let bus = EventBus::new(2); // 小容量
    let _rx = bus.subscribe();

    // 发布多个事件测试背压处理
    for i in 0..10 {
        let event = GameEvent {
            id: format!("test-{}", i),
            event_type: "backpressure".to_string(),
            payload: serde_json::json!({"index": i}),
            timestamp: i as i64,
        };
        let _ = bus.publish(event);
    }

    // 由于容量限制，某些事件可能被丢弃，但系统不应该崩溃
}
