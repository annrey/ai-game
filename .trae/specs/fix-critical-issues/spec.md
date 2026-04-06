# 修复严重问题 - Product Requirement Document

## Overview
- **Summary**: 修复代码审查中发现的最严重问题，即 `local-provider.ts` 中的硬编码问题。
- **Purpose**: 解决 LocalProvider 无法正常工作的问题，使其能够正确使用用户配置的端点和模型。
- **Target Users**: 开发者和使用 LocalProvider 的用户

## Goals
- 修复 `local-provider.ts` 中的硬编码端点问题
- 修复 `local-provider.ts` 中的硬编码模型名称问题
- 确保 LocalProvider 能够正确使用配置参数

## Non-Goals (Out of Scope)
- 不修复中等或轻微问题
- 不进行代码重构
- 不添加新功能
- 不修改测试

## Background & Context
- 在代码审查中发现 `local-provider.ts` 存在严重的硬编码问题
- 该问题导致 LocalProvider 无法正常工作，无视用户配置
- 这是最严重的问题，需要优先修复

## Functional Requirements
- **FR-1**: LocalProvider 应使用配置的 endpoint 而不是硬编码的值
- **FR-2**: LocalProvider 应使用配置的 model 而不是硬编码的值
- **FR-3**: LocalProvider 应正确处理 OpenAI 兼容的 API 格式

## Non-Functional Requirements
- **NFR-1**: 修复后的代码应向后兼容
- **NFR-2**: 修复不应影响其他 Provider 的功能

## Constraints
- **Technical**: 仅修改 `src/providers/local-provider.ts` 文件
- **Business**: 尽快修复，不引入新问题
- **Dependencies**: 无

## Assumptions
- LocalProvider 旨在与 OpenAI 兼容的 API 配合使用
- 配置的 endpoint 应该是 OpenAI 兼容的基础 URL

## Acceptance Criteria

### AC-1: LocalProvider 使用配置的 endpoint
- **Given**: LocalProvider 配置了自定义 endpoint
- **When**: 调用 chat() 或 stream() 方法
- **Then**: 请求应发送到配置的 endpoint，而不是硬编码的 http://localhost:1234/api/v1/chat
- **Verification**: `programmatic`

### AC-2: LocalProvider 使用配置的 model
- **Given**: LocalProvider 配置了自定义 model 或通过 options 传入了 model
- **When**: 调用 chat() 或 stream() 方法
- **Then**: 请求应使用配置的 model，而不是硬编码的 "mythomax-l2-kimiko-v2-13b"
- **Verification**: `programmatic`

### AC-3: LocalProvider 使用正确的 API 格式
- **Given**: LocalProvider 配置正确
- **When**: 调用 chat() 方法
- **Then**: 请求体应符合 OpenAI 兼容的 API 格式（使用 messages 数组而不是 system_prompt 和 input 字段）
- **Verification**: `programmatic`

## Open Questions
- [ ] LocalProvider 原本设计与什么 API 配合使用？（OpenAI 兼容 vs 其他格式）
