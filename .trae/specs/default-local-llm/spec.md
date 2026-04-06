# 默认使用本地大模型进行测试 Spec

## Why
当前项目默认使用 Ollama，但测试时经常遇到模型未找到的问题。为了方便开发和测试，需要让项目能够自动检测并使用本地可用的大模型服务（如 LM Studio、Jan、Ollama 等），无需手动配置即可进行测试。

## What Changes
- 修改 ProviderFactory 的默认配置逻辑，优先尝试本地模型服务
- 添加本地模型服务自动检测机制
- 创建测试专用的环境变量配置
- 更新文档说明如何快速开始测试

## Impact
- Affected specs: fix-code-issues
- Affected code: `src/providers/provider-factory.ts`, `.env.example`, `src/server.ts`

## ADDED Requirements

### Requirement: 本地模型服务自动检测
系统 SHALL 自动检测并优先使用本地可用的大模型服务。

#### Scenario: Success case
- **WHEN** 系统启动时
- **THEN** 按优先级检测 LM Studio (port 1234) → Jan (port 1337) → Ollama (port 11434)
- **AND** 自动选择第一个可用的服务作为默认 Provider

### Requirement: 测试专用配置
系统 SHALL 提供测试专用的配置，无需手动设置环境变量。

#### Scenario: Success case
- **WHEN** 运行测试或开发服务器时
- **THEN** 如果没有配置环境变量，自动使用本地模型检测逻辑
- **AND** 输出检测到的服务信息

### Requirement: 友好的错误提示
当没有可用的本地模型服务时，系统 SHALL 提供清晰的错误提示和解决方案。

#### Scenario: Success case
- **WHEN** 没有检测到任何本地模型服务
- **THEN** 输出友好的错误信息，包含：
  - 推荐的本地模型服务（LM Studio、Jan、Ollama）
  - 安装和启动指南
  - 如何配置环境变量的说明
