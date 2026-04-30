//! StateStore 测试 - 验证状态管理和持久化

use game_core::state_store::{StateStore, GameSettings, SceneType};

#[tokio::test]
async fn test_state_store_default_initialization() {
    let store = StateStore::new("/tmp/test_saves");
    let state = store.read(|s| s.clone()).await;

    // 默认 WorldState 的 turn_count 是 12
    assert_eq!(state.turn_count, 12);
    assert_eq!(state.scene_type, SceneType::Forest);
    assert_eq!(state.weather, "Clear");
}

#[tokio::test]
async fn test_state_store_mutate() {
    let store = StateStore::new("/tmp/test_saves");

    store.mutate(|s| {
        s.turn_count = 5;
        s.narrative = "Test narrative".to_string();
    }).await;

    let turn_count = store.read(|s| s.turn_count).await;
    let narrative = store.read(|s| s.narrative.clone()).await;
    assert_eq!(turn_count, 5);
    assert_eq!(narrative, "Test narrative");
}

#[tokio::test]
async fn test_state_store_json_serialization() {
    let store = StateStore::new("/tmp/test_saves");

    store.mutate(|s| {
        s.turn_count = 10;
        s.player.name = "TestPlayer".to_string();
        s.scene_type = SceneType::Town;
    }).await;

    let json_str = store.get_state_json().await.unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

    assert_eq!(parsed["turn_count"], 10);
    assert_eq!(parsed["player"]["name"], "TestPlayer");
    // scene_type 序列化为字符串 "Town"
    assert_eq!(parsed["scene_type"], "Town");
}

#[tokio::test]
async fn test_state_store_concurrent_access() {
    let store = StateStore::new("/tmp/test_saves");

    // 模拟并发状态更新
    let mut handles = vec![];

    for i in 0..10 {
        let store_clone = store.clone();
        let handle = tokio::spawn(async move {
            store_clone.mutate(|s| {
                s.turn_count += 1;
            }).await;
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.await.unwrap();
    }

    let turn_count = store.read(|s| s.turn_count).await;
    // 默认 turn_count 是 12，加上 10 次并发更新 = 22
    assert_eq!(turn_count, 22);
}

#[tokio::test]
async fn test_game_settings_default() {
    let settings = GameSettings::default();

    assert!(settings.show_inventory);
    assert!(settings.show_quests);
    assert_eq!(settings.language, "zh-CN");
    assert_eq!(settings.idle_timeout_seconds, 30);
}

#[tokio::test]
async fn test_scene_type_serialization() {
    use game_core::state_store::SceneType;

    // 测试所有 SceneType 变体
    let types = vec![
        SceneType::Forest,
        SceneType::Town,
        SceneType::Dungeon,
        SceneType::Beach,
        SceneType::Mountain,
        SceneType::Custom,
    ];

    for scene_type in types {
        let json = serde_json::to_string(&scene_type).unwrap();
        let deserialized: SceneType = serde_json::from_str(&json).unwrap();
        assert_eq!(scene_type, deserialized);
    }
}
