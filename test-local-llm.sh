#!/bin/bash
# 本地大模型测试脚本

set -a
source .env.test.local
set +a

echo "=========================================="
echo "本地大模型测试 - AI 说书人委员会"
echo "=========================================="
echo ""

# 测试1: 检测本地服务
echo "🔍 测试1: 检测本地模型服务..."
echo "  - LM Studio (1234): $(curl -s -o /dev/null -w '%{http_code}' http://localhost:1234/v1/models 2>/dev/null || echo '无法连接')"
echo "  - Jan (1337): $(curl -s -o /dev/null -w '%{http_code}' http://localhost:1337/v1/models 2>/dev/null || echo '无法连接')"
echo "  - Ollama (11434): $(curl -s -o /dev/null -w '%{http_code}' http://localhost:11434/api/tags 2>/dev/null || echo '无法连接')"
echo ""

# 测试2: 运行 Demo
echo "🎮 测试2: 运行交互式 Demo (15秒)..."
echo "   配置: DEFAULT_PROVIDER=$DEFAULT_PROVIDER, MODEL=$OLLAMA_MODEL"
echo ""
npx tsx src/demo.ts &
DEMO_PID=$!
sleep 15
kill $DEMO_PID 2>/dev/null || true
echo ""

# 测试3: 运行单元测试
echo "🧪 测试3: 运行单元测试..."
npm test 2>&1 | tail -20
echo ""

# 测试4: 构建检查
echo "🔨 测试4: TypeScript 构建检查..."
npm run build 2>&1 | tail -10
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
