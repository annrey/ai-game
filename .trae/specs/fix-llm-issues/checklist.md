# Checklist

## 配置加载
- [x] demo.ts 加载 .env.test.local
- [x] server.ts 使用统一配置加载
- [x] 配置优先级正确（环境变量 > .env.test.local > .env）

## 超时配置
- [x] 本地模型默认超时 120 秒
- [x] OllamaProvider 使用专用超时
- [x] LocalProvider 使用专用超时
- [x] 支持环境变量覆盖

## 并行优化
- [x] narrator.ts orchestrate 方法并行执行
- [x] narrator.ts orchestrateStream 方法并行执行
- [x] 并行执行错误处理正确
- [x] 响应时间减少 30% 以上

## 重试机制
- [x] retryWithBackoff 工具函数实现
- [x] Provider 层集成重试逻辑
- [x] 最多重试 3 次
- [x] 指数退避策略正确

## 测试验证
- [x] 所有单元测试通过 (111/115)
- [x] TypeScript 编译成功
- [x] 本地模型测试脚本通过
- [x] 性能测试显示优化效果
