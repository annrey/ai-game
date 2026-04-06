# 引导系统 (Guide System) Spec

## Why
当前项目缺少一个完善的引导系统，新玩家在开始游戏时可能不知道如何配置本地 AI 或在线 AI，也不清楚如何开始自己的世界。需要一个专属的引导角色来引导玩家从配置 AI 开始，一步步完成初始化并进入游戏世界。同时需要检查其他功能实现不到位的地方。

## What Changes
- 实现引导系统核心架构（GuideManager）
- 创建专属引导角色（Guide NPC）
- 实现引导流程引擎（从 AI 配置到世界创建）
- 实现引导步骤 UI 显示
- 实现引导进度持久化
- 检查并修复其他功能实现不到位的地方

## Impact
- Affected specs: ai-game-integration, default-local-llm, tavern-mode-phase1
- Affected code: `src/engine/guide-manager.ts`, `src/agents/guide-agent.ts`, `ui/index.html`, `src/types/guide.ts`, `src/server.ts`

## ADDED Requirements

### Requirement: 引导系统核心
系统 SHALL 提供引导管理器来管理整个引导流程。

#### Scenario: Success case
- **WHEN** 玩家首次启动游戏
- **THEN** 引导系统自动激活，显示引导界面
- **AND** 引导玩家完成 AI 配置和世界初始化

### Requirement: 专属引导角色
系统 SHALL 提供一个专属的引导角色（Guide NPC），以自然语言方式引导玩家。

#### Scenario: Success case
- **WHEN** 玩家需要帮助或指导时
- **THEN** 引导角色以友好、清晰的方式提供指导
- **AND** 根据玩家当前进度提供相应的建议

### Requirement: 引导流程
系统 SHALL 提供结构化的引导流程，包括以下步骤：
1. AI 配置引导（本地 AI 或在线 AI）
2. 基础设置引导（玩家名称、世界名称）
3. 世界初始化引导
4. 基础功能教学（移动、交互、对话）
5. 进阶功能引导（物品栏、任务系统）

#### Scenario: Success case
- **WHEN** 玩家完成当前引导步骤
- **THEN** 自动进入下一个引导步骤
- **AND** 进度被保存，玩家可以随时继续

### Requirement: 引导 UI
系统 SHALL 在 UI 中显示引导信息，包括：
- 当前引导步骤
- 引导进度条
- 引导对话框
- 操作提示

#### Scenario: Success case
- **WHEN** 引导系统激活时
- **THEN** UI 清晰显示当前引导步骤和操作提示
- **AND** 玩家可以与引导界面交互

### Requirement: 引导进度持久化
系统 SHALL 保存玩家的引导进度，允许玩家中断和继续。

#### Scenario: Success case
- **WHEN** 玩家关闭游戏后重新打开
- **THEN** 引导系统从上次中断的步骤继续
- **AND** 已完成的步骤不会重复显示

## MODIFIED Requirements

### Requirement: AI 配置流程优化
在现有的 default-local-llm spec 基础上，增加引导式的 AI 配置流程。

**完整修改后的要求**：
系统 SHALL 提供引导式的 AI 配置流程，帮助玩家轻松配置本地 AI 或在线 AI。

#### Scenario: Success case
- **WHEN** 玩家首次配置 AI 时
- **THEN** 引导系统提供分步指导，包括：
  - 推荐本地 AI 服务（LM Studio、Ollama、Jan）
  - 自动检测可用的本地 AI 服务
  - 提供在线 AI 服务配置选项（如 OpenAI、Anthropic）
  - 测试连接并验证配置
- **AND** 配置完成后自动保存并进入下一步

## REMOVED Requirements
无

## 其他功能检查

### 需要检查的功能点
1. AI 配置界面是否完善
2. 世界创建流程是否流畅
3. NPC 交互是否自然
4. 物品栏和任务系统是否正常工作
5. 时间系统是否正常显示
6. 记忆系统是否有效
7. UI 响应式是否良好
8. 错误处理是否完善
