# 任务清单：问答检索节点

- [x] 定义问答检索输入输出
- [x] 对接知识或 FAQ 数据源
- [x] 输出匹配分值
- [x] 与对话节点联调

## 本轮收口说明

- `qa_search` 已复用现有 `KnowledgeService.query()` 检索底座完成最小闭环。
- 已补齐 `matches / score / context` 以及 `metadata / observability / downstreamConsumers`，便于条件分支、对话节点与变量写入节点消费。
- 当前能力定位仍是知识检索轻量变体，不等同于独立 FAQ 平台；若后续需要专门 FAQ 库，可在此基础上继续扩展数据源与召回策略。
