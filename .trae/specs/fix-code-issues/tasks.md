# Tasks

- [x] Task 1: 修复 Quest ID 类型不匹配问题
  - [x] SubTask 1.1: 修改 scene-manager.ts 的 updateQuest 方法，使用 uuidv4() 生成内部 ID
  - [x] SubTask 1.2: 将传入的 questId 作为 questId 字段存储
  - [x] SubTask 1.3: 更新任务查找逻辑，优先匹配 questId 字段
  - [x] SubTask 1.4: 验证修复后的行为

- [x] Task 2: 完善 JSON 解析错误处理
  - [x] SubTask 2.1: 修改 game-engine.ts 的 resolveActionAndPushState 方法
  - [x] SubTask 2.2: 添加 try-catch 包裹整个状态更新逻辑
  - [x] SubTask 2.3: 解析失败时返回错误信息，不更新状态
  - [x] SubTask 2.4: 添加详细的错误日志

- [x] Task 3: 增强类型安全性
  - [x] SubTask 3.1: 定义 SceneState 的路径类型
  - [x] SubTask 3.2: 修改 patch 方法签名，使用严格类型
  - [x] SubTask 3.3: 移除 any 类型使用

- [x] Task 4: 改进代理协调错误处理
  - [x] SubTask 4.1: 修改 narrator.ts 的 orchestrate 方法
  - [x] SubTask 4.2: 捕获错误时记录详细信息
  - [x] SubTask 4.3: 在 AgentResponse 中添加错误字段
  - [x] SubTask 4.4: 添加降级策略

- [x] Task 5: 优化流式响应错误处理
  - [x] SubTask 5.1: 修改 server.ts 的流式 API 路由
  - [x] SubTask 5.2: 在流式响应中嵌入错误标记
  - [x] SubTask 5.3: 确保错误时正确关闭连接

- [x] Task 6: 减少代码重复
  - [x] SubTask 6.1: 分析 processTurn 和 processStreamTurn 的公共逻辑
  - [x] SubTask 6.2: 提取公共方法 prepareTurnContext
  - [x] SubTask 6.3: 提取公共方法 finalizeTurn
  - [x] SubTask 6.4: 重构两个方法使用公共方法

- [x] Task 7: 替换魔法数字
  - [x] SubTask 7.1: 识别所有魔法数字（30, 50, 200, 等）
  - [x] SubTask 7.2: 创建常量定义文件或配置对象
  - [x] SubTask 7.3: 替换所有魔法数字为常量

# Task Dependencies
- Task 1, 2, 3, 4, 5 可以并行执行
- Task 6 依赖于 Task 2 完成（涉及相同文件）
- Task 7 可以与其他任务并行执行
