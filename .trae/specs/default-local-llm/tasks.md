# Tasks

- [ ] Task 1: 实现本地模型服务自动检测
  - [ ] SubTask 1.1: 创建本地服务检测函数，检查 LM Studio (1234)、Jan (1337)、Ollama (11434) 端口
  - [ ] SubTask 1.2: 实现优先级选择逻辑
  - [ ] SubTask 1.3: 在 ProviderFactory 中集成自动检测

- [ ] Task 2: 修改默认配置逻辑
  - [ ] SubTask 2.1: 修改 ProviderFactory.configFromEnv，添加自动检测作为 fallback
  - [ ] SubTask 2.2: 当没有 DEFAULT_PROVIDER 时，使用自动检测结果
  - [ ] SubTask 2.3: 添加检测结果的日志输出

- [ ] Task 3: 创建测试专用配置
  - [ ] SubTask 3.1: 创建 .env.test.local 文件，配置测试环境
  - [ ] SubTask 3.2: 修改 server.ts，在开发模式下使用测试配置
  - [ ] SubTask 3.3: 添加启动时的配置信息输出

- [ ] Task 4: 实现友好的错误提示
  - [ ] SubTask 4.1: 创建本地模型服务未找到时的错误提示函数
  - [ ] SubTask 4.2: 包含推荐的工具、安装指南、配置说明
  - [ ] SubTask 4.3: 在服务器启动和 API 调用时显示提示

- [ ] Task 5: 更新文档
  - [ ] SubTask 5.1: 更新 README，添加快速开始测试的说明
  - [ ] SubTask 5.2: 更新 .env.example，添加注释说明
  - [ ] SubTask 5.3: 添加 LOCAL_AI_GUIDE.md 的简化版本

# Task Dependencies
- Task 2 依赖于 Task 1
- Task 3 可以并行执行
- Task 4 依赖于 Task 1
- Task 5 最后执行
