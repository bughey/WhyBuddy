# 任务清单：网页搜索节点

- [x] 定义网页搜索输入输出
- [x] 设计搜索适配器
- [x] 输出来源与摘要
- [x] 验证与网页问答联动

## 本轮收口说明

- 已确认 `web_search` 节点维持轻量搜索适配能力，基础结果结构为 `title / url / snippet / source`。
- 已在路由输出层补齐 `status / metadata / handoff`，为下游 `web_qa / static_webpage_read / end` 提供稳定消费结构。
- 已通过路由测试覆盖成功路径、参数校验与执行器失败路径，确保外部搜索执行器异常时能正确返回错误。
