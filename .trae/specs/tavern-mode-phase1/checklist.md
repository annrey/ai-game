# 酒馆模式第一阶段 - 验证清单

## 规则引擎增强验证
- [ ] RuleNode 类型新增 regexPatterns 字段
- [ ] RuleNode 类型新增 insertionOrder 字段
- [ ] RuleNode 类型新增 insertPosition 字段
- [ ] RuleNode 类型新增 insertDepth 字段
- [ ] RuleNode 类型新增 insertRole 字段
- [ ] 向后兼容，现有规则无需修改可加载
- [ ] 新字段有合理的默认值
- [ ] RuleEngine 支持正则表达式匹配
- [ ] 正则表达式格式正确（/pattern/flags）
- [ ] 正则匹配与关键词匹配可同时工作
- [ ] 匹配分数计算合理
- [ ] 规则按 insertionOrder 正确排序
- [ ] 插入位置策略生效
- [ ] Token 预算时优先级高的规则优先保留
- [ ] 规则引擎单元测试通过

## 时间系统验证
- [ ] GameTime 类型定义完整（hour, minute, day, phase）
- [ ] TimePhase 枚举定义完整（morning, noon, afternoon, evening, night）
- [ ] StateStore 支持时间状态存储
- [ ] 时间状态可正确读取
- [ ] 时间流逝逻辑正确
- [ ] 时间流逝方式可配置（回合数 vs 现实时间）
- [ ] 时间系统单元测试通过

## NPC 状态系统验证
- [ ] NPCActivity 类型定义完整
- [ ] NPCMood 类型定义完整
- [ ] NPCState 类型定义完整
- [ ] StateStore 支持 NPC 状态存储
- [ ] NPC 状态可正确读取
- [ ] 预定义酒馆 NPC 活动模板合理
- [ ] 预定义酒馆 NPC 心情模板合理
- [ ] NPC 状态单元测试通过

## NPC-Director 扩展验证
- [ ] NPC-Director 根据时间选择活动
- [ ] NPC 活动随时间正确变化
- [ ] NPC-Director 根据互动调整心情
- [ ] NPC 心情可通过互动正确调整
- [ ] getNPCState() 方法正常工作
- [ ] updateNPCActivity() 方法正常工作
- [ ] updateNPCMood() 方法正常工作
- [ ] NPC-Director 单元测试通过

## NPC 记忆系统验证
- [ ] 每个 NPC 有独立的记忆上下文
- [ ] NPC 记忆可正确存储
- [ ] NPC 记忆可正确检索
- [ ] 记忆重要性评分机制合理
- [ ] NPC 对话生成时注入相关记忆
- [ ] NPC 对话中能引用过去的互动
- [ ] 记忆系统集成测试通过

## UI 扩展验证
- [ ] UI 显示当前时间
- [ ] UI 显示昼夜阶段
- [ ] 时间显示位置合理
- [ ] 右侧面板显示 NPC 列表
- [ ] 每个 NPC 显示名字
- [ ] 每个 NPC 显示当前活动
- [ ] 每个 NPC 显示心情表情
- [ ] UI 与后端 API 正确集成
- [ ] 状态更新及时反映
- [ ] UI 布局合理美观

## 整体集成验证
- [ ] 所有功能协同工作
- [ ] 向后兼容现有功能
- [ ] 现有游戏模式不受影响
- [ ] 酒馆模式可以正常启动
- [ ] 本地 AI 响应时间在可接受范围内
- [ ] 无明显 bug
- [ ] 单元测试覆盖率 >= 70%
- [ ] 所有单元测试通过
- [ ] 端到端测试通过
- [ ] 性能测试通过
- [ ] 用户体验走查通过
