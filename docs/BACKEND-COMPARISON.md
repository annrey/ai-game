# 本地 AI 后端对比与选择指南

本文档汇总了游戏引擎支持的所有本地 AI 后端方案，帮助你根据场景选择最合适的。

## 快速对比表

| 特性 | Ollama | Jan | LM Studio | llama.cpp |
|------|--------|-----|-----------|-----------|
| **安装难度** | ⭐ 简单 | ⭐ 简单 | ⭐ 简单 | ⭐⭐ 中等 |
| **界面** | 命令行 | 图形界面 | 图形界面 | 命令行 |
| **模型管理** | CLI 命令 | GUI 点击 | GUI 点击 | 手动下载 |
| **API 端口** | 11434 | 1337 | 1234 | 8080（可改） |
| **API 格式** | 原生 + OpenAI | OpenAI | OpenAI | OpenAI |
| **启动速度** | 快 | 中等 | 中等 | 快 |
| **内存占用** | 低 | 中等 | 中等 | 低 |
| **精细控制** | 中等 | 低 | 低 | 高 |
| **适合场景** | 日常使用 | 可视化调试 | 快速体验 | 性能调优 |

## 各方案详解

### 1. Ollama（推荐新手）

**最适合**：想要开箱即用、不折腾的用户

**优点**：
- 一条命令安装：`brew install ollama`
- 一条命令下载模型：`ollama pull qwen2.5:7b`
- 自动处理模型格式转换
- 社区活跃，模型库丰富

**缺点**：
- 命令行操作，不够直观
- 底层控制参数有限

**快速开始**：
```bash
ollama pull qwen2.5:7b
ollama serve
./switch-backend.sh ollama
```

---

### 2. Jan

**最适合**：喜欢可视化界面、需要对话历史管理的用户

**优点**：
- 漂亮的 ChatGPT 风格界面
- 内置对话历史保存
- 一键切换不同模型
- 支持从 HuggingFace 直接搜索下载

**缺点**：
- 应用启动稍慢
- 内存占用比 Ollama 高
- 需要手动启用 API Server

**快速开始**：
```bash
# 1. 从 https://jan.ai 下载安装
# 2. 打开 Jan，在 Hub 下载模型
# 3. 设置 → Advanced → 启用 API Server
./switch-backend.sh jan
```

---

### 3. LM Studio

**最适合**：想要快速体验、不想配置的用户

**优点**：
- 安装即用，零配置
- 内置模型浏览器
- 自动推荐适合硬件的量化版本

**缺点**：
- 闭源软件（免费使用）
- 功能相对简单

**快速开始**：
```bash
# 1. 从 https://lmstudio.ai 下载安装
# 2. 下载模型，启动 Local Server
./switch-backend.sh lmstudio
```

---

### 4. llama.cpp

**最适合**：追求极致性能、需要精细控制的进阶用户

**优点**：
- 底层推理引擎，性能最优
- 完全控制：量化级别、GPU 层数、上下文长度
- 支持最新模型特性
- 其他工具（包括 Ollama）底层都基于它

**缺点**：
- 需要手动下载 GGUF 模型
- 命令行参数较多，学习曲线陡
- 需要了解量化、GPU offload 等概念

**快速开始**：
```bash
brew install llama.cpp
# 下载 GGUF 模型到 ~/.models/llama-cpp/
llama-server -m ~/.models/llama-cpp/qwen2.5-7b-q4_k_m.gguf --port 8080 -ngl 999
./switch-backend.sh llamacpp
```

---

## 选择建议

### 按使用场景

| 场景 | 推荐方案 |
|------|---------|
| 第一次尝试本地 AI | **Ollama** |
| 可视化调试模型效果 | **Jan** |
| 长时间后台运行 | **Ollama** 或 **llama.cpp** |
| 需要精细调优性能 | **llama.cpp** |
| 快速体验不折腾 | **LM Studio** |
| 同时管理多个模型 | **Jan** 或 **Ollama** |

### 按硬件配置

**24GB RAM (M1/M2/M3 Pro/Max)**：
- 7B 模型：任意方案都流畅
- 14B 模型：推荐 Ollama 或 llama.cpp
- 32B 模型：只能用 llama.cpp 精细控制 GPU 层数

**16GB RAM (M1/M2/M3)**：
- 7B Q4 量化：所有方案可用
- 避免同时加载多个大模型

**8GB RAM (基础款)**：
- 只能跑 3B-4B 小模型
- 推荐 Ollama（自动优化）

## 切换后端

使用提供的切换脚本：

```bash
# 查看当前状态
./switch-backend.sh status

# 切换到指定后端
./switch-backend.sh ollama
./switch-backend.sh jan
./switch-backend.sh llamacpp
./switch-backend.sh lmstudio
```

切换后运行测试：

```bash
npx tsx src/test-local.ts
```

## 混合后端（高级）

你可以为不同代理指定不同后端，比如：

```env
# Narrator 用 llama.cpp 跑 14B（高质量）
NARRATOR_PROVIDER=local
NARRATOR_MODEL=qwen2.5-14b

# 其他代理用 Ollama 跑 7B（快速响应）
WORLD_KEEPER_PROVIDER=ollama
WORLD_KEEPER_MODEL=qwen2.5:7b
NPC_DIRECTOR_PROVIDER=ollama
NPC_DIRECTOR_MODEL=qwen2.5:7b
...
```

注意：这需要同时运行两个后端服务。

## 故障排查

### 所有后端通用

```bash
# 检查服务是否运行
curl http://localhost:11434/api/version    # Ollama
curl http://localhost:1337/v1/models       # Jan
curl http://localhost:1234/v1/models       # LM Studio
curl http://localhost:8080/health          # llama.cpp

# 运行引擎测试
npx tsx src/test-local.ts
```

### 常见问题

**Q: 切换后端后游戏无法启动？**
- 检查对应服务是否已启动
- 运行 `./switch-backend.sh status` 确认配置
- 检查模型是否已下载/加载

**Q: 中文输出乱码？**
- Ollama/Jan：确保使用 Qwen 模型
- llama.cpp：添加 `--chat-template chatml` 参数

**Q: 内存不足？**
- 换更小的模型（14B → 7B）
- 使用更高量化级别（Q5 → Q4）
- llama.cpp：减少 `-ngl`（GPU 层数）

## 相关文档

- [Ollama 配置](../LOCAL-AI-SETUP.md)
- [Jan 配置](./JAN-SETUP.md)
- [llama.cpp 配置](./LLAMA-CPP-SETUP.md)
- [引擎设计文档](../DESIGN.md)
