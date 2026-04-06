# 修复本地大模型测试问题 Spec

## Why
在本地大模型测试过程中发现了三个主要问题：1) demo.ts 配置加载不一致；2) 本地模型超时时间过短；3) 代理顺序调用导致响应慢。这些问题影响了开发测试体验和性能，需要系统性修复。

## What Changes
- 统一配置加载逻辑，让 demo.ts 支持 .env.test.local
- 为本地模型添加专用超时配置（默认 120 秒）
- 实现代理并行调用优化，减少响应时间
- 添加重试机制增强稳定性

## Impact
- Affected specs: default-local-llm
- Affected code: `src/demo.ts`, `src/providers/ollama-provider.ts`, `src/agents/narrator.ts`, `src/constants.ts`

## ADDED Requirements

### Requirement: 统一配置加载
系统 SHALL 让 demo.ts 和 server.ts 使用一致的配置加载逻辑。

#### Scenario: Success case
- **WHEN** 运行 `npm run demo`
- **THEN** 自动加载 `.env.test.local`（如果存在）
- **AND** 配置优先级：环境变量 > .env.test.local > .env

### Requirement: 本地模型超时配置
系统 SHALL 为本地模型服务设置更长的默认超时时间。

#### Scenario: Success case
- **WHEN** 使用 Ollama/LM Studio/Jan 等本地模型
- **THEN** 默认请求超时为 120 秒
- **AND** 可通过环境变量覆盖

### Requirement: 代理并行调用
系统 SHALL 并行调用独立的代理以提升响应速度。

#### Scenario: Success case
- **WHEN** Narrator 协调多个子代理时
- **THEN** 独立的代理并行执行
- **AND** 整体响应时间减少 30-50%

### Requirement: 重试机制
系统 SHALL 在模型调用失败时自动重试。

#### Scenario: Success case
- **WHEN** 模型调用失败（非 4xx 错误）
- **THEN** 自动重试最多 3 次
- **AND** 使用指数退避策略
