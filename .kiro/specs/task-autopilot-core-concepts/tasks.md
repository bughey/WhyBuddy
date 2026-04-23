# 任务清单：任务自动驾驶核心概念

- [ ] 定义 `Destination`、`Route`、`Drive State`、`Fleet`、`Takeover Point`、`Replan`、`Confidence`、`Risk` 的统一中文语义
- [ ] 明确核心对象的边界，避免与现有 `mission / workflow / task` 直接混用
- [ ] 补充核心对象之间的主链路关系与决策关系
- [ ] 定义 `Destination -> mission`、`Route -> workflow`、`Drive State -> runtime state` 的映射口径
- [ ] 定义 `Fleet -> agents / skills / nodes / executors` 的映射口径
- [ ] 定义 `Takeover Point` 与 HITL / decision / approval 的承接关系
- [ ] 定义 `Replan`、`Confidence`、`Risk` 的触发与联动原则
- [ ] 将本 spec 作为后续目的地解析、路线规划、驾驶状态机与驾驶舱 specs 的前置约束
