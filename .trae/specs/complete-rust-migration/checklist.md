# Checklist

## Core Crate 功能完备
- [ ] `WorldKeeperAgent` 实现 `BaseAgent` trait，包含世界观一致性检查逻辑
- [ ] `NPCDirectorAgent` 实现 `BaseAgent` trait，包含 NPC 行为生成与对话管理
- [ ] `RuleArbiterAgent` 实现 `BaseAgent` trait，包含骰子/战斗/技能检定逻辑
- [ ] `DramaCuratorAgent` 实现 `BaseAgent` trait，包含伏笔与情感曲线管理
- [ ] `GuideAgent` 与 `GuideManager` 集成，支持五步引导流程 API
- [ ] `AgentManager` 注册全部 6 个代理，支持按名称获取和遍历
- [ ] `ProviderFactory` 支持从环境变量创建 Ollama/OpenAI/Local/LMStudio/Jan Provider
- [ ] `OpenAIProvider` 实现 `AIProvider` trait，支持流式/非流式响应
- [ ] `LocalProvider` 实现 `AIProvider` trait，兼容 OpenAI 风格本地接口
- [ ] `JanProvider` 和 `LMStudioProvider` 实现（或复用 LocalProvider）
- [ ] Provider 支持按角色覆盖配置（narrator/world-keeper/npc-director/rule-arbiter/drama-curator）
- [ ] `GameMode` trait 定义完整，五种模式均有实现
- [ ] `RuleEngine` 支持规则注册、执行顺序、条件判断和二次事件生成
- [ ] `QuestManager`、`ItemManager`、`EconomyManager`、`RelationshipManager` 基础功能可用
- [ ] `SceneManager` 和 `EnvironmentManager` 支持场景切换与环境状态更新

## Memory Crate 存储扩展
- [ ] `MemoryStore` trait 包含 `recall`、`get_by_type`、`get_by_session`、`delete_by_session`
- [ ] `SqliteMemoryStore` 实现所有 trait 方法，SQL 查询正确
- [ ] 记忆表包含 type、importance、session_id 字段
- [ ] 记忆衰减逻辑实现（低重要性记忆定期清理）

## Server App API 兼容
- [ ] `GET /api/health` 返回 `{ success: true, status: "ok" }`
- [ ] `GET /api/config` 返回 gameConfig、providerRouting、runtime、availability
- [ ] `POST /api/config` 接受配置补丁，验证并重建引擎
- [ ] `GET /api/state` 返回当前世界状态 JSON
- [ ] `POST /api/turn` 接受 `{ input }`，返回 narrative + stateSnapshot
- [ ] `POST /api/turn/stream` 使用 SSE 流式返回 narrative chunks
- [ ] `GET /api/saves` 返回存档列表
- [ ] `POST /api/save` 创建新存档
- [ ] `POST /api/load` 加载指定存档
- [ ] `DELETE /api/saves/:id` 删除存档
- [ ] `GET /api/memories` 返回记忆列表
- [ ] `GET /api/memories/search?q=` 支持关键词搜索
- [ ] `POST /api/memories/clear` 清空当前会话记忆
- [ ] `GET /api/guide/progress` 返回引导进度
- [ ] `POST /api/guide/step/start` 开始指定步骤
- [ ] `POST /api/guide/step/complete` 完成当前步骤
- [ ] `POST /api/guide/chat` 与引路人对话
- [ ] `GET /api/cot/current` 返回当前思维链
- [ ] `GET /api/cot/history` 支持 limit/offset/agentRole 过滤
- [ ] `GET /api/cot/stats` 返回思维链统计
- [ ] `GET /api/cot/events` SSE 实时推送思维链更新
- [ ] `POST /api/bootstrap/world` 接受世界参数并初始化
- [ ] `GET/POST /api/rulebook` 规则书读写
- [ ] `GET /api/achievements` 返回成就列表
- [ ] CORS 配置允许 `localhost:5173`
- [ ] 静态文件服务正确 serve `apps/ui/dist`

## StateStore 持久化
- [ ] SQLite `saves` 表结构正确（id, name, mode, state_json, created_at）
- [ ] `StateStore::save` 写入 SQLite 而非 JSON 文件
- [ ] `StateStore::load` 从 SQLite 读取
- [ ] `StateStore::list_saves` 返回 SQLite 中的存档列表
- [ ] `StateStore::delete_save` 从 SQLite 删除
- [ ] 旧 JSON 存档可迁移到 SQLite（可选）

## 前端对接
- [ ] `apps/ui/vite.config.js` proxy `/api` 指向 `http://localhost:3000`
- [ ] Axum 服务器监听 `0.0.0.0:3000`
- [ ] 前端所有 API 调用（api.js 中的函数）在 Rust 后端下返回正确数据
- [ ] 流式输出（`/api/turn/stream`）在前端正常显示
- [ ] SSE 事件流（`/api/cot/events`）在前端正常接收

## 构建与运行
- [ ] `cargo check` 在 `newgame/` 下无错误
- [ ] `cargo test` 在 `newgame/` 下全部通过
- [ ] `cargo run --bin server` 成功启动 Axum 服务器
- [ ] `npm run dev:ui` + Rust 服务器同时运行，前端功能正常
- [ ] `cargo build --release --bin server` 生成可执行二进制
- [ ] 生产模式：Rust 服务器 serve 静态文件，前端直接访问 `localhost:3000`

## 测试覆盖
- [ ] `game_core` 单元测试覆盖 Agent、Provider、RuleEngine、GameMode
- [ ] `memory` 单元测试覆盖 CRUD、搜索、衰减
- [ ] API 集成测试覆盖所有端点（使用 `reqwest` 或 `curl`）
- [ ] 端到端测试：完整游戏流程（创建世界 → 输入回合 → 保存 → 加载）
