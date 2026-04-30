# T18: WorldManager 地形系统集成方案

## 目标

让 WorldManager 注入 StateStore，实现 weather/time/scene_type 由地形系统驱动。

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     game_core::StateStore                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  WorldState │  │ GameSettings│  │ TerrainBinding          │ │
│  │  · location │  │             │  │ · location_id ↔ terrain │ │
│  │  · weather  │  │             │  │ · terrain ↔ scene_type  │ │
│  │  · time     │  │             │  │ · climate ↔ weather     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└────────────────────────────────┬──────────────────────────────────┘
                                 │ 注入
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      world::WorldManager                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │TerrainManager│  │ StateStore │  │ TerrainStateSync        │ │
│  │ · terrain_map│◄─┤  (注入)    ├─►│ · 地形变更→更新State    │ │
│  │ · climate  │  │            │  │ · 时间推进→天气更新      │ │
│  │ · weather  │  │            │  │ · 位置移动→场景切换      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 核心设计

### 1. 地形→场景类型映射

| TerrainType | SceneType | 说明 |
|-------------|-----------|------|
| Forest, Jungle | Forest | 森林场景 |
| Plains, Hill | Town | 城镇/村庄 |
| Cave, Ruins | Dungeon | 地牢 |
| Coast, Lake, River | Beach | 水域 |
| Mountain, Volcanic | Mountain | 山地 |
| Desert, Swamp, Tundra | Custom | 特殊地形 |

### 2. 气候→天气映射

| ClimateType | 可能天气 |
|-------------|----------|
| Temperate | Sunny, Cloudy, Rainy |
| Tropical | Sunny, Rainy, Stormy |
| Cold | Snowy, Cloudy |
| Arid | Sunny, Foggy |
| Polar | Snowy |

### 3. 地形→时间影响

某些地形会影响时间感知：
- Cave: 永远是 Night
- Forest: Dawn/Dusk 延长

## 实现步骤

### Phase 1: 基础设施
1. 添加 `TerrainBinding` 结构体到 `state_store.rs`
2. 添加 `StateStore` 注入支持到 `WorldManager`
3. 创建地形→场景类型转换函数

### Phase 2: 状态同步
4. 实现 `TerrainStateSync` 系统
5. 在位置移动时触发场景切换
6. 在时间推进时触发天气更新

### Phase 3: 集成测试
7. 添加集成测试
8. 验证地形变更正确反映到 StateStore

## 文件变更计划

| 文件 | 变更 |
|------|------|
| `crates/core/src/state_store.rs` | 添加 terrain_binding 字段 |
| `crates/world/src/managers.rs` | 添加 StateStore 注入 |
| `crates/world/src/terrain.rs` | 添加 terrain→scene 映射 |
| `crates/world/src/lib.rs` | 导出新的类型和函数 |

## API 设计

```rust
// 在 WorldManager 中添加
impl WorldManager {
    /// 注入 StateStore
    pub fn with_state_store(mut self, state_store: StateStore) -> Self;
    
    /// 同步地形状态到 StateStore
    pub async fn sync_terrain_to_state(&self);
    
    /// 获取当前地形的场景类型
    pub fn get_current_scene_type(&self) -> String;
    
    /// 根据地形的天气系统
    pub fn get_terrain_weather(&self) -> String;
}
```
