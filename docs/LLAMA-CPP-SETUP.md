# llama.cpp 本地 AI 配置指南

llama.cpp 是底层推理引擎，Ollama 底层也是基于它。直接使用可以获得更精细的控制（量化级别、GPU 层数、上下文长度等）。

## 安装

```bash
# 方式一：Homebrew（推荐，简单）
brew install llama.cpp

# 方式二：从源码编译（获取最新特性）
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
make -j8  # 编译，-j8 表示用8个核心
```

## 下载模型

llama.cpp 使用 GGUF 格式的模型。推荐下载站点：

- **HuggingFace**: https://huggingface.co/models?search=gguf
- **Model Database**: https://ggml.ai/

推荐模型（适合你的 24GB Mac）：

```bash
# 创建模型目录
mkdir -p ~/.models/llama-cpp
cd ~/.models/llama-cpp

# 下载 Qwen2.5 7B（Q4_K_M 量化，约 4.3GB）
curl -L -o qwen2.5-7b-q4_k_m.gguf \
  "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf"

# 下载 Qwen2.5 14B（Q4_K_M 量化，约 8.5GB）
curl -L -o qwen2.5-14b-q4_k_m.gguf \
  "https://huggingface.co/Qwen/Qwen2.5-14B-Instruct-GGUF/resolve/main/qwen2.5-14b-instruct-q4_k_m.gguf"
```

> 如果下载慢，可以用 HuggingFace 镜像：
> `https://hf-mirror.com/Qwen/Qwen2.5-7B-Instruct-GGUF/...`

## 启动服务

### 基础启动（7B 模型）

```bash
llama-server \
  -m ~/.models/llama-cpp/qwen2.5-7b-q4_k_m.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  -c 8192 \
  -n 512 \
  --chat-template chatml
```

### 高性能启动（14B 模型，更多 GPU 层）

```bash
llama-server \
  -m ~/.models/llama-cpp/qwen2.5-14b-q4_k_m.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  -c 16384 \
  -n 1024 \
  -ngl 999 \
  --chat-template chatml \
  --parallel 4
```

参数说明：

| 参数 | 说明 |
|------|------|
| `-m` | 模型文件路径 |
| `--host/--port` | 监听地址和端口 |
| `-c` | 上下文长度（context size） |
| `-n` | 最大生成 token 数 |
| `-ngl` | GPU 层数（999 表示全部） |
| `--chat-template` | 对话模板（chatml 适合 Qwen） |
| `--parallel` | 并发请求数 |

## 验证服务

```bash
# 检查服务状态
curl http://localhost:8080/health

# 列出模型
curl http://localhost:8080/v1/models

# 测试对话
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-7b",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## 配置游戏引擎

编辑 `game/.env`：

```env
# 切换到 llama.cpp
DEFAULT_PROVIDER=local

# llama.cpp 配置
LOCAL_AI_ENDPOINT=http://localhost:8080/v1
LOCAL_AI_MODEL=qwen2.5-7b

# 各代理模型配置（可以都用同一个，也可以分别指定不同 GGUF 文件）
NARRATOR_PROVIDER=local
NARRATOR_MODEL=qwen2.5-14b

WORLD_KEEPER_PROVIDER=local
WORLD_KEEPER_MODEL=qwen2.5-7b

NPC_DIRECTOR_PROVIDER=local
NPC_DIRECTOR_MODEL=qwen2.5-7b

RULE_ARBITER_PROVIDER=local
RULE_ARBITER_MODEL=qwen2.5-7b

DRAMA_CURATOR_PROVIDER=local
DRAMA_CURATOR_MODEL=qwen2.5-7b
```

## 启动脚本

创建 `start-llama-server.sh`：

```bash
#!/bin/bash
MODEL_DIR="$HOME/.models/llama-cpp"
MODEL="${1:-qwen2.5-7b-q4_k_m.gguf}"
PORT="${2:-8080}"

if [ ! -f "$MODEL_DIR/$MODEL" ]; then
    echo "错误：模型文件不存在: $MODEL_DIR/$MODEL"
    echo "可用模型:"
    ls -la "$MODEL_DIR/"*.gguf 2>/dev/null || echo "  (无)"
    exit 1
fi

echo "启动 llama.cpp server..."
echo "模型: $MODEL"
echo "端口: $PORT"

llama-server \
    -m "$MODEL_DIR/$MODEL" \
    --host 127.0.0.1 \
    --port "$PORT" \
    -c 8192 \
    -n 1024 \
    -ngl 999 \
    --chat-template chatml \
    --parallel 2
```

使用：

```bash
chmod +x start-llama-server.sh

# 启动 7B 模型（默认）
./start-llama-server.sh

# 启动 14B 模型
./start-llama-server.sh qwen2.5-14b-q4_k_m.gguf

# 指定端口
./start-llama-server.sh qwen2.5-7b-q4_k_m.gguf 8081
```

## 多模型同时运行（高级）

如果你想同时跑多个模型（比如 7B 和 14B 各一个实例）：

```bash
# 终端 1：7B 模型
llama-server -m ~/.models/llama-cpp/qwen2.5-7b-q4_k_m.gguf --port 8080 -ngl 50 &

# 终端 2：14B 模型
llama-server -m ~/.models/llama-cpp/qwen2.5-14b-q4_k_m.gguf --port 8081 -ngl 50 &
```

然后在 `.env` 中分别配置：

```env
NARRATOR_PROVIDER=local
NARRATOR_MODEL=qwen2.5-14b
# 需要修改 LocalProvider 支持多端点，或手动指定
```

> 注：当前 LocalProvider 只支持单端点。如需多模型，建议用 Ollama 或启动多个 llama-server 配合不同端口。

## 性能调优参考

| 模型 | 量化 | 内存占用 | 推荐 -ngl | 速度 |
|------|------|---------|----------|------|
| Qwen2.5 7B | Q4_K_M | ~5GB | 999 | ~40 tok/s |
| Qwen2.5 14B | Q4_K_M | ~10GB | 999 | ~25 tok/s |
| Qwen2.5 14B | Q5_K_M | ~12GB | 999 | ~20 tok/s |

24GB RAM 可以同时跑 7B + 14B（各分配 50% GPU 层），但建议一次只跑一个，按需切换。

## 常见问题

**Q: `llama-server` 命令找不到？**
确保 `brew install llama.cpp` 成功，或检查 `/opt/homebrew/bin` 是否在 PATH 中。

**Q: 模型下载中断？**
用 `wget -c` 或 `curl -C -` 支持断点续传。

**Q: 中文输出乱码？**
确保使用 `--chat-template chatml` 参数，Qwen 模型需要这个模板。

**Q: 内存不足？**
减少 `-ngl` 值（GPU 层数），或换更小的模型/更高的量化级别（如 Q5_K_M → Q4_K_M）。
