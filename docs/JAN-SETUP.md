# Jan 本地 AI 配置指南

Jan 是一个开源的 ChatGPT 替代品，提供漂亮的桌面界面和本地模型管理，同时暴露 OpenAI 兼容的 API。

## 安装

### 方式一：官网下载（推荐）

1. 访问 https://jan.ai/
2. 点击 "Download for macOS"
3. 下载完成后拖入 Applications 文件夹

### 方式二：Homebrew

```bash
brew install --cask jan
```

## 首次启动配置

1. 打开 Jan 应用
2. 首次启动会提示选择模型文件夹位置，建议保持默认或选择外置硬盘（模型文件较大）
3. 进入主界面后，点击左侧边栏的 "Hub"

## 下载模型

在 Hub 页面搜索并下载推荐模型：

### 推荐模型（适合 24GB Mac）

| 模型 | 大小 | 用途 |
|------|------|------|
| Qwen 2.5 7B Instruct | ~4.7GB | 快速响应、辅助代理 |
| Qwen 2.5 14B Instruct | ~9GB | 主叙事、高质量生成 |
| Llama 3.1 8B Instruct | ~4.7GB | 英文场景 |
| DeepSeek Coder 6.7B | ~4GB | 代码相关任务 |

### 下载步骤

1. 在 Hub 搜索栏输入 "Qwen"
2. 找到 "Qwen 2.5 7B Instruct Q4"
3. 点击下载按钮
4. 等待下载完成（速度取决于网络）

> 如果下载慢，可以手动下载 GGUF 文件放入 Jan 的模型目录：
> `~/Library/Application Support/Jan/data/models`

## 启动 API 服务

Jan 内置 OpenAI 兼容 API，默认端口 **1337**。

### 启用 API 服务

1. 点击左下角设置图标（⚙️）
2. 选择 "Advanced Settings"
3. 找到 "API Server" 选项
4. 开启 "Enable API Server"
5. 确认端口为 1337（可修改）
6. 点击 "Save"

### 验证 API

```bash
# 检查服务状态
curl http://localhost:1337/v1/models

# 测试对话
curl http://localhost:1337/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-7b-instruct",
    "messages": [{"role": "user", "content": "你好，请介绍一下自己"}]
  }'
```

## 配置游戏引擎

编辑 `game/.env`：

```env
# 切换到 Jan
DEFAULT_PROVIDER=local

# Jan API 配置
LOCAL_AI_ENDPOINT=http://localhost:1337/v1
LOCAL_AI_MODEL=qwen2.5-7b-instruct

# 各代理模型配置
NARRATOR_PROVIDER=local
NARRATOR_MODEL=qwen2.5-14b-instruct

WORLD_KEEPER_PROVIDER=local
WORLD_KEEPER_MODEL=qwen2.5-7b-instruct

NPC_DIRECTOR_PROVIDER=local
NPC_DIRECTOR_MODEL=qwen2.5-7b-instruct

RULE_ARBITER_PROVIDER=local
RULE_ARBITER_MODEL=qwen2.5-7b-instruct

DRAMA_CURATOR_PROVIDER=local
DRAMA_CURATOR_MODEL=qwen2.5-7b-instruct
```

## 模型名称对照表

Jan 中的模型名称可能与 Ollama 不同，以下是常见对应关系：

| Jan 显示名称 | API 调用名称 | 备注 |
|-------------|-------------|------|
| Qwen 2.5 7B Instruct Q4 | qwen2.5-7b-instruct | 下载后自动识别 |
| Qwen 2.5 14B Instruct Q4 | qwen2.5-14b-instruct | 下载后自动识别 |
| Llama 3.1 8B Instruct Q4 | llama3.1-8b-instruct | 下载后自动识别 |

如果不确定模型名称，运行：

```bash
curl http://localhost:1337/v1/models | jq '.data[].id'
```

## 快速切换配置脚本

创建 `switch-to-jan.sh`：

