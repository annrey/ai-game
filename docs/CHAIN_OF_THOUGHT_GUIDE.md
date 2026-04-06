# 思维链（Chain of Thought）使用指南

## 📖 简介

思维链（Chain of Thought，简称 CoT）是 AI 说书人委员会的核心功能之一。通过模拟人类的思考过程，AI 代理能够生成更高质量、更连贯的响应。思维链功能让每个 AI 代理在处理玩家请求时，都会经历**观察 → 分析 → 推理 → 决策 → 行动**的完整思考流程。

## 🎯 核心概念

### 思维链五步骤

每个思维链包含五个标准步骤：

1. **👁️ 观察（Observation）**
   - 描述当前情境、玩家输入的关键信息
   - 识别相关的上下文和环境因素
   - 示例："玩家选择向北走，进入了幽暗的森林。当前天气晴朗，时间是白天。"

2. **🧠 分析（Analysis）**
   - 分析玩家的真实意图和潜在需求
   - 评估情境的重要性和可能的影响
   - 示例："玩家似乎在探索新区域，可能对冒险充满好奇。需要描述森林的环境和可能的危险。"

3. **💭 推理（Reasoning）**
   - 基于世界观、规则和知识进行逻辑推理
   - 考虑因果关系和可能的结果
   - 示例："根据世界观设定，这片森林是精灵的领地，可能会有精灵巡逻队出现。"

4. **✅ 决策（Decision）**
   - 决定最佳的响应方式和行动方案
   - 平衡趣味性、一致性和玩家体验
   - 示例："应该先描述森林的环境，然后引入一个 NPC 相遇事件，增加趣味性。"

5. **🎯 行动（Action）**
   - 生成最终的响应内容
   - 执行具体的叙事或交互
   - 示例："生成叙事文本：你走进了一片幽暗的森林，阳光透过树叶洒下斑驳的光影..."

## 📝 数据结构

### ChainOfThought 接口

```typescript
interface ChainOfThought {
  /** 思维链 ID */
  id: string;
  /** AI 代理角色 */
  agentRole: AgentRole;
  /** 时间戳 */
  timestamp: number;
  /** 思维步骤 */
  steps: CoTStep[];
  /** 思维链摘要 */
  summary: string;
}
```

### CoTStep 接口

```typescript
interface CoTStep {
  /** 步骤类型 */
  step: 'observation' | 'analysis' | 'reasoning' | 'decision' | 'action';
  /** 步骤标题 */
  title: string;
  /** 步骤内容 */
  content: string;
  /** 思考耗时（毫秒） */
  duration?: number;
}
```

## 🔧 使用方法

### 在 AI 响应中使用思维链

AI 代理在处理请求时会自动生成思维链。以下是示例：

```typescript
import { Narrator } from './agents/narrator.js';
import { OpenAIProvider } from './providers/openai-provider.js';

const provider = new OpenAIProvider();
const narrator = new Narrator(provider);

const response = await narrator.process({
  from: 'player',
  content: '我向北走，探索前方的森林',
  context: {
    location: '起始之地',
    time: '白天',
    weather: '晴朗',
  },
});

// 访问思维链
console.log('思维链摘要:', response.chainOfThought?.summary);
console.log('思考步骤:');
response.chainOfThought?.steps.forEach((step, index) => {
  console.log(`${index + 1}. ${step.title}: ${step.content}`);
});
```

### 引导 AI 生成思维链

在系统提示词中添加思维链结构要求：

```typescript
const systemPrompt = `
你是一个专业的 AI 说书人。请在生成响应时，按照以下结构展示你的思考过程：

【观察】
描述你观察到的当前情境、玩家输入的关键信息、相关的上下文等。

【分析】
分析情境的重要性、玩家的真实意图、可能的影响因素等。

【推理】
基于你的知识和规则，推理出可能的结果、因果关系、逻辑链条等。

【决策】
基于推理结果，决定最佳的响应方式、行动方案等。

【行动】
描述你将采取的具体行动或生成的响应内容。

这种结构化的思考过程有助于提高响应的质量和一致性。
`;
```

### 思维链标记格式

AI 可以使用多种标记格式，系统都能正确解析：

**中文标记：**
```
【观察】内容...
【分析】内容...
【推理】内容...
【决策】内容...
【行动】内容...
```

**英文标记：**
```
[Observation] 内容...
[Analysis] 内容...
[Reasoning] 内容...
[Decision] 内容...
[Action] 内容...
```

**Markdown 标记：**
```
## Observation
内容...

## Analysis
内容...
```

## 🌐 API 端点

### 获取当前思维链

```bash
GET /api/cot/current
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "current": {
      "id": "uuid-here",
      "agentRole": "narrator",
      "timestamp": 1234567890,
      "steps": [
        {
          "step": "observation",
          "title": "👁️ 观察",
          "content": "玩家说\"我向北走\"...",
          "duration": 200
        }
      ],
      "summary": "👁️ 观察：收到请求... | 🧠 分析：分析请求内容..."
    }
  }
}
```

### 获取思维链历史

```bash
GET /api/cot/history?limit=10&offset=0&agentRole=narrator
```

**查询参数：**
- `limit` - 每页数量（默认：10）
- `offset` - 偏移量（默认：0）
- `agentRole` - 按代理角色过滤（可选）

### 展开思维链步骤

