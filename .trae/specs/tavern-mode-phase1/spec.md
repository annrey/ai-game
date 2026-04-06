# 酒馆模式第一阶段 - 产品需求文档

## Overview
- **Summary**: 实现酒馆模式的第一阶段迭代，快速提升游戏世界的真实感和沉浸感。包括 NPC 状态显示、简单时间系统、基础 NPC 记忆，以及增强版世界知识管理（借鉴 SillyTavern Lorebook 机制）。
- **Purpose**: 验证世界真实感提升的核心概念，通过最小可行产品快速获得反馈，为后续阶段奠定基础。
- **Target Users**: 新手探索者、故事爱好者、技术爱好者（所有主要用户画像）。

## Goals
- **Goal 1**: NPC 状态可视化 - 让 NPC 显示当前活动和心情状态
- **Goal 2**: 时间系统 - 实现昼夜显示和时间流逝
- **Goal 3**: NPC 基础记忆 - 让 NPC 记住与玩家的关键对话
- **Goal 4**: 增强版世界知识管理 - 基于现有 rule-engine 增强，借鉴 SillyTavern Lorebook 机制

## Non-Goals (Out of Scope)
- 不实现完整的 NPC 日程系统（第二阶段）
- 不实现 NPC 关系网络（第二阶段）
- 不实现迷你游戏（第二阶段）
- 不实现经济系统（第二阶段）
- 不实现多场景扩展（第三阶段）
- 不进行大规模 UI 重构（仅必要的状态展示）

## Background & Context
基于前期探索任务的完整分析（`world-realness-exploration/` 目录），我们确定：
- 项目已有非常好的基础架构（rule-engine、memory-manager、5个代理协作）
- 酒馆模式是理想的试验场（小场景、封闭环境、社交天然适合）
- SillyTavern 的 Lorebook 机制可以直接借鉴到现有规则引擎
- 第一阶段应聚焦于能快速验证价值且改动最小的功能

现有可复用组件：
- `rule-engine.ts` - 已有常驻规则、关键词匹配基础
- `memory-manager.ts` - 已有记忆管理系统
- `NPC-Director` - 已有 NPC 管理基础
- `World-Keeper` - 已有世界状态管理
- `state-store.ts` - 已有状态持久化
- `world-auto-iteration` spec - 可协同的心跳机制

## Functional Requirements
- **FR-1**: NPC 状态显示系统
  - NPC 显示当前活动描述（如"正在擦杯子"、"独自饮酒"）
  - NPC 显示心情状态（😊 😐 😠 等表情或文字）
  - NPC 状态可随时间和互动变化
  - UI 右侧面板展示 NPC 状态

- **FR-2**: 简单时间系统
  - 游戏内时间流逝（与现实时间或回合数对应）
  - 昼夜显示（早晨、中午、下午、晚上、深夜）
  - 时间影响 NPC 状态和活动
  - 与 world-auto-iteration spec 协同

- **FR-3**: 基础 NPC 记忆
  - NPC 记住与玩家的关键对话
  - 对话中引用过去的互动
  - 利用现有 memory-manager.ts
  - 记忆有重要性评分

- **FR-4**: 增强版世界知识管理（Lorebook 增强）
  - 在 RuleNode 中增加正则表达式支持
  - 完善优先级管理（insertionOrder）
  - 增加插入位置控制
  - Token 预算优化
  - 与现有 rule-engine.ts 向后兼容

## Non-Functional Requirements
- **NFR-1**: 本地 AI 性能 - 确保增强功能不会过度影响响应速度
- **NFR-2**: 向后兼容 - 不破坏现有功能和 API
- **NFR-3**: 可配置性 - 新功能可通过配置开关控制
- **NFR-4**: 可测试性 - 核心逻辑有单元测试覆盖

## Constraints
- **Technical**: 必须基于现有 TypeScript/Node.js 架构
- **Business**: 1-2 周内可实现并验证
- **Dependencies**: 依赖现有代理系统、规则引擎、记忆系统

## Assumptions
- 现有 rule-engine.ts 的基础足够稳定，可以增强
- memory-manager.ts 可以直接用于 NPC 记忆
- 本地 AI 性能足够支持这些增强
- 用户会欣赏这些小而有意义的改进

## Acceptance Criteria

### AC-1: NPC 状态显示正常
- **Given**: 酒馆模式已启动，有 NPC 在场
- **When**: 用户查看 NPC 或与 NPC 互动
- **Then**: UI 显示 NPC 的当前活动描述和心情状态
- **Verification**: `human-judgment`
- **Notes**: 状态应自然合理，与场景相符

### AC-2: 时间系统正常工作
- **Given**: 游戏正在运行
- **When**: 时间流逝（通过回合或闲置）
- **Then**: 时间显示更新，昼夜变化，NPC 状态相应调整
- **Verification**: `programmatic` + `human-judgment`
- **Notes**: 时间流逝应明显但不突兀

### AC-3: NPC 能够记住关键对话
- **Given**: NPC 与玩家有过对话
- **When**: 玩家后续对话提及之前的内容
- **Then**: NPC 能够引用或提到之前的互动
- **Verification**: `human-judgment`
- **Notes**: 不需要记住所有细节，记住关键点即可

### AC-4: 增强版规则引擎正常工作
- **Given**: 规则引擎已加载世界规则
- **When**: 场景触发关键词或正则表达式
- **Then**: 正确的规则被触发并插入上下文
- **Verification**: `programmatic`
- **Notes**: 向后兼容现有规则格式

### AC-5: 整体体验流畅
- **Given**: 用户正在使用第一阶段功能
- **When**: 用户进行正常游戏
- **Then**: 响应速度可接受，功能稳定，无明显 bug
- **Verification**: `human-judgment`

## Open Questions
- [ ] 时间流逝是与现实时间对应还是与回合数对应？
- [ ] NPC 心情状态有多少个级别？
- [ ] 规则增强是否需要 UI 编辑器，还是先通过代码配置？