```bash
#!/bin/bash
# 切换到 Jan 后端

cd "$(dirname "$0")"

# 备份当前配置
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# 切换到 Jan 配置
cat > .env << 'EOF'
# ============================================
# AI 说书人委员会 — Jan 后端配置
# ============================================

DEFAULT_PROVIDER=local

# Jan API 配置（默认端口 1337）
LOCAL_AI_ENDPOINT=http://localhost:1337/v1
LOCAL_AI_MODEL=qwen2.5-7b-instruct

# 各代理独立模型配置
NARRATOR_PROVIDER=local
NARRATOR_MODEL=qwen2.5-14b-instruct

WORLD_KEEPER_PROVIDER=local
WORLD_KEEPER_MODEL=qwen2.5-7b-instruct

NPC_DIRECTOR_PROVIDER=local
NPC_DIRECTOR_MODEL=qwen2.5-7b-instruct

RULE_ARBITER_PROVIDER=local
RULE_ARBITER_MODEL=qwen2.5-7b-instruct

DRAMA_CURATOR_PROVIDER=local
DRAMA_CURATOR_MODEL=qwen2.5-7b-instruct

# 游戏配置
GAME_LANGUAGE=zh-CN
LOG_LEVEL=info
EOF

echo "✓ 已切换到 Jan 后端配置"
echo ""
echo "请确保："
echo "  1. Jan 应用已启动"
echo "  2. API Server 已启用（设置 → Advanced → API Server）"
echo "  3. 已下载所需模型"
echo ""
echo "测试连接："
echo "  npx tsx src/test-local.ts"
```

同样创建切回 Ollama 的脚本 `switch-to-ollama.sh`：

```bash
#!/bin/bash
# 切换回 Ollama 后端

cd "$(dirname "$0")"

cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

cat > .env << 'EOF'
# ============================================
# AI 说书人委员会 — Ollama 后端配置
# ============================================

DEFAULT_PROVIDER=ollama

OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b

NARRATOR_PROVIDER=ollama
NARRATOR_MODEL=qwen2.5:14b

WORLD_KEEPER_PROVIDER=ollama
WORLD_KEEPER_MODEL=qwen2.5:7b

NPC_DIRECTOR_PROVIDER=ollama
NPC_DIRECTOR_MODEL=qwen2.5:7b

RULE_ARBITER_PROVIDER=ollama
RULE_ARBITER_MODEL=qwen2.5:7b

DRAMA_CURATOR_PROVIDER=ollama
DRAMA_CURATOR_MODEL=qwen2.5:7b

GAME_LANGUAGE=zh-CN
LOG_LEVEL=info
EOF

echo "✓ 已切换到 Ollama 后端配置"
echo ""
echo "请确保 Ollama 服务在运行："
echo "  ollama serve"
```

使用：

```bash
chmod +x switch-to-jan.sh switch-to-ollama.sh

# 切换到 Jan
./switch-to-jan.sh

# 切换回 Ollama
./switch-to-ollama.sh
```

## Jan vs Ollama 对比

| 特性 | Jan | Ollama |
|------|-----|--------|
| 界面 | 图形化桌面应用 | 命令行 |
| 模型管理 | GUI 点击下载 | 命令行 `ollama pull` |
| 对话历史 | 内置保存 | 需自行实现 |
| API 兼容性 | OpenAI 兼容 | 原生 + OpenAI 兼容 |
| 多模型同时加载 | 支持（切换对话） | 支持（多实例） |
| 内存占用 | 稍高（有 GUI） | 较低 |
| 启动速度 | 应用启动较慢 | 服务启动快 |
| 适合场景 | 可视化调试、聊天 | 后台服务、自动化 |

## 推荐工作流

1. **探索阶段**：用 Jan 的 GUI 测试不同模型效果，找到最适合的
2. **开发阶段**：用 Ollama 或 llama.cpp 作为稳定后端
3. **游戏运行**：根据场景切换——Jan 方便调试，Ollama 适合长时间运行

## 常见问题

**Q: Jan 启动后 API 无响应？**
- 检查设置中 "API Server" 是否已启用
- 检查端口是否被占用：`lsof -i :1337`
- 尝试重启 Jan 应用

**Q: 模型下载失败？**
- 检查磁盘空间（模型文件较大）
- 尝试手动下载 GGUF 放入模型目录
- 或使用 HuggingFace 镜像加速

**Q: 中文输出不正常？**
- 确保下载的是 "Instruct" 版本模型
- 在 Jan 对话设置中选择正确的 "Prompt Template"
- Qwen 模型选择 "ChatML" 模板

**Q: 如何查看 Jan 日志？**
```bash
tail -f ~/Library/Application\ Support/Jan/logs/app.log
```
