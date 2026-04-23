# 任务清单：意图识别节点

- [x] 定义 `intent_recognition` 的共享输出结构，统一识别结果、置信度分层、路由决策与事件契约。
- [x] 复用现有 `CommandAnalysis` / `CommandAnalyzer` 能力完成最小识别闭环，并保留 fallback 分析路径。
- [x] 写入识别结果与置信度事件，沉淀快照用于回放、对账与后续节点消费。
- [x] 验证与命令列表、推荐命令的联动，补齐 adapter 与 route 的最小测试闭环。
