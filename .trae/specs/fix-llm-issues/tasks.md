# Tasks

- [x] Task 1: 统一配置加载逻辑
  - [x] SubTask 1.1: 创建统一的配置加载函数 loadTestConfig()
  - [x] SubTask 1.2: 修改 demo.ts 加载 .env.test.local
  - [x] SubTask 1.3: 修改 server.ts 使用统一的配置加载函数
  - [x] SubTask 1.4: 验证配置加载优先级正确

- [x] Task 2: 添加本地模型超时配置
  - [x] SubTask 2.1: 在 constants.ts 添加本地模型超时常量 (120s)
  - [x] SubTask 2.2: 修改 OllamaProvider 使用专用超时
  - [x] SubTask 2.3: 修改 LocalProvider 使用专用超时
  - [x] SubTask 2.4: 支持通过环境变量覆盖超时设置

- [x] Task 3: 实现代理并行调用
  - [x] SubTask 3.1: 分析 narrator.ts 中可并行的代理调用
  - [x] SubTask 3.2: 修改 orchestrate 方法使用 Promise.all()
  - [x] SubTask 3.3: 修改 orchestrateStream 方法使用并行
  - [x] SubTask 3.4: 添加并行执行的错误处理

- [x] Task 4: 添加重试机制
  - [x] SubTask 4.1: 创建 retryWithBackoff 工具函数
  - [x] SubTask 4.2: 在 provider 层集成重试逻辑
  - [x] SubTask 4.3: 配置重试次数和退避策略
  - [x] SubTask 4.4: 添加重试日志

- [x] Task 5: 测试验证
  - [x] SubTask 5.1: 运行测试脚本验证配置加载
  - [x] SubTask 5.2: 测试超时配置生效
  - [x] SubTask 5.3: 验证并行调用性能提升
  - [x] SubTask 5.4: 测试重试机制

# Task Dependencies
- Task 1 和 Task 2 可以并行执行
- Task 3 依赖于 Task 2（超时配置影响并行）
- Task 4 可以并行执行
- Task 5 最后执行
