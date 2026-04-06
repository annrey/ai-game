# 酒馆模式第二阶段 - 产品需求文档

## Overview
- **Summary**: 在第一阶段基础上，实现深度沉浸功能，包括动态 NPC 日程表、NPC 关系网络、迷你游戏、基础经济系统和环境交互。让酒馆成为真实的社交场所。
- **Purpose**: 建立丰富的互动系统，让 NPC 有自己的生活，提供多种互动方式。
- **Target Users**: 故事爱好者、内容创作者、社交玩家。

## Goals
- **Goal 1**: 动态 NPC 日程表 - NPC 在不同时间做不同事情，进出酒馆
- **Goal 2**: NPC 关系网络 - NPC 之间互动，对话反映关系，简单好感度系统
- **Goal 3**: 迷你游戏 - 骰子游戏、简单卡牌游戏，增强参与感
- **Goal 4**: 基础经济系统 - 购买饮品、小费系统
- **Goal 5**: 环境交互 - 天气变化、可交互物体、环境影响心情

## Non-Goals (Out of Scope)
- 不实现多场景扩展（第三阶段）
- 不实现完整任务系统（第三阶段）
- 不实现复杂战斗系统
- 不进行大规模架构重构

## Background & Context
基于第一阶段的成功实现：
- ✅ 规则引擎增强（正则表达式、优先级管理）
- ✅ NPC 状态管理（活动、心情）
- ✅ 基础 NPC 记忆
- ✅ 时间系统基础

第二阶段将在此基础上增加更复杂的互动系统。

## Functional Requirements

- **FR-1**: 动态 NPC 日程表
  - NPC 根据时间有不同的日程安排
  - NPC 会进入和离开酒馆
  - 日程可配置和扩展
  - 与现有时间系统协同

- **FR-2**: NPC 关系网络
  - NPC 之间有关系状态（友好、中立、敌对）
  - 关系影响 NPC 对话和行为
  - 玩家行为可以改变 NPC 关系
  - 关系可视化展示

- **FR-3**: 迷你游戏系统
  - 骰子游戏（猜大小、特定点数）
  - 简单的卡牌游戏
  - 游戏规则可配置
  - 与 Rule-Arbiter 协同

- **FR-4**: 基础经济系统
  - 货币系统（金币）
  - 购买饮品和物品
  - 小费机制
  - 简单库存管理

- **FR-5**: 环境交互
  - 天气系统（晴天、雨天、雾天等）
  - 天气影响 NPC 行为和心情
  - 可交互的简单物体（钢琴、壁炉等）
  - 环境音效提示

## Non-Functional Requirements
- **NFR-1**: 向后兼容 - 不破坏第一阶段功能
- **NFR-2**: 可配置性 - 新功能可通过配置开关控制
- **NFR-3**: 性能 - 本地 AI 响应时间 < 3 秒
- **NFR-4**: 可测试性 - 核心逻辑有单元测试覆盖

## Constraints
- **Technical**: 基于现有 TypeScript/Node.js 架构
- **Timeline**: 3-4 周内实现
- **Dependencies**: 依赖第一阶段功能、现有代理系统

## Assumptions
- 第一阶段功能稳定可用
- 用户对更复杂的互动有需求
- 本地 AI 性能可以支撑更多功能

## Acceptance Criteria

### AC-1: NPC 日程表正常工作
- **Given**: 酒馆中有多个 NPC
- **When**: 时间流逝到不同时段
- **Then**: NPC 根据日程表进行不同活动，有些会离开/进入酒馆
- **Verification**: `human-judgment`

### AC-2: NPC 关系网络影响互动
- **Given**: 两个 NPC 有关系设定
- **When**: 玩家与其中一个 NPC 对话提及另一个
- **Then**: NPC 的反应反映他们之间的关系
- **Verification**: `human-judgment`

### AC-3: 迷你游戏可正常游玩
- **Given**: 玩家发起迷你游戏
- **When**: 按照规则进行游戏
- **Then**: 游戏逻辑正确，有胜负判定，影响游戏状态（金币等）
- **Verification**: `programmatic` + `human-judgment`

### AC-4: 经济系统正常工作
- **Given**: 玩家有金币，酒馆有商品
- **When**: 玩家购买商品或给小费
- **Then**: 金币正确增减，商品进入库存
- **Verification**: `programmatic`

### AC-5: 环境交互生效
- **Given**: 环境状态变化（如下雨）
- **When**: NPC 进行活动
- **Then**: NPC 行为和心情受环境影响
- **Verification**: `human-judgment`

## Open Questions
- [ ] NPC 日程表的粒度（小时级还是阶段级）？
- [ ] 关系网络是全局还是场景内？
- [ ] 迷你游戏需要多少种？
- [ ] 经济系统的复杂度（是否需要商店 NPC）？
