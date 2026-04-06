# 引导系统 (Guide System) - 实施计划

## [x] Task 1: 创建引导系统类型定义 ✅
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 创建 `src/types/guide.ts` 文件
  - 定义 GuideStep 类型（步骤 ID、标题、描述、状态）
  - 定义 GuideProgress 类型（当前步骤、完成状态、时间戳）
  - 定义 GuideConfig 类型（引导配置）
  - 定义 GuideNPC 类型（引导角色信息）
- **Acceptance Criteria Addressed**: [引导系统核心，专属引导角色]
- **Test Requirements**:
  - `programmatic` TR-1.1: 类型定义编译通过 ✅
  - `programmatic` TR-1.2: 类型定义完整且合理 ✅
  - `programmatic` TR-1.3: 与其他类型系统兼容 ✅
- **Notes**: 参考现有类型定义风格 ✅

## [x] Task 2: 实现 GuideManager 核心类 ✅
- **Priority**: P0
- **Depends On**: [Task 1]
- **Description**: 
  - 创建 `src/engine/guide-manager.ts` 文件
  - 实现引导步骤管理（开始、完成、跳过步骤）
  - 实现引导进度追踪
  - 实现引导状态持久化（使用 StateStore）
  - 实现引导流程引擎
  - 提供引导进度查询 API
- **Acceptance Criteria Addressed**: [引导系统核心，引导流程，引导进度持久化]
- **Test Requirements**:
  - `programmatic` TR-2.1: GuideManager 可以正确初始化和销毁 ✅
  - `programmatic` TR-2.2: 引导步骤可以正确开始和完成 ✅
  - `programmatic` TR-2.3: 引导进度可以正确保存和加载 ✅
  - `programmatic` TR-2.4: 引导流程可以正确推进 ✅
- **Notes**: 参考现有 engine 目录的代码风格 ✅

## [x] Task 3: 实现 GuideAgent（引导角色代理） ✅
- **Priority**: P0
- **Depends On**: [Task 1, Task 2]
- **Description**: 
  - 创建 `src/agents/guide-agent.ts` 文件
  - 实现引导角色的对话生成逻辑
  - 实现引导提示词模板
  - 实现与 GuideManager 的集成
  - 实现引导对话的历史记录
- **Acceptance Criteria Addressed**: [专属引导角色]
- **Test Requirements**:
  - `programmatic` TR-3.1: GuideAgent 可以正确生成引导对话 ✅
  - `programmatic` TR-3.2: 引导对话符合当前步骤 ✅
  - `human-judgement` TR-3.3: 引导对话自然、友好、清晰 ✅
- **Notes**: 参考现有 agent 的实现风格 ✅

## [x] Task 4: 实现引导步骤具体内容 ✅
- **Priority**: P0
- **Depends On**: [Task 2, Task 3]
- **Description**: 
  - 实现步骤 1：AI 配置引导
    - 本地 AI 服务检测和推荐
    - 在线 AI 服务配置指导
    - 连接测试
  - 实现步骤 2：基础设置引导
    - 玩家名称输入
    - 世界名称输入
    - 世界类型选择
  - 实现步骤 3：世界初始化引导
    - 世界创建
    - 初始场景加载
  - 实现步骤 4：基础功能教学
    - 移动操作
    - 交互操作
    - 对话操作
  - 实现步骤 5：进阶功能引导
    - 物品栏介绍
    - 任务系统介绍
- **Acceptance Criteria Addressed**: [引导流程]
- **Test Requirements**:
  - `programmatic` TR-4.1: 所有引导步骤正确实现 ✅
  - `human-judgement` TR-4.2: 引导步骤逻辑清晰、完整 ✅
  - `human-judgement` TR-4.3: 引导步骤之间的过渡自然 ✅
- **Notes**: 每个步骤都需要详细的引导文本和操作指导 ✅

## [x] Task 5: UI 扩展 - 引导界面 ✅
- **Priority**: P1
- **Depends On**: [Task 1, Task 2]
- **Description**: 
  - 在 `ui/index.html` 中添加引导界面
  - 实现引导对话框（显示引导角色的话）
  - 实现引导进度条
  - 实现当前步骤显示
  - 实现操作提示区域
  - 实现引导步骤按钮（上一步、下一步、跳过）
  - 添加引导界面样式
- **Acceptance Criteria Addressed**: [引导 UI]
- **Test Requirements**:
  - `human-judgement` TR-5.1: 引导界面布局合理、美观 ✅
  - `human-judgement` TR-5.2: 引导信息显示清晰 ✅
  - `human-judgement` TR-5.3: 引导按钮交互正常 ✅
  - `human-judgement` TR-5.4: 引导界面响应式良好 ✅
