# AI 说书人委员会 — 本地 AI 配置指南

本文档介绍如何在本地运行 AI 说书人委员会游戏引擎，包括所有可用的本地 AI 方案及其配置方法。

---

## 快速开始

### 1. 当前配置（已可用）

你的 `.env` 文件已配置为使用 **Ollama** + **qwen2.5:7b** 模型：

```bash
cd /Users/chengyongwei/Documents/openclaw-main/game
npm run demo
```

### 2. 验证 Ollama 服务

```bash
# 检查 Ollama 是否运行
ollama --version

# 查看已安装的模型
ollama list

# 测试模型可用性
ollama run qwen2.5:7b "你好"
```

---

## 本地 AI 方案对比

| 方案 | 特点 | 适用场景 | 配置难度 |
|------|------|----------|----------|
| **Ollama** | 简单易用，模型管理方便 | 快速开始，日常使用 | ⭐ |
| **LM Studio** | 图形界面，模型下载方便 | 可视化操作，多模型管理 | ⭐⭐ |
| **Jan** | 开源，隐私优先 | 本地优先，离线使用 | ⭐⭐ |
| **llama.cpp** | 性能最优，资源占用低 | 高级用户，性能调优 | ⭐⭐⭐ |
| **vLLM** | 高并发，生产级 | 服务器部署 | ⭐⭐⭐ |

---

## 方案一：Ollama（推荐 / 当前使用）

### 安装

```bash
# macOS
brew install ollama

# 或从官网下载：https://ollama.com/download
```

### 常用命令

```bash
# 启动服务
ollama serve

# 拉取模型
ollama pull qwen2.5:7b
ollama pull qwen2.5:14b
ollama pull deepseek-r1:8b

# 运行交互式对话
ollama run qwen2.5:7b

# 列出已安装模型
ollama list

# 删除模型
ollama rm qwen2.5:0.5b
```

### 配置 .env

```env
DEFAULT_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

### 你当前可用的模型

| 模型 | 大小 | 特点 |
|------|------|------|
| `qwen2.5:14b` | 9.0 GB | 性能最强，中文优秀 |
| `qwen2.5:7b` | 4.7 GB | 性价比最佳，推荐 |
| `deepseek-r1:8b` | 5.2 GB | 推理能力强 |

---

## 方案二：LM Studio

### 启动步骤

1. 打开 **LM Studio.app**（已安装在你的应用程序文件夹）
2. 下载模型（搜索 "qwen" 或 "llama"）
3. 点击 **Local Server** 标签
4. 启动服务器（默认端口 1234）

### 配置 .env

```env
DEFAULT_PROVIDER=local
LOCAL_AI_ENDPOINT=http://localhost:1234/v1
LOCAL_AI_MODEL=your-downloaded-model
```

### 特点

- 图形化界面，操作简单
- 自动下载 HuggingFace 模型
- 内置 Chat 界面可测试
- 支持 GPU 加速配置

---

## 方案三：Jan

### 启动步骤

1. 打开 **Jan.app**（已安装在你的应用程序文件夹）
2. 下载模型或导入本地模型
3. 启动 Local API Server
4. 默认端口号查看 Jan 设置

### 配置 .env

```env
DEFAULT_PROVIDER=local
LOCAL_AI_ENDPOINT=http://localhost:1337/v1  # 端口可能不同
LOCAL_AI_MODEL=jan-local-model
```

### 特点

- 完全开源，数据本地存储
- 支持多种推理引擎
- 适合隐私敏感场景

---

## 方案四：llama.cpp Server

### 安装与启动

```bash
# 安装
brew install llama.cpp

# 启动服务器（需先下载 GGUF 模型）
llama-server \
  -m ~/models/qwen2.5-7b-q4_k_m.gguf \
  --port 8080 \
  -ngl 999  # 启用所有 GPU 层
```

### 配置 .env

```env
DEFAULT_PROVIDER=local
LOCAL_AI_ENDPOINT=http://localhost:8080/v1
LOCAL_AI_MODEL=local-model
```

### 特点

- 性能最优，内存占用小
- 支持多种量化格式
- 适合高级用户调优

---

## 高级配置：多 Provider 混合

你可以为不同角色配置不同的 AI Provider：

```env
# 默认使用 Ollama
DEFAULT_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:7b

# 旁白使用更强的模型
NARRATOR_PROVIDER=ollama
NARRATOR_MODEL=qwen2.5:14b

# 规则仲裁使用轻量级模型
RULE_ARBITER_PROVIDER=ollama
RULE_ARBITER_MODEL=deepseek-r1:8b

# 或者使用远程 API
DRAMA_CURATOR_PROVIDER=openai
DRAMA_CURATOR_MODEL=gpt-4o
OPENAI_API_KEY=sk-your-key
```

---

## 故障排除

### Ollama 连接失败

```bash
# 检查服务是否运行
curl http://localhost:11434/api/tags

# 手动启动服务
ollama serve

# 查看日志
ollama --version
```

### 模型未找到

```bash
# 拉取缺失的模型
ollama pull qwen2.5:7b

# 或使用已安装的模型
ollama list
```

### LM Studio / Jan 连接失败

1. 确认应用已启动 Local Server
2. 检查端口号是否正确
3. 测试端点：`curl http://localhost:1234/v1/models`

### 内存不足

```bash
# 使用更小的模型
ollama pull qwen2.5:1.5b

# 或启用量化版本
ollama pull qwen2.5:7b-q4_K_M
```

---

## 性能优化建议

### Apple Silicon (M1/M2/M3)

```bash
# Ollama 自动使用 GPU，无需额外配置
# 查看 GPU 使用情况
ollama ps
```

### 模型选择建议

| 内存 | 推荐模型 | 性能 |
|------|----------|------|
| 8GB | qwen2.5:1.5b / 3b | 流畅 |
| 16GB | qwen2.5:7b | 良好 |
| 32GB+ | qwen2.5:14b / 32b | 优秀 |

---

## 相关链接

- [Ollama 官网](https://ollama.com)
- [LM Studio](https://lmstudio.ai)
- [Jan 官网](https://jan.ai)
- [llama.cpp](https://github.com/ggerganov/llama.cpp)

---

*文档生成时间：2026-03-29*
*针对项目：AI 说书人委员会游戏引擎*
