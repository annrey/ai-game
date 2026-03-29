#!/bin/bash
# ============================================
# AI 说书人委员会 — 后端切换脚本
# ============================================
# 用法：./switch-backend.sh [ollama|jan|llamacpp|lmstudio]
# ============================================

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

show_help() {
    echo -e "${BOLD}用法:${NC} ./switch-backend.sh [选项]"
    echo ""
    echo "选项:"
    echo "  ollama      切换到 Ollama 后端（默认）"
    echo "  jan         切换到 Jan 后端"
    echo "  llamacpp    切换到 llama.cpp 后端"
    echo "  lmstudio    切换到 LM Studio 后端"
    echo "  status      查看当前配置状态"
    echo "  help        显示此帮助"
    echo ""
    echo "示例:"
    echo "  ./switch-backend.sh jan"
}

show_status() {
    echo -e "${BOLD}${CYAN}当前配置状态${NC}\n"

    if [ -f ".env" ]; then
        PROVIDER=$(grep "^DEFAULT_PROVIDER=" .env | cut -d'=' -f2 || echo "unknown")
        ENDPOINT=$(grep "^LOCAL_AI_ENDPOINT=" .env | cut -d'=' -f2 || echo "unknown")

        echo -e "默认后端: ${GREEN}$PROVIDER${NC}"

        if [ "$PROVIDER" = "local" ]; then
            case "$ENDPOINT" in
                *":1234"*)
                    echo -e "检测工具: ${GREEN}LM Studio${NC} (端口 1234)"
                    ;;
                *":1337"*)
                    echo -e "检测工具: ${GREEN}Jan${NC} (端口 1337)"
                    ;;
                *":8080"*)
                    echo -e "检测工具: ${GREEN}llama.cpp${NC} (端口 8080)"
                    ;;
                *)
                    echo -e "检测工具: ${YELLOW}未知${NC} ($ENDPOINT)"
                    ;;
            esac
        fi

        echo ""
        echo "各代理配置:"
        grep "^NARRATOR_PROVIDER=" .env | sed 's/^/  /'
        grep "^NARRATOR_MODEL=" .env | sed 's/^/  /'
    else
        echo -e "${RED}错误：找不到 .env 文件${NC}"
    fi
}

switch_to_ollama() {
    echo -e "${YELLOW}切换到 Ollama 后端...${NC}"

    cat > .env << 'EOF'
# ============================================
# AI 说书人委员会 — Ollama 后端配置
# ============================================

DEFAULT_PROVIDER=ollama

# Ollama 配置
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b

# Local AI 占位（未使用）
LOCAL_AI_ENDPOINT=http://localhost:1234/v1
LOCAL_AI_MODEL=local-model

# 各代理配置
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

    echo -e "${GREEN}✓ 已切换到 Ollama 后端${NC}"
    echo ""
    echo "请确保 Ollama 服务在运行："
    echo -e "  ${CYAN}ollama serve${NC}"
    echo ""
    echo "测试连接："
    echo -e "  ${CYAN}npx tsx src/test-local.ts${NC}"
}

switch_to_jan() {
    echo -e "${YELLOW}切换到 Jan 后端...${NC}"

    cat > .env << 'EOF'
# ============================================
# AI 说书人委员会 — Jan 后端配置
# ============================================

DEFAULT_PROVIDER=local

# Ollama 占位（未使用）
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b

# Jan 配置（默认端口 1337）
LOCAL_AI_ENDPOINT=http://localhost:1337/v1
LOCAL_AI_MODEL=qwen2.5-7b-instruct

# 各代理配置
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

GAME_LANGUAGE=zh-CN
LOG_LEVEL=info
EOF

    echo -e "${GREEN}✓ 已切换到 Jan 后端${NC}"
    echo ""
    echo "请确保："
    echo "  1. Jan 应用已启动"
    echo "  2. API Server 已启用（设置 → Advanced → API Server）"
    echo "  3. 已下载 qwen2.5-7b-instruct 和 qwen2.5-14b-instruct 模型"
    echo ""
    echo "测试连接："
    echo -e "  ${CYAN}npx tsx src/test-local.ts${NC}"
}

switch_to_llamacpp() {
    echo -e "${YELLOW}切换到 llama.cpp 后端...${NC}"

    cat > .env << 'EOF'
# ============================================
# AI 说书人委员会 — llama.cpp 后端配置
# ============================================

DEFAULT_PROVIDER=local

# Ollama 占位（未使用）
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b

# llama.cpp 配置（默认端口 8080）
LOCAL_AI_ENDPOINT=http://localhost:8080/v1
LOCAL_AI_MODEL=qwen2.5-7b

# 各代理配置
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

GAME_LANGUAGE=zh-CN
LOG_LEVEL=info
EOF

    echo -e "${GREEN}✓ 已切换到 llama.cpp 后端${NC}"
    echo ""
    echo "请确保："
    echo "  1. llama-server 已在运行"
    echo "     ${CYAN}llama-server -m ~/.models/llama-cpp/qwen2.5-7b-q4_k_m.gguf --port 8080 -ngl 999${NC}"
    echo "  2. 已下载 GGUF 模型文件"
    echo ""
    echo "详细配置见 docs/LLAMA-CPP-SETUP.md"
    echo ""
    echo "测试连接："
    echo -e "  ${CYAN}npx tsx src/test-local.ts${NC}"
}

switch_to_lmstudio() {
    echo -e "${YELLOW}切换到 LM Studio 后端...${NC}"

    cat > .env << 'EOF'
# ============================================
# AI 说书人委员会 — LM Studio 后端配置
# ============================================

DEFAULT_PROVIDER=local

# Ollama 占位（未使用）
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b

# LM Studio 配置（默认端口 1234）
LOCAL_AI_ENDPOINT=http://localhost:1234/v1
LOCAL_AI_MODEL=loaded-model-name

# 各代理配置
NARRATOR_PROVIDER=local
NARRATOR_MODEL=loaded-model-name

WORLD_KEEPER_PROVIDER=local
WORLD_KEEPER_MODEL=loaded-model-name

NPC_DIRECTOR_PROVIDER=local
NPC_DIRECTOR_MODEL=loaded-model-name

RULE_ARBITER_PROVIDER=local
RULE_ARBITER_MODEL=loaded-model-name

DRAMA_CURATOR_PROVIDER=local
DRAMA_CURATOR_MODEL=loaded-model-name

GAME_LANGUAGE=zh-CN
LOG_LEVEL=info
EOF

    echo -e "${GREEN}✓ 已切换到 LM Studio 后端${NC}"
    echo ""
    echo "请确保："
    echo "  1. LM Studio 已启动"
    echo "  2. 在左侧 'Local Server' 面板启动了 API 服务"
    echo "  3. 已加载模型"
    echo ""
    echo "测试连接："
    echo -e "  ${CYAN}npx tsx src/test-local.ts${NC}"
}

# 主逻辑
case "${1:-}" in
    ollama)
        switch_to_ollama
        ;;
    jan)
        switch_to_jan
        ;;
    llamacpp|llama.cpp|llama-cpp)
        switch_to_llamacpp
        ;;
    lmstudio|lm-studio)
        switch_to_lmstudio
        ;;
    status|s)
        show_status
        ;;
    help|--help|-h)
        show_help
        ;;
    "")
        echo -e "${YELLOW}请指定要切换的后端${NC}"
        echo ""
        show_help
        exit 1
        ;;
    *)
        echo -e "${RED}未知选项: $1${NC}"
        show_help
        exit 1
        ;;
esac
