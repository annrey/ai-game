# UI 配置与界面完整性审查规格

## Why

需要对现有 UI 的设置界面和导航菜单进行全面审查，识别哪些配置项已经连接到后端 API，哪些是纯前端功能，以及哪些导航菜单项缺少对应的界面实现。

## What Changes

- 审查设置对话框 (settingsDialog) 中的所有配置项
- 审查 AI 架构对话框 (architectureDialog) 中的所有配置项
- 审查塑造世界对话框 (worldForgeDialog) 中的所有配置项
- 审查左侧导航栏中的所有菜单项
- 识别缺少后端支持的配置项
- 识别缺少对应界面的导航项

## Impact

- 影响文件: `/Users/chengyongwei/Documents/openclaw-main/game/ui/index.html`
- 影响文件: `/Users/chengyongwei/Documents/openclaw-main/game/src/server.ts`
- 影响文件: `/Users/chengyongwei/Documents/openclaw-main/game/src/types/game.ts`

## ADDED Requirements

### Requirement: 设置对话框配置项状态追踪

系统 SHALL 提供设置对话框中所有配置项的完整清单，标明每个配置项的状态：
- ✅ 已实现：有后端 API 支持
- ⚠️ 前端 only：仅前端本地存储，无后端同步
- ❌ 未实现：UI 存在但功能未连接

#### Scenario: 显示设置配置项清单
- **WHEN** 审查 settingsDialog 配置项
- **THEN** 输出每个配置项的状态和说明

### Requirement: 导航菜单完整性审查

系统 SHALL 提供左侧导航栏所有菜单项的状态，标明：
- ✅ 已实现：有对应界面和功能
- ❌ 未实现：点击无响应或缺少界面

#### Scenario: 审查导航菜单
- **WHEN** 审查左侧导航栏菜单项
- **THEN** 输出每个菜单项的实现状态

## 当前状态分析

### 一、设置对话框 (settingsDialog) 配置项分析

#### 1. UI 显示设置 (纯前端 ✅)
| 配置项 | 状态 | 说明 |
|--------|------|------|
| 单屏模式 (stSingleScreen) | ⚠️ 前端 only | localStorage 存储，控制 CSS 类 |
| 紧凑布局 (stCompact) | ⚠️ 前端 only | localStorage 存储，控制 CSS 类 |
| 字体大小 (stFontSize) | ⚠️ 前端 only | localStorage 存储，控制 body 类 |
| 叙事摘要行数 (stStoryClamp) | ⚠️ 前端 only | localStorage 存储，CSS 控制 |
| 日志预览条数 (stLogPreview) | ⚠️ 前端 only | localStorage 存储，控制显示数量 |
| 隐藏选项描述 (stHideChoiceDesc) | ⚠️ 前端 only | localStorage 存储，CSS 类控制 |
| 显示侧栏 (stShowSidebar) | ⚠️ 前端 only | localStorage 存储，CSS 类控制 |
| 显示右侧面板 (stShowRightPanel) | ⚠️ 前端 only | localStorage 存储，CSS 类控制 |
| 场景信息 (stShowSceneMeta) | ⚠️ 前端 only | localStorage 存储，CSS 类控制 |
| 委员会在线 (stShowCouncil) | ⚠️ 前端 only | localStorage 存储，CSS 类控制 |
| 推演日志 (stShowReasoning) | ⚠️ 前端 only | localStorage 存储，面板显示控制 |
| 世界状态 (stShowWorld) | ⚠️ 前端 only | localStorage 存储，面板显示控制 |
| 角色状态 (stShowCharacter) | ⚠️ 前端 only | localStorage 存储，面板显示控制 |
| 物品栏 (stShowInventory) | ⚠️ 前端 only | localStorage 存储，面板显示控制 |
| 任务日志 (stShowQuests) | ⚠️ 前端 only | localStorage 存储，面板显示控制 |
| 事件日志 (stShowLog) | ⚠️ 前端 only | localStorage 存储，面板显示控制 |

#### 2. 引擎设置 (部分后端支持 ✅)
| 配置项 | 状态 | 后端 API | 说明 |
|--------|------|----------|------|
| 自动世界演化 (stAutoWorldTick) | ⚠️ 前端 only | ❌ | UI 存在但无后端实现 |
| 闲置触发时长 (stIdleTimeout) | ⚠️ 前端 only | ❌ | UI 存在但无后端实现 |
| 游戏模式 (stGameMode) | ✅ 已实现 | POST /api/config | 支持模式切换 |
| 语言 (stLanguage) | ✅ 已实现 | POST /api/config | 支持语言切换 |
| 流式输出 (stStreaming) | ✅ 已实现 | POST /api/config | 支持开关 |
| 引擎日志 (stEngineLogging) | ✅ 已实现 | POST /api/config | 支持开关 |
| 历史轮数 (stMaxHistoryTurns) | ✅ 已实现 | POST /api/config | 支持配置 |
| 记忆注入预算 (stMemoryMaxChars) | ✅ 已实现 | POST /api/config | 支持配置 |
| 自动存档 (stAutoSaveInterval) | ✅ 已实现 | POST /api/config | 支持配置 |
| 启用代理 (stAgentWorldKeeper等) | ✅ 已实现 | POST /api/config | 支持代理开关 |

