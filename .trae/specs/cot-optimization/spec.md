# 角色思维链优化与可视化 Spec

## Why

当前 AI 代理系统的思维过程不够透明，玩家无法看到 AI 的决策逻辑。需要优化角色的思维链（Chain of Thought），并在右侧面板中可视化展示 AI 的思考过程，增强游戏的可解释性和沉浸感。同时需要检查 AI 创造任务和物品的规则是否完善。

## What Changes

- **优化思维链结构** - 为每个 AI 代理添加标准化的思维链模板
- **实现思维链可视化** - 在右侧面板添加专门的思维链展示区域
- **思维链提取 API** - 从 AI 响应中解析和提取思维链
- **任务创造规则** - 建立 AI 动态生成任务的规则和验证机制
- **物品创造规则** - 建立 AI 动态生成物品的规则和平衡机制
- **思维链历史记录** - 保存和回溯 AI 的思维过程

## Impact

- Affected specs: ai-game-integration, guide-system, tavern-mode-phase1
- Affected code: `src/agents/base-agent.ts`, `src/agents/*.ts`, `ui/index.html`, `src/server.ts`, `src/engine/game-engine.ts`

## ADDED Requirements

### Requirement: 思维链优化
系统 SHALL 为每个 AI 代理提供标准化的思维链模板，包括：
1. **Observation（观察）** - AI 观察到的当前情境
2. **Analysis（分析）** - AI 对情境的分析和理解
3. **Reasoning（推理）** - AI 的推理过程
4. **Decision（决策）** - AI 做出的决策
5. **Action（行动）** - AI 的具体行动或响应

#### Scenario: Success case
- **WHEN** AI 代理处理玩家请求时
- **THEN** 生成结构化的思维链（CoT）
- **AND** 思维链包含完整的 5 个步骤
- **AND** 思维链可以被提取和展示

### Requirement: 思维链可视化 UI
系统 SHALL 在右侧面板添加思维链展示区域，包括：
- 思维链折叠面板（默认展开当前 AI 的思维）
- 每个步骤的清晰标题和内容
- 思维步骤的时间戳
- AI 代理标识（哪个 AI 的思维）
- 思维链历史滚动列表

#### Scenario: Success case
- **WHEN** AI 生成响应时
- **THEN** 右侧面板自动显示思维链
- **AND** 玩家可以折叠/展开思维链
- **AND** 玩家可以查看历史思维链

### Requirement: 任务创造规则
系统 SHALL 建立 AI 创造任务的规则：
1. **任务生成条件**
   - 玩家行为触发（帮助 NPC、探索地点等）
   - 剧情发展需要
   - 随机事件生成
2. **任务结构验证**
   - 必须有明确的目标
   - 必须有可完成的条件
   - 必须有合理的奖励
3. **任务平衡规则**
   - 任务难度与玩家等级匹配
   - 奖励与难度成正比
   - 不生成破坏游戏平衡的任务

#### Scenario: Success case
- **WHEN** AI 生成新任务时
- **THEN** 任务通过规则验证
- **AND** 任务被添加到玩家任务列表
- **AND** 任务在 UI 中正确显示

### Requirement: 物品创造规则
系统 SHALL 建立 AI 创造物品的规则：
1. **物品生成条件**
   - 任务奖励
   - 探索发现
   - NPC 赠与
   - 商店购买
2. **物品结构验证**
   - 必须有唯一 ID
   - 必须有清晰的描述
   - 必须有合理的类型和效果
3. **物品平衡规则**
   - 物品属性符合游戏世界观
   - 效果数值在合理范围内
   - 不生成破坏经济系统的物品

#### Scenario: Success case
- **WHEN** AI 生成新物品时
- **THEN** 物品通过规则验证
- **AND** 物品被添加到玩家物品栏
- **AND** 物品在 UI 中正确显示

### Requirement: 思维链 API
系统 SHALL 提供思维链相关的 API：
- GET `/api/cot/current` - 获取当前思维链
- GET `/api/cot/history` - 获取思维链历史
- POST `/api/cot/expand` - 展开指定思维链步骤
- GET `/api/cot/stats` - 获取思维链统计信息

#### Scenario: Success case
- **WHEN** 前端请求思维链数据时
- **THEN** 返回结构化的思维链信息
- **AND** 支持分页和过滤

## MODIFIED Requirements

### Requirement: AI 代理响应格式
**原要求**：AI 代理返回 AgentResponse，包含 from、content、usage、metadata

**修改后的要求**：
AI 代理返回 AgentResponse，包含：
- from: AgentRole
- content: string（最终响应内容）
- chainOfThought: ChainOfThought（思维链）
- usage: TokenUsage
- metadata: Record<string, unknown>

**BREAKING**: 需要更新所有调用 AgentResponse 的代码以处理新增的 chainOfThought 字段

## REMOVED Requirements

无

## 技术实现方案

### 1. 思维链数据结构

```typescript
interface ChainOfThought {
  id: string;
  agentRole: AgentRole;
  timestamp: number;
  steps: CoTStep[];
  summary: string;
}

interface CoTStep {
  step: 'observation' | 'analysis' | 'reasoning' | 'decision' | 'action';
  title: string;
  content: string;
  duration?: number; // 思考耗时（毫秒）
}
```

### 2. BaseAgent 增强

在 BaseAgent 中添加：
- `extractChainOfThought(response: string): ChainOfThought` - 从响应中提取思维链
- `buildChainOfThoughtPrompt()`: 生成引导思维链的提示词

### 3. UI 扩展

在右侧面板添加：
```html
<details class="panel-section" data-panel="chain-of-thought">
  <summary>🧠 思维链</summary>
  <div id="cotContainer"></div>
</details>
```

### 4. 任务/物品验证器

创建验证器类：
- `QuestValidator` - 验证任务合法性
- `ItemValidator` - 验证物品合法性
