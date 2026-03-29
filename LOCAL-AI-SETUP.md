## Mac 本地 AI 搭建指南 (Apple Silicon / 24GB RAM)

本指南帮你在 Mac 上快速搭建本地 AI，让游戏引擎跑起来。你的硬件（Apple Silicon + 24GB RAM）可以舒适运行 7B~14B 参数的模型。

---

### 第一步：安装 Ollama

打开终端，执行：

```bash
# 方式一：Homebrew（推荐）
brew install ollama

# 方式二：官网下载
# 访问 https://ollama.com/download 下载 macOS 版本
```

安装完成后启动 Ollama 服务：

```bash
# 启动服务（后台常驻）
ollama serve
```

> 如果你用 Homebrew 安装，Ollama 会自动作为后台服务启动，通常不需要手动执行 `ollama serve`。

验证是否运行：

```bash
curl http://localhost:11434/api/tags
```

看到 JSON 返回就说明服务正常。

---

### 第二步：拉取推荐模型

我们的策略是"大小搭配"——14B 负责主叙事（更聪明），7B 负责辅助代理（更快）。

```bash
# 主叙事模型（约 9GB，下载需要几分钟）
ollama pull qwen2.5:14b

# 辅助代理模型（约 4.7GB，更快下载）
ollama pull qwen2.5:7b
```

> **为什么选 Qwen 2.5？**
> - 中文能力在同尺寸开源模型中顶尖
> - 14B 在 24GB 内存 Mac 上运行流畅（约占 10-12GB 内存）
> - 7B 极快，适合需要快速响应的辅助判断

拉取完成后验证：

```bash
# 查看已安装模型
ollama list

# 快速测试
ollama run qwen2.5:7b "用一句话描述一个奇幻酒馆"
```

---

### 第三步（可选）：安装 LM Studio

LM Studio 提供图形界面管理模型，且兼容 OpenAI API 格式。

1. 访问 https://lmstudio.ai 下载 Mac 版
2. 安装后打开，在搜索栏搜索 `Qwen2.5`
3. 下载你想要的模型（推荐 GGUF Q4_K_M 量化版本）
4. 在左侧「Local Server」面板启动服务（默认端口 1234）

LM Studio 服务启动后，API 地址为 `http://localhost:1234/v1`，已在 `.env` 中预配置好。

---

### 第四步：安装项目依赖

```bash
cd ~/Documents/openclaw-main/game

# 安装依赖（使用 pnpm / npm / yarn 均可）
pnpm install
# 或
npm install
```

---

### 第五步：运行连通性测试

```bash
# 确保 Ollama 服务在运行，然后：
pnpm test:local
# 或
npx tsx src/test-local.ts
```

测试脚本会依次检查：
1. Provider 可用性（Ollama / LM Studio / OpenAI）
2. 已安装的模型列表
3. 快速对话测试
4. 流式输出测试

全部通过后你会看到 `✓ 本地 AI 连接成功！可以启动游戏了。`

---

### 第六步：启动游戏

```bash
# 启动默认 demo
pnpm demo

# 或指定模式：
pnpm demo:adventure    # 文字冒险
pnpm demo:battle       # AI 对战
pnpm demo:sandbox      # NPC 沙盒
pnpm demo:roleplay     # 聊天扮演
```

---

### 内存与性能参考

| 配置 | 14B 模型 | 7B 模型 | 同时运行 |
|------|---------|---------|---------|
| 内存占用 | ~10-12GB | ~5-6GB | ~15-17GB |
| 首次推理 | 2-4秒 | 1-2秒 | - |
| 生成速度 | ~15-20 tok/s | ~30-40 tok/s | 略有下降 |

24GB RAM 可以同时跑一个 14B + 一个 7B，但如果感觉卡顿，可以在 `.env` 中统一使用 7B：

```env
NARRATOR_MODEL=qwen2.5:7b
```

---

### 切换到 LM Studio 作为默认

如果你更喜欢 LM Studio 的图形界面，修改 `.env`：

```env
DEFAULT_PROVIDER=local
LOCAL_AI_ENDPOINT=http://localhost:1234/v1
LOCAL_AI_MODEL=你在LM Studio里加载的模型名
```

---

### 常见问题

**Q: `ollama serve` 报端口占用？**
说明 Ollama 已经在后台运行了，不需要再手动启动。

**Q: 下载模型卡住？**
试试 `OLLAMA_HOST=0.0.0.0 ollama serve` 重启后再 pull，或挂梯子。

**Q: 想用其他模型？**
引擎支持任何 Ollama 模型。推荐中文场景试试 `yi:34b`（需要更多内存）或 `llama3.1:8b`（英文更好）。
