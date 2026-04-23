# 任务清单：Web-AIGC 平台实例与会话

- [x] 定义实例列表接口模型
- [x] 定义实例详情与节点详情模型
- [x] 定义实例关联会话接口模型
- [x] 打通强制终止与任务取消链路
- [x] 为监控 UI 准备状态颜色与文本映射

## 2026-04-23 中文收口说明

- [x] 已确认 `DecisionPanel` 的 `param_collection` 提交会携带 `nodeId / sessionId / interactionId / branchKey / formData`
- [x] 已确认 `mission-decision` 会对 `param_collection` 表单值做服务端归一化，并把 HITL metadata 写回 `resolved.metadata`
- [x] 已确认 `decisionHistory` 顶层已沉淀 `nodeId / nodeType / sessionId / interactionId / branchKey`，便于 session-instance / monitoring 直接消费
- [x] 已确认定向测试覆盖 `selection` 元数据保留、`param_collection` 附件归一化、审计摘要字段验证

当前结论：

- session-instance / monitoring 这一轮优先收紧的是人工决策元数据的可追踪性，而不是继续增加新的 specs。
- 按当前主线事实，已经具备按 `sessionId + nodeId + interactionId` 回看 HITL 决策历史的最小闭环。