```bash
POST /api/cot/expand
Content-Type: application/json

{
  "stepId": "observation",
  "cotId": "uuid-here" // 可选，默认当前思维链
}
```

### 获取思维链统计

```bash
GET /api/cot/stats
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalChainsOfThought": 150,
      "avgThinkingTime": 850,
      "avgStepsPerCot": 4.8
    },
    "byAgent": {
      "narrator": {
        "count": 50,
        "totalDuration": 45000,
        "avgDuration": 900,
        "totalSteps": 240
      }
    },
    "qualityMetrics": {
      "highQualityCount": 120,
      "mediumQualityCount": 25,
      "lowQualityCount": 5,
      "qualityScore": "80.0"
    }
  }
}
```

### 思维链事件流（SSE）

```bash
GET /api/cot/events
```

实时推送思维链更新，适用于前端实时更新。

## 📊 质量指标

### 思维链质量评估

系统根据思维链的完整性自动评估质量：

- **高质量**：包含 4-5 个步骤
- **中质量**：包含 2-3 个步骤
- **低质量**：只包含 0-1 个步骤

### 性能指标

- **平均思考时间**：所有思维链的平均耗时
- **步骤分布**：各步骤的耗时分布
- **代理对比**：不同代理的思维链质量对比

## 🛠️ 最佳实践

### 1. 提供充足的上下文

```typescript
// ✅ 好的做法
await agent.process({
  from: 'player',
  content: '我想买一把剑',
  context: {
    location: '铁匠铺',
    currentNPC: '铁匠约翰',
    playerGold: 100,
    inventory: ['木盾', '药水'],
  },
});

// ❌ 不好的做法
await agent.process({
  from: 'player',
  content: '我想买一把剑',
});
```

### 2. 在系统提示词中明确要求思维链

```typescript
const config: AgentConfig = {
  role: 'narrator',
  name: '故事叙述者',
  description: '负责主叙事',
  systemPrompt: `
你是一个专业的 AI 说书人。

请在生成响应时，按照以下结构展示你的思考过程：
【观察】...
【分析】...
【推理】...
【决策】...
【行动】...
`,
};
```

### 3. 利用思维链进行调试

```typescript
const response = await agent.process(request);

if (response.chainOfThought) {
  console.log('=== 思维链调试信息 ===');
  console.log('代理角色:', response.chainOfThought.agentRole);
  console.log('总耗时:', response.chainOfThought.steps.reduce(
    (sum, step) => sum + (step.duration || 0), 0
  ), 'ms');
  
  response.chainOfThought.steps.forEach(step => {
    console.log(`\n${step.title} (${step.duration}ms):`);
    console.log(step.content);
  });
}
```

### 4. 监控思维链质量

定期检查思维链统计信息，确保 AI 代理的思考质量：

```typescript
// 定期检查思维链质量
const stats = await fetch('/api/cot/stats');
const data = await stats.json();

if (data.data.qualityMetrics.lowQualityCount > 10) {
  console.warn('低质量思维链过多，可能需要调整提示词');
}
```

## 🔍 故障排查

### 思维链为空

**问题：** `response.chainOfThought` 为 `undefined`

**可能原因：**
1. AI 响应解析失败
2. 网络错误导致响应不完整

**解决方案：**
```typescript
try {
  const response = await agent.process(request);
  if (!response.chainOfThought) {
    console.warn('思维链生成失败，使用默认思维链');
    // 可以手动生成一个简化的思维链
  }
} catch (error) {
  console.error('处理请求时出错:', error);
}
```

### 思维链步骤不完整

**问题：** 只包含部分步骤（如只有观察和行动）

**可能原因：**
1. AI 没有完全遵循思维链格式
2. 响应被截断

**解决方案：**
- 在系统提示词中强调完整的思维链结构
- 增加响应长度限制
- 使用思维链提示词模板

### 思维链耗时过长

**问题：** 某些步骤耗时异常长

**可能原因：**
1. 网络延迟
2. AI 模型响应慢
3. 请求过于复杂

**解决方案：**
- 检查网络连接
- 考虑使用更快的 AI 模型
- 简化请求上下文

## 📚 相关资源

- [BaseAgent 实现](../src/agents/base-agent.ts) - 查看思维链提取的源代码
- [Agent 类型定义](../src/types/agent.ts) - 查看完整的类型定义
- [Narrator 代理](../src/agents/narrator.ts) - 查看思维链在实际代理中的使用

## 📝 测试示例

```typescript
import { describe, it, expect } from 'vitest';
import { BaseAgent } from '../base-agent.js';
import { MockProvider } from '../../test/mock-provider.js';

describe('思维链测试', () => {
  it('应能提取完整的思维链', async () => {
    const provider = new MockProvider();
    const agent = new TestAgent(provider);
    
    const contentWithCoT = `
【观察】玩家说"我向北走"
【分析】玩家想要探索北方区域
【推理】北方有一座神秘的城堡
【决策】描述城堡的外观
【行动】生成叙事文本
`;
    
    provider.addResponse(contentWithCoT);
    
    const response = await agent.process({
      from: 'player',
      content: '我向北走',
    });
    
    expect(response.chainOfThought).toBeDefined();
    expect(response.chainOfThought?.steps).toHaveLength(5);
  });
});
```

---

**最后更新：** 2026-04-06
**版本：** 0.1.0
