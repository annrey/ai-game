# AI 说书人委员会 — 待办

默认入口是 Rust crate `crates/ai-storyteller`（`cargo run -p ai-storyteller`）。`src/` 下的 TypeScript 只作对照。

过时规划（pnpm monorepo、LanceDB、Extension SDK、语义规则图谱、音视频输出）不列入当前迭代。

---

## 现状（已落地）

- 多代理回合、四种模式模板、酒馆日程、闲置世界推进
- d20 对战结算、存档/读档、五步引导、思维链解析
- SQLite 记忆、规则书、按代理选模型
- 本机绑定、API token、CORS、SSRF / 存档路径围栏
- 酒馆 NPC 关系已注入回合上下文（`npc::TAVERN_RELATIONS`）
- Docker 已改为编 Rust 二进制

---

## P0 — 运行时收口

- [x] 写入本清单
- [ ] 提交并核对 Rust 迁移（相对 `810c495` 的未提交改动；未自动 commit）
- [x] 接上 `POST /api/preview/generate`（调用 `scripts/generate_preview.py`，失败则写占位图）
- [x] 修 Docker 健康检查（生产镜像安装 `wget`）
- [x] 对齐 `docker-compose.yml`（去掉无效的 `NODE_ENV`）
- [x] 补 HTTP / 存档 / 鉴权集成测试（不依赖真实 LLM）

---

## P1 — 文档写了、引擎只做了一半

- [x] 任务目标：`questUpdate.objectives` 写入场景，校验标题/目标数量
- [x] 物品规则：名称/数量/类型校验，拒绝空名与超量
- [x] 成就补全：战斗、收集、探索、夜间、幸存者等
- [x] NPC 关系网：场景内持久化 `LiveRelationship`，启发式 + JSON 解析改亲和度，角色扮演会改心情/立场
- [x] Skill 运行时：启动时加载 `skills/*/SKILL.md`，叠加运行时约束；缺文件则回退内置提示词
- [x] 记忆检索：SQLite FTS5（trigram，失败回退 LIKE）；每 5 回合衰减 / 压缩，上下文带会话摘要
- [x] 代理并行咨询：独立代理 `join_all`，不再顺序叠乘延迟
- [x] 模式差异：冒险/对战/角色扮演可收束结局；对战落后方属性微调

---

## P2 — 体验与工程债

- [x] 本地模型 180s 超时 + 超时/429/5xx 重试；状态解析失败写入 `warnings` / `last_state_error`
- [ ] 世界设定 / NPC 短时缓存
- [ ] 流式回合取消与断线恢复
- [ ] 结构化日志与回合耗时 / token 指标
- [x] CI：`.github/workflows/ci.yml` 跑 `cargo test` + `clippy -D warnings`
- [x] TypeScript：README 标明 `src/` 冻结对照，不再加功能

---

## 文档

- [x] 「添加新模式 / 自定义代理」改为 Rust 路径
- [x] 架构图改为 Axum，记忆说明为 SQLite FTS5
- [x] `ARCHITECTURE_IMPROVEMENTS.md` 标注为历史 TS 规划
- [x] `OPTIMIZATION_REPORT` / 本地 AI 文档的默认命令改为 `cargo run`

---

## 建议顺序

1. 提交相对 `810c495` 的 Rust 迁移
2. P2 剩余：缓存、流式取消、指标
3. 需要时再动扩展系统和向量记忆
