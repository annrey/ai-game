#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-3000}"
SDXL_VENV_DIR="${SDXL_VENV_DIR:-$ROOT_DIR/.sdxl-venv}"
SDXL_PYTHON="${SDXL_PYTHON:-$SDXL_VENV_DIR/bin/python3}"

if [ "${1:-}" != "" ]; then
  PORT="$1"
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   AI 说书人委员会 · 一键启动             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "✗ 未检测到 Node.js，请先安装 Node.js (>=18)"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "✗ 未检测到 npm，请先安装 Node.js"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "• 安装依赖..."
  npm install
fi

echo ""
if [ ! -x "$SDXL_PYTHON" ]; then
  echo "• 创建 SDXL Python 虚拟环境..."
  python3 -m venv "$SDXL_VENV_DIR"
fi

echo "• 检查 SDXL 依赖..."
if ! "$SDXL_PYTHON" - <<'PY' >/dev/null 2>&1
import importlib.util, sys
mods=['torch','diffusers','transformers','accelerate','safetensors','PIL']
missing=[m for m in mods if importlib.util.find_spec(m) is None]
raise SystemExit(1 if missing else 0)
PY
then
  echo "• 安装 SDXL 真实生成依赖..."
  "$SDXL_PYTHON" -m pip install --upgrade pip
  "$SDXL_PYTHON" -m pip install -r "$ROOT_DIR/scripts/requirements-sdxl.txt"
fi

export PREVIEW_PYTHON="$SDXL_PYTHON"
export HF_ENDPOINT="${HF_ENDPOINT:-https://hf-mirror.com}"
PIXEL_MODEL_DIR="${PIXEL_MODEL_DIR:-/Users/chengyongwei/Documents/326_ckpt_SD_XL}"
MODEL_FILE="$(find "$PIXEL_MODEL_DIR" -maxdepth 1 -name '*.safetensors' | head -n 1 || true)"

if [ -n "$MODEL_FILE" ] && head -n 1 "$MODEL_FILE" 2>/dev/null | grep -q 'git-lfs.github.com/spec/v1'; then
  echo ""
  echo "• 检测到 SDXL 权重仍是 git-lfs 指针文件"
  if ! command -v git-lfs >/dev/null 2>&1 && command -v brew >/dev/null 2>&1; then
    echo "• 安装 git-lfs..."
    brew install git-lfs || true
  fi
  if command -v git-lfs >/dev/null 2>&1; then
    echo "• 拉取 SDXL 真实权重..."
    git lfs install
    git -C "$PIXEL_MODEL_DIR" lfs pull || true
  else
    echo "✗ 未检测到 git-lfs，无法自动拉取 SDXL 权重"
  fi
fi

if command -v ollama >/dev/null 2>&1; then
  if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    :
  else
    echo "• 启动 Ollama 服务..."
    (nohup ollama serve >/dev/null 2>&1 &) || true
    for _ in $(seq 1 30); do
      if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        break
      fi
      sleep 0.2
    done
  fi

  if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo ""
    echo "• 扫描本地已安装的 Ollama 模型："
    ollama list || true
  else
    echo ""
    echo "✗ Ollama 服务未就绪：请手动运行 ollama serve"
  fi
else
  echo ""
  echo "• 未检测到 ollama 命令，跳过本地模型扫描"
fi

echo ""
if curl -s http://localhost:1234/v1/models >/dev/null 2>&1; then
  echo "• 检测到 LM Studio，模型列表："
  curl -s http://localhost:1234/v1/models | python3 - <<'PY'
import json, sys
data=json.load(sys.stdin)
for item in data.get("data", []):
    print("-", item.get("id") or item.get("name") or "unknown")
PY
else
  echo "• 未检测到 LM Studio 接口（默认 http://localhost:1234/v1/models）"
fi

echo ""
if curl -s http://localhost:1337/v1/models >/dev/null 2>&1; then
  echo "• 检测到 Jan，模型列表："
  curl -s http://localhost:1337/v1/models | python3 - <<'PY'
import json, sys
data=json.load(sys.stdin)
for item in data.get("data", []):
    print("-", item.get("id") or item.get("name") or "unknown")
PY
else
  echo "• 未检测到 Jan 接口（默认 http://localhost:1337/v1/models）"
fi

echo ""
echo "• 启动 Web 服务：http://localhost:${PORT}"
echo "  如需换端口：PORT=3005 ./start-web.sh 或 ./start-web.sh 3005"
echo ""

PORT="${PORT}" npm run server:watch
