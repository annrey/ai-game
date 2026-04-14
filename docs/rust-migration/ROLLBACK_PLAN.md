# 上线手册与回滚预案 (Go-Live Manual & Rollback Plan)

## 1. 上线前置条件检查表 (Pre-Launch Checklist)

- [ ] 所有 CI 流程全绿，包括原有 Node.js/TypeScript 测试与新的 Rust 单元测试。
- [ ] 测试环境压测完成，性能基准测试报告显示 TPS 提升 $\ge 30\%$ 且无内存泄漏。
- [ ] `MIGRATION_PLAN.md` 中各个阶段的特性开关 (Feature Flags) 配置完毕。
- [ ] 数据库全量备份（确保 `data/memories.db` 存在最新快照）。
- [ ] Kubernetes / Nginx 反向代理配置已支持金丝雀发布 (Canary Release)。

## 2. 逐步上线流程 (Step-by-Step Go-Live Manual)

### 阶段一：并行运行与影子流量 (Shadow Traffic)
1. **构建 Rust 服务**：`cargo build --release` 或使用构建好的 Docker 镜像。
2. **部署影子环境**：将部分真实请求异步镜像至 Rust 实例，且**不影响主流程响应**，对比 Node.js 与 Rust 返回结果及日志。
3. **监控**：观察 Rust 实例的 CPU、内存、错误日志及数据库锁定情况。

### 阶段二：灰度发布 (Canary Release) - 10% 流量
1. **切换路由**：通过 Nginx `split_clients` 或 K8s Ingress 权重，将 10% 的 API 流量切至 Rust 实例 (`axum` 服务)。
2. **观察期 (4-12 小时)**：监控 HTTP 5xx 错误率、P99 响应延迟及应用日志中的异常堆栈。
3. **状态校验**：确认 Rust 端处理的数据正常写入 SQLite，并能被剩余 90% 的 Node.js 实例读取。

### 阶段三：全面切换 (Full Cutover) - 100% 流量
1. **扩大权重**：将 Rust 实例的流量权重逐步上调至 30% -> 50% -> 80% -> 100%。
2. **下线旧实例**：确认 Rust 服务完全接管且运行平稳 24 小时后，关闭并移除 Node.js 容器。
3. **清理代码**：从代码库中移除原 Node.js 服务端的 Express 相关代码，正式完成演进。

## 3. 紧急回滚预案 (Emergency Rollback Plan)

在灰度发布或全面切换的任何阶段，如遇以下情况（触发条件）：
- HTTP 5xx 错误率突增超过 1%。
- 核心功能不可用（例如 AI 无法回复、任务无法推进）。
- 数据库死锁或严重的数据一致性问题。

### 执行回滚步骤 (Rollback Steps)
1. **立即切断流量 (T0 分钟)**：
   在负载均衡器或 Nginx 中，将 Rust 实例的流量权重调回 0%，全量恢复至原 Node.js 实例。
   ```bash
   # 示例: 恢复 Nginx 权重配置并重载
   cp nginx-node-only.conf /etc/nginx/nginx.conf
   nginx -s reload
   ```
2. **状态与数据恢复 (T+5 分钟)**：
   若确认 Rust 实例导致了 SQLite 数据库数据损坏或状态异常：
   - 立即停止所有 Node.js 实例对数据库的写入。
   - 使用上线前的数据库快照还原 `memories.db`。
   - 重启 Node.js 实例。
3. **日志留存与故障排查 (T+15 分钟)**：
   - 保留 Rust 实例产生的错误日志、崩溃 Dump 文件及当时的数据库副本。
   - 开发团队介入分析，定位问题根因。
   - 修复问题并在测试环境进行复现后，重新安排下一次灰度发布。

**核心原则**：所有回滚操作必须在 5 分钟内完成，确保用户体验（即使丢失少量进度）不被长时间中断。
