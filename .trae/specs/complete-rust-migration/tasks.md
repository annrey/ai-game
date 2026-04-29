# Tasks

- [ ] Task 1: 完善 `game_core` crate — Agent 系统
  - [ ] SubTask 1.1: 实现 `WorldKeeperAgent`，包含世界观一致性检查、设定查询、拒绝违背设定的内容
  - [ ] SubTask 1.2: 实现 `NPCDirectorAgent`，包含 NPC 行为生成、对话管理、关系网查询
  - [ ] SubTask 1.3: 实现 `RuleArbiterAgent`，包含骰子机制、战斗结算、技能检定
  - [ ] SubTask 1.4: 实现 `DramaCuratorAgent`，包含伏笔管理、高潮设计、情感曲线控制
  - [ ] SubTask 1.5: 完善 `GuideAgent`，与 GuideManager 集成，支持五步引导流程
  - [ ] SubTask 1.6: 在 `AgentManager` 中注册所有代理，实现代理间协作调度

- [ ] Task 2: 完善 `game_core` crate — Provider 与配置
  - [ ] SubTask 2.1: 实现 `ProviderFactory`，支持从环境变量/配置文件创建 Provider
  - [ ] SubTask 2.2: 实现 `OpenAIProvider`（兼容 OpenAI 风格 API）
  - [ ] SubTask 2.3: 实现 `LocalProvider`（通用本地 AI，llama.cpp / vLLM / LM Studio 兼容）
  - [ ] SubTask 2.4: 实现 `JanProvider` 和 `LMStudioProvider`
  - [ ] SubTask 2.5: 支持按角色覆盖 Provider/模型配置
  - [ ] SubTask 2.6: 实现 Provider 可用性检测和模型列表获取

- [ ] Task 3: 完善 `game_core` crate — 游戏模式与规则引擎
  - [ ] SubTask 3.1: 实现 `GameMode` trait 和五种模式（text-adventure, ai-battle, npc-sandbox, chat-roleplay, stardew-valley）
  - [ ] SubTask 3.2: 完善 `RuleEngine`，支持规则注册、执行顺序、条件判断
  - [ ] SubTask 3.3: 实现 `QuestManager` 和 `ItemManager`，支持动态任务生成和物品系统
  - [ ] SubTask 3.4: 实现 `EconomyManager` 和 `RelationshipManager`
  - [ ] SubTask 3.5: 实现 `SceneManager` 和 `EnvironmentManager`

- [ ] Task 4: 完善 `memory` crate — 存储接口扩展
  - [ ] SubTask 4.1: 扩展 `MemoryStore` trait，增加 `recall`、`get_by_type`、`get_by_session`、`delete_by_session`
  - [ ] SubTask 4.2: 在 `SqliteMemoryStore` 中实现上述方法（使用 SQL LIKE 或全文搜索）
  - [ ] SubTask 4.3: 添加记忆类型字段（episodic/semantic/procedural）和重要性评分
  - [ ] SubTask 4.4: 实现记忆衰减（低重要性记忆自动清理）

- [ ] Task 5: 完善 `server` app — Axum API 实现
  - [ ] SubTask 5.1: 实现 `/api/config`（GET/POST）和 `/api/providers`（GET/POST）
  - [ ] SubTask 5.2: 实现 `/api/state`、`/api/turn`、`/api/turn/stream`
  - [ ] SubTask 5.3: 实现 `/api/saves/*`（列表、保存、加载、删除）
  - [ ] SubTask 5.4: 实现 `/api/memories/*`（列表、搜索、清空）
  - [ ] SubTask 5.5: 实现 `/api/guide/*`（进度、步骤、聊天）
  - [ ] SubTask 5.6: 实现 `/api/cot/*`（当前、历史、统计、SSE 事件流）
  - [ ] SubTask 5.7: 实现 `/api/bootstrap/world`、`/api/rulebook`、`/api/achievements`
  - [ ] SubTask 5.8: 配置 CORS、静态文件服务（serve `apps/ui/dist`）、错误处理中间件

- [ ] Task 6: StateStore 持久化改造
  - [ ] SubTask 6.1: 使用 `sqlx` 在 SQLite 中创建 `saves` 表（id, name, mode, state_json, created_at）
  - [ ] SubTask 6.2: 改造 `StateStore` 的 save/load/list/delete 方法使用 SQLite
  - [ ] SubTask 6.3: 保持向后兼容，支持从旧 JSON 文件格式迁移

- [ ] Task 7: 前端对接与构建
  - [ ] SubTask 7.1: 验证 `apps/ui/vite.config.js` proxy 配置指向 `localhost:3000`
  - [ ] SubTask 7.2: 在 Axum 中配置 `tower-http` 静态文件服务，serve `apps/ui/dist`
  - [ ] SubTask 7.3: 编写根目录 `package.json` 脚本，支持 `cargo run --bin server` + `vite dev` 同时启动
  - [ ] SubTask 7.4: 验证前端所有 API 调用在 Rust 后端下正常工作

- [ ] Task 8: 测试与验证
  - [ ] SubTask 8.1: 为 `game_core` 编写单元测试（cargo test）
  - [ ] SubTask 8.2: 为 `memory` 编写单元测试
  - [ ] SubTask 8.3: 使用 `reqwest` 或 `curl` 对 Axum API 进行集成测试
  - [ ] SubTask 8.4: 端到端测试：启动 Rust 服务器 + 前端，验证完整游戏流程

# Task Dependencies
- Task 1 和 Task 2 可并行开发
- Task 3 依赖于 Task 1（需要 Agent 参与模式）
- Task 4 可独立并行
- Task 5 依赖于 Task 1、2、3、4（需要完整的 core + memory）
- Task 6 可并行于 Task 5，但需在最终集成前完成
- Task 7 依赖于 Task 5
- Task 8 依赖于 Task 7