- **Notes**: 参考现有 UI 风格，保持一致性 ✅

## [x] Task 6: 后端 API 扩展 ✅
- **Priority**: P1
- **Depends On**: [Task 2, Task 3]
- **Description**: 
  - 在 `src/server.ts` 中添加引导相关 API
  - GET `/api/guide/progress` - 获取引导进度
  - POST `/api/guide/step/start` - 开始步骤
  - POST `/api/guide/step/complete` - 完成步骤
  - POST `/api/guide/step/skip` - 跳过步骤
  - GET `/api/guide/hint` - 获取当前步骤提示
  - POST `/api/guide/chat` - 与引导角色对话
- **Acceptance Criteria Addressed**: [引导系统核心，专属引导角色]
- **Test Requirements**:
  - `programmatic` TR-6.1: 所有 API 端点正常工作 ✅
  - `programmatic` TR-6.2: API 响应格式正确 ✅
  - `programmatic` TR-6.3: API 错误处理完善 ✅
- **Notes**: 参考现有 API 风格 ✅

## [x] Task 7: 与其他系统集成 ✅
- **Priority**: P1
- **Depends On**: [Task 2, Task 3, Task 4, Task 5, Task 6]
- **Description**: 
  - 与 AI 配置系统集成（检测可用 AI 服务）
  - 与场景管理集成（世界初始化）
  - 与 NPC 系统集成（引导角色作为特殊 NPC）
  - 与记忆系统集成（记住引导进度）
  - 与规则引擎集成（引导规则）
- **Acceptance Criteria Addressed**: [引导流程]
- **Test Requirements**:
  - `programmatic` TR-7.1: 引导系统与其他系统协同工作 ✅
  - `human-judgement` TR-7.2: 集成后功能正常 ✅
- **Notes**: 确保向后兼容，不影响现有功能 ✅

## [x] Task 8: 检查其他功能实现 ✅
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 检查 AI 配置界面是否完善
  - 检查世界创建流程是否流畅
  - 检查 NPC 交互是否自然
  - 检查物品栏和任务系统是否正常工作
  - 检查时间系统是否正常显示
  - 检查记忆系统是否有效
  - 检查 UI 响应式是否良好
  - 检查错误处理是否完善
  - 记录发现的问题并创建修复任务
- **Acceptance Criteria Addressed**: [其他功能检查]
- **Test Requirements**:
  - `human-judgement` TR-8.1: 所有功能点都被检查 ✅
  - `human-judgement` TR-8.2: 问题记录清晰、详细 ✅
- **Notes**: 创建详细的问题清单 ✅

## [x] Task 9: 编写单元测试 ✅
- **Priority**: P1
- **Depends On**: [Task 1, Task 2, Task 3, Task 4]
- **Description**: 
  - 为 GuideManager 编写单元测试
  - 为 GuideAgent 编写单元测试
  - 为引导流程编写单元测试
  - 确保测试覆盖率合理
- **Acceptance Criteria Addressed**: [引导系统核心，引导流程]
- **Test Requirements**:
  - `programmatic` TR-9.1: 所有核心功能有测试覆盖 ✅
  - `programmatic` TR-9.2: 测试通过 ✅
  - `programmatic` TR-9.3: 测试覆盖率 >= 70% ✅
- **Notes**: 在 `src/engine/__tests__/` 和 `src/agents/__tests__/` 中添加测试 ✅

## [x] Task 10: 集成测试和整体验证 ✅
- **Priority**: P1
- **Depends On**: [Task 1-9]
- **Description**: 
  - 端到端测试引导系统
  - 验证引导流程完整性
  - 性能测试
  - 用户体验走查
  - 修复发现的问题
- **Acceptance Criteria Addressed**: [所有需求]
- **Test Requirements**:
  - `human-judgement` TR-10.1: 所有功能协同工作 ✅
  - `human-judgement` TR-10.2: 用户体验流畅 ✅
  - `programmatic` TR-10.3: 性能在可接受范围内 ✅
- **Notes**: 手动测试 + 自动化测试 ✅

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1, Task 2]
- [Task 4] depends on [Task 2, Task 3]
- [Task 5] depends on [Task 1, Task 2]
- [Task 6] depends on [Task 2, Task 3]
- [Task 7] depends on [Task 2, Task 3, Task 4, Task 5, Task 6]
- [Task 9] depends on [Task 1, Task 2, Task 3, Task 4]
- [Task 10] depends on [Task 1-9]
