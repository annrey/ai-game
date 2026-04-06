# 酒馆模式第二阶段 - 实施计划

## [ ] Task 1: 实现 NPC 日程表系统
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 设计 NPCSchedule 类型定义
  - 实现日程配置（不同时间段的活动安排）
  - 实现 NPC 进出酒馆逻辑
  - 与现有时间系统协同
  - 在 NPC-Director 中集成日程管理
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `programmatic` TR-1.1: 日程类型定义完整
  - `programmatic` TR-1.2: NPC 根据时间正确切换活动
  - `programmatic` TR-1.3: NPC 进出酒馆逻辑正确
  - `programmatic` TR-1.4: 日程配置可扩展
- **Notes**: 修改 src/agents/npc-director.ts, 新增 src/types/schedule.ts

## [ ] Task 2: 实现 NPC 关系网络
- **Priority**: P0
- **Depends On**: [Task 1]
- **Description**: 
  - 设计 Relationship 类型（友好、中立、敌对）
  - 实现 NPC 之间的关系存储
  - 关系影响 NPC 对话生成
  - 玩家行为改变关系的机制
  - 关系可视化（UI 展示）
- **Acceptance Criteria Addressed**: [AC-2]
- **Test Requirements**:
  - `programmatic` TR-2.1: 关系类型定义完整
  - `programmatic` TR-2.2: 关系存储和读取正确
  - `human-judgement` TR-2.3: 关系影响 NPC 对话
  - `programmatic` TR-2.4: 玩家行为可改变关系
- **Notes**: 修改 src/agents/npc-director.ts, 新增 src/types/relationship.ts

## [ ] Task 3: 实现迷你游戏系统 - 骰子游戏
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 设计 MiniGame 基础类型
  - 实现骰子游戏逻辑（猜大小）
  - 与 Rule-Arbiter 协同处理游戏规则
  - 游戏结果影响玩家状态（金币）
  - UI 支持游戏交互
- **Acceptance Criteria Addressed**: [AC-3]
- **Test Requirements**:
  - `programmatic` TR-3.1: 迷你游戏类型定义完整
  - `programmatic` TR-3.2: 骰子游戏逻辑正确
  - `programmatic` TR-3.3: 游戏结果正确处理
  - `human-judgement` TR-3.4: 游戏体验流畅
- **Notes**: 新增 src/games/dice-game.ts, src/types/game.ts

## [ ] Task 4: 实现基础经济系统
- **Priority**: P1
- **Depends On**: [Task 3]
- **Description**: 
  - 扩展 PlayerState 添加金币字段
  - 实现商品/物品定义
  - 实现购买逻辑
  - 实现小费机制
  - 库存管理增强
  - UI 显示金币和商店
- **Acceptance Criteria Addressed**: [AC-4]
- **Test Requirements**:
  - `programmatic` TR-4.1: 金币系统正常工作
  - `programmatic` TR-4.2: 购买逻辑正确
  - `programmatic` TR-4.3: 小费机制正确
  - `programmatic` TR-4.4: 库存管理正确
- **Notes**: 修改 src/types/scene.ts, src/engine/state-store.ts, ui/index.html

## [ ] Task 5: 实现环境交互系统
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 扩展 EnvironmentState 添加天气系统
  - 实现天气变化逻辑（与 time 协同）
  - 天气影响 NPC 行为和心情
  - 实现可交互物体（钢琴、壁炉等）
  - 环境音效提示
  - UI 显示当前环境状态
- **Acceptance Criteria Addressed**: [AC-5]
- **Test Requirements**:
  - `programmatic` TR-5.1: 天气系统正常工作
  - `programmatic` TR-5.2: 天气影响 NPC 行为
  - `programmatic` TR-5.3: 可交互物体逻辑正确
  - `human-judgement` TR-5.4: 环境体验沉浸
- **Notes**: 修改 src/types/scene.ts, src/agents/world-keeper.ts, ui/index.html

## [ ] Task 6: 集成测试和验证
- **Priority**: P1
- **Depends On**: [Task 1, Task 2, Task 3, Task 4, Task 5]
- **Description**: 
  - 编写单元测试覆盖新功能
  - 端到端测试第二阶段功能
  - 验证与第一阶段向后兼容
  - 性能测试
  - 用户体验走查
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3, AC-4, AC-5]
- **Test Requirements**:
  - `programmatic` TR-6.1: 所有新功能有测试覆盖
  - `programmatic` TR-6.2: 测试通过
  - `human-judgement` TR-6.3: 功能协同工作
  - `programmatic` TR-6.4: 向后兼容
- **Notes**: 在 __tests__/ 目录添加测试
