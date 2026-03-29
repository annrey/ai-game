#!/bin/bash
# ============================================
# AI 说书人委员会 — Mac 本地 AI 一键搭建
# ============================================
# 用法：在 Mac 终端中执行
#   cd ~/Documents/openclaw-main/game
#   bash setup-local-ai.sh
# ============================================

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║   AI 说书人委员会 — 本地环境搭建         ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ---- Step 1: 检查 / 安装 Ollama ----
echo -e "${YELLOW}[1/5] 检查 Ollama...${NC}"
if command -v ollama &> /dev/null; then
    echo -e "  ${GREEN}✓ Ollama 已安装${NC} ($(ollama --version 2>/dev/null || echo 'unknown version'))"
else
    echo -e "  ${YELLOW}未检测到 Ollama，正在安装...${NC}"
    if command -v brew &> /dev/null; then
        brew install ollama
        echo -e "  ${GREEN}✓ Ollama 安装完成（Homebrew）${NC}"
    else
        echo -e "  ${RED}未检测到 Homebrew。请手动安装 Ollama：${NC}"
        echo -e "  ${CYAN}https://ollama.com/download${NC}"
        echo ""
        echo "  安装完成后重新运行本脚本。"
        exit 1
    fi
fi

# ---- Step 2: 确保 Ollama 服务运行 ----
echo -e "\n${YELLOW}[2/5] 确保 Ollama 服务运行...${NC}"
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Ollama 服务已在运行${NC}"
else
    echo -e "  ${YELLOW}启动 Ollama 服务...${NC}"
    ollama serve &> /dev/null &
    sleep 3
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Ollama 服务已启动${NC}"
    else
        echo -e "  ${RED}Ollama 服务启动失败，请手动运行: ollama serve${NC}"
        exit 1
    fi
fi

# ---- Step 3: 拉取推荐模型 ----
echo -e "\n${YELLOW}[3/5] 拉取推荐模型...${NC}"

# 检查已有模型
EXISTING_MODELS=$(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}')

pull_if_missing() {
    local model=$1
    local desc=$2
    if echo "$EXISTING_MODELS" | grep -q "^${model}$"; then
        echo -e "  ${GREEN}✓ ${model} 已存在${NC}"
    else
        echo -e "  ${CYAN}拉取 ${model}（${desc}）...${NC}"
        ollama pull "$model"
        echo -e "  ${GREEN}✓ ${model} 拉取完成${NC}"
    fi
}

# 先拉 7B（更快，可以尽早开始测试）
pull_if_missing "qwen2.5:7b" "约4.7GB，辅助代理用"

echo ""
echo -e "  ${YELLOW}提示：14B 模型约 9GB，下载需要几分钟。${NC}"
echo -e "  ${YELLOW}如果想跳过，按 Ctrl+C，7B 已经足够开始体验。${NC}"
echo ""

pull_if_missing "qwen2.5:14b" "约9GB，主叙事用"

# ---- Step 4: 安装 Node.js 依赖 ----
echo -e "\n${YELLOW}[4/5] 安装项目依赖...${NC}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -d "node_modules" ]; then
    echo -e "  ${GREEN}✓ node_modules 已存在${NC}"
else
    if command -v pnpm &> /dev/null; then
        pnpm install
    elif command -v npm &> /dev/null; then
        npm install
    else
        echo -e "  ${RED}未检测到 npm 或 pnpm，请先安装 Node.js${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}✓ 依赖安装完成${NC}"
fi

# ---- Step 5: 运行连通性测试 ----
echo -e "\n${YELLOW}[5/5] 运行连通性测试...${NC}\n"
npx tsx src/test-local.ts

# ---- 完成 ----
echo -e "\n${BOLD}${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║   搭建完成！可以开始游戏了               ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "启动游戏："
echo -e "  ${CYAN}npx tsx src/demo.ts${NC}                  # 默认模式"
echo -e "  ${CYAN}npx tsx src/demo.ts --mode adventure${NC}  # 文字冒险"
echo -e "  ${CYAN}npx tsx src/demo.ts --mode battle${NC}     # AI 对战"
echo -e "  ${CYAN}npx tsx src/demo.ts --mode sandbox${NC}    # NPC 沙盒"
echo -e "  ${CYAN}npx tsx src/demo.ts --mode roleplay${NC}   # 聊天扮演"
echo ""
echo -e "如果只安装了 7B 模型，可先修改 .env 将所有模型统一为 qwen2.5:7b："
echo -e "  ${CYAN}sed -i '' 's/qwen2.5:14b/qwen2.5:7b/g' .env${NC}"
echo ""
