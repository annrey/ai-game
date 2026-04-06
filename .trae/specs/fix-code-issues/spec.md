# 代码问题修复计划 (Fix Code Issues) Spec

## Why
基于代码审查报告中发现的问题，需要系统性地修复这些问题以提高代码质量、可维护性和稳定性。按照严重程度优先修复严重和中等问题，再处理轻微问题。

## What Changes
- 修复 Quest ID 类型不匹配问题
- 完善 JSON 解析错误处理机制
- 增强类型安全性
- 改进错误处理和上报
- 优化流式响应错误处理
- 提取公共方法减少代码重复
- 替换魔法数字为命名常量

## Impact
- Affected specs: code-review
- Affected code: 
  - `src/engine/scene-manager.ts`
  - `src/engine/game-engine.ts`
  - `src/engine/state-store.ts`
  - `src/agents/narrator.ts`
  - `src/server.ts`

## ADDED Requirements

### Requirement: 修复 Quest ID 类型不匹配
系统 SHALL 修复 scene-manager.ts 中的任务 ID 处理问题，确保 ID 生成和查找的一致性。

#### Scenario: Success case
- **WHEN** 创建新任务时
- **THEN** 使用 uuidv4() 生成内部 ID，将传入的 questId 作为独立字段存储
- **AND** 任务查找时优先匹配 questId 字段

### Requirement: 完善 JSON 解析错误处理
系统 SHALL 在 game-engine.ts 中添加更健壮的错误处理和恢复机制。

#### Scenario: Success case
- **WHEN** 状态解析 JSON 失败时
- **THEN** 记录详细错误日志
- **AND** 不更新任何状态（原子性操作）
- **AND** 返回错误信息供上层处理

### Requirement: 增强类型安全性
系统 SHALL 改进 state-store.ts 中的 patch 方法类型定义。

#### Scenario: Success case
- **WHEN** 使用 patch 方法更新状态
- **THEN** 提供编译时类型检查
- **AND** 避免使用 any 类型

### Requirement: 改进代理协调错误处理
系统 SHALL 在 narrator.ts 中添加代理协调失败的错误上报机制。

#### Scenario: Success case
- **WHEN** 子代理咨询失败时
- **THEN** 记录错误详情
- **AND** 在响应中包含错误信息
- **AND** 提供降级策略（如使用默认行为）

### Requirement: 优化流式响应错误处理
系统 SHALL 改进 server.ts 中流式 API 的错误处理。

#### Scenario: Success case
- **WHEN** 流式响应过程中发生错误
- **THEN** 向客户端发送错误标记
- **AND** 确保连接正确关闭

### Requirement: 减少代码重复
系统 SHALL 提取 game-engine.ts 中 processTurn 和 processStreamTurn 的公共逻辑。

#### Scenario: Success case
- **WHEN** 查看修复后的代码
- **THEN** 公共逻辑已提取到独立方法
- **AND** 两个方法调用公共方法

### Requirement: 替换魔法数字
系统 SHALL 将代码中的硬编码数字提取为命名常量。

#### Scenario: Success case
- **WHEN** 查看修复后的代码
- **THEN** 所有魔法数字都有有意义的常量名
- **AND** 常量集中在配置或常量文件中
