# 修复严重问题 - The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 修复 local-provider.ts 中的硬编码问题
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 修复硬编码的端点，使用配置的 this.endpoint
  - 修复硬编码的模型名称，使用配置的 defaultModel 或传入的 options.model
  - 修复 API 请求格式，使其符合 OpenAI 兼容的标准
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3]
- **Test Requirements**:
  - `programmatic` TR-1.1: 验证 LocalProvider 使用配置的 endpoint
  - `programmatic` TR-1.2: 验证 LocalProvider 使用配置的 model
  - `programmatic` TR-1.3: 验证 API 请求格式正确
- **Notes**: 保持向后兼容，只修复必要部分

## [x] Task 2: 验证修复是否成功
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 运行现有测试，确保没有破坏其他功能
  - 检查代码编译是否通过
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3]
- **Test Requirements**:
  - `programmatic` TR-2.1: 所有测试通过
  - `programmatic` TR-2.2: TypeScript 编译无错误
