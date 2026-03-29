# 本地 AI 配置总览

## 当前已安装

### Ollama 模型
| 模型 | 大小 | 用途 | 状态 |
|------|------|------|------|
| qwen2.5:14b | 9.0 GB | 主叙事（高质量） | ✅ 已安装 |
| qwen2.5:7b | 4.7 GB | 辅助代理（快速） | ✅ 已安装 |
| deepseek-r1:8b | 5.2 GB | 规则推理（逻辑强） | ✅ 已安装 |

### Jan 模型（需确认）
Jan 使用自己的模型存储，需要在 Jan 应用内下载：
- [ ] Qwen 2.5 7B Instruct
- [ ] Qwen 2.5 14B Instruct
- [ ] DeepSeek R1 8B（可选）

---

## 本地方案对比

| 方案 | 安装状态 | 适用场景 | 推荐度 |
|------|---------|---------|--------|
| **Ollama** | ✅ 已安装 | 日常使用、后台服务 | ⭐⭐⭐⭐⭐ |
| **Jan** | ⚠️ 需配置 | 可视化调试、对话管理 | ⭐⭐⭐⭐ |
| **LM Studio** | ❌ 未安装 | 快速体验、模型比较 | ⭐⭐⭐ |
| **llama.cpp** | ❌ 未安装 | 极致性能、精细控制 | ⭐⭐⭐ |

---

## 推荐配置策略

### 方案 A：Ollama 主力（推荐）
```bash
# 使用你已安装的模型
DEFAULT_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:14b

# 各代理分配
NARRATOR_MODEL=qwen2.5:14b      # 主叙事
WORLD_KEEPER_MODEL=qwen2.5:7b   # 世界观
NPC_DIRECTOR_MODEL=qwen2.5:7b   # NPC
RULE_ARBITER_MODEL=deepseek-r1:8b  # 规则推理
DRAMA_CURATOR_MODEL=qwen2.5:7b  # 剧情
```

**优点**：
- 你已安装好，立即可用
- 命令行管理方便
- 内存占用可控

### 方案 B：Jan 主力
```bash
# 需要先在 Jan 内下载模型
DEFAULT_PROVIDER=local
LOCAL_AI_ENDPOINT=http://localhost:1337/v1
```

**优点**：
- 漂亮的 GUI 界面
- 对话历史自动保存
- 一键切换模型

**缺点**：
- 需要重新下载模型（Jan 用不同格式）
- 内存占用稍高

### 方案 C：混合使用
- Ollama 跑 14B（主叙事）
- Jan 跑 7B（快速测试）
- 通过 `switch-backend.sh` 切换

---

## 还缺少什么？

### 可选补充（按优先级）

1. **LM Studio**（最简单 GUI）
   ```bash
   # 下载地址
   https://lmstudio.ai/
   
   # 优点：安装即用，无需配置
   # 缺点：闭源，功能相对简单
   ```

2. **llama.cpp**（进阶控制）
   ```bash
   brew install llama.cpp
   
   # 优点：底层控制，性能最优
   # 缺点：需要手动下载 GGUF 模型
   ```

3. **更多模型**（可选）
   ```bash
   # 代码专用
   ollama pull codellama:7b
   
   # 英文场景
   ollama pull llama3.1:8b
   
   # 轻量级快速响应
   ollama pull qwen2.5:3b
   ```

---

## 快速切换命令

```bash
cd ~/Documents/openclaw-main/game

# 查看状态
./switch-backend.sh status

# 切换到 Ollama（推荐日常使用）
./switch-backend.sh ollama

# 切换到 Jan（可视化调试）
./switch-backend.sh jan

# 测试连通性
npx tsx src/test-local.ts

# 运行游戏
npm run demo
```

---

## 内存使用参考

你的 24GB Mac 可以同时运行：

| 组合 | 内存占用 | 可行性 |
|------|---------|--------|
| 14B 单独 | ~10GB | ✅ 流畅 |
| 7B + 7B | ~10GB | ✅ 流畅 |
| 14B + 7B | ~15GB | ✅ 可运行 |
| 14B + 14B | ~20GB | ⚠️ 紧张 |

---

## 下一步建议

1. **立即使用**：用 Ollama 方案（已配置好）
   ```bash
   ./switch-backend.sh ollama
   npm run demo
   ```

2. **体验 Jan**：下载 Jan 并导入模型
   - 下载：https://jan.ai/
   - 在 Hub 搜索 Qwen 2.5 下载
   - 启用 API Server

3. **补充 llama.cpp**：如果需要极致性能控制
   ```bash
   brew install llama.cpp
   # 参考 docs/LLAMA-CPP-SETUP.md
   ```