#### 3. AI 后端设置 (后端支持 ✅)
| 配置项 | 状态 | 后端 API | 说明 |
|--------|------|----------|------|
| 默认 Provider (stDefaultProvider) | ✅ 已实现 | POST /api/providers/config | 支持切换 |
| 默认模型 (stDefaultModel) | ✅ 已实现 | POST /api/providers/config | 支持设置 |
| 高级配置 (stProviderAdvancedSettings) | ✅ 已实现 | POST /api/providers/config | 支持自定义接口和密钥 |
| 本地模型扫描 (stScanModels) | ✅ 已实现 | GET /api/providers | 支持扫描刷新 |
| 按角色覆盖 (stOverrideNarratorProvider等) | ✅ 已实现 | POST /api/providers/config | 支持角色级配置 |

### 二、AI 架构对话框 (architectureDialog) 配置项分析

| 配置项 | 状态 | 后端 API | 说明 |
|--------|------|----------|------|
| 模式 (archGameMode) | ✅ 已实现 | POST /api/config | 支持模式切换 |
| 默认 Provider (archDefaultProvider) | ✅ 已实现 | POST /api/providers/config | 支持切换 |
| 流式输出 (archStreaming) | ✅ 已实现 | POST /api/config | 支持开关 |
| 引擎日志 (archEngineLogging) | ✅ 已实现 | POST /api/config | 支持开关 |
| 历史轮数 (archMaxHistoryTurns) | ✅ 已实现 | POST /api/config | 支持配置 |
| 记忆预算 (archMemoryMaxChars) | ✅ 已实现 | POST /api/config | 支持配置 |
| 启用代理 (archAgentWorldKeeper等) | ✅ 已实现 | POST /api/config | 支持代理开关 |

### 三、塑造世界对话框 (worldForgeDialog) 配置项分析

| 配置项 | 状态 | 后端 API | 说明 |
|--------|------|----------|------|
| 世界引导 (wfOpenOnboarding) | ✅ 已实现 | 打开 onboardingDialog | 功能正常 |
| 存档保存/加载/重置 | ✅ 已实现 | POST /api/save, /api/load, /api/reset | 功能正常 |
| 记忆查看/搜索/清理 | ✅ 已实现 | GET /api/memories, POST /api/memories/clear | 功能正常 |
| 新会话 | ✅ 已实现 | POST /api/session/new | 功能正常 |
| 规则书 | ✅ 已实现 | GET/POST /api/rulebook | 功能正常 |

### 四、左侧导航栏菜单项分析

| 菜单项 | 状态 | 对应界面 | 说明 |
|--------|------|----------|------|
| 当前冒险 | ✅ 已实现 | 主界面 | 功能正常 |
| 故事存档 | ❌ 未实现 | 无 | 点击无响应 |
| 成就 | ❌ 未实现 | 无 | 点击无响应 |
| 设置 | ✅ 已实现 | settingsDialog | 功能正常 |
| 塑造世界 | ✅ 已实现 | worldForgeDialog | 功能正常 |
| AI 架构 | ✅ 已实现 | architectureDialog | 功能正常 |
| 世界地图 | ❌ 未实现 | 无 | 点击无响应 |
| 角色卡 | ❌ 未实现 | 无 | 点击无响应 |
| 传说典籍 | ❌ 未实现 | 无 | 点击无响应 |

### 五、顶部按钮分析

| 按钮 | 状态 | 对应界面 | 说明 |
|------|------|----------|------|
| 创建世界 | ✅ 已实现 | onboardingDialog | 功能正常 |
| 单屏 | ✅ 已实现 | 纯前端 | 功能正常 |
| 历史 | ✅ 已实现 | historyDialog | 功能正常 |
| 设置 | ✅ 已实现 | settingsDialog | 功能正常 |
| 菜单 | ✅ 已实现 | 移动端侧边栏 | 功能正常 |
| 状态 | ✅ 已实现 | 移动端右侧面板 | 功能正常 |

## 总结

### 已完全实现的配置项
1. 所有 AI 后端设置 (Provider、模型、覆盖配置)
2. 大部分引擎设置 (模式、语言、流式、日志、历史轮数、记忆预算、自动存档、代理开关)
3. 塑造世界功能 (存档、记忆、规则书、新会话)
4. 所有 UI 显示设置 (纯前端)

### 缺少后端支持的配置项
1. **自动世界演化** (stAutoWorldTick) - UI 存在但后端无实现
2. **闲置触发时长** (stIdleTimeout) - UI 存在但后端无实现

### 缺少对应界面的导航项
1. **故事存档** - 导航存在但无界面
2. **成就** - 导航存在但无界面
3. **世界地图** - 导航存在但无界面
4. **角色卡** - 导航存在但无界面
5. **传说典籍** - 导航存在但无界面
