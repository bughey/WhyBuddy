# 任务清单：车队状态与实时执行主视图

- [ ] 定义 `FleetExecutionView` 投影模型
  - 明确主视图摘要、当前步骤、角色编队、并行分支、阻塞点、中间产物、证据摘要的数据结构
  - 明确与 mission / workflow / runtime 的关联字段

- [ ] 定义角色编队映射规则
  - 建立 agent / node / executor 到 `Planner / Clarifier / Researcher / Generator / Reviewer / Auditor / Executor` 的初版映射
  - 设计无法稳定归类时的 `custom` 回退策略

- [ ] 定义当前步骤投影规则
  - 明确当前步骤如何从 node run / workflow current state 中推导
  - 明确等待、阻塞、失败、重试、回退时的步骤状态表达

- [ ] 定义并行执行投影规则
  - 明确多角色、多节点、多 executor、多子任务的并行展示结构
  - 明确并行分支收敛后的状态归并逻辑

- [ ] 定义中间产物模型
  - 明确文本草稿、结构化摘要、文件、图像、链接、代码片段的统一表示
  - 明确中间产物与步骤、角色、artifact 的关联方式

- [ ] 定义阻塞点与等待点模型
  - 覆盖澄清、审批、回调、权限、治理、工具失败、executor 异常等阻塞类型
  - 明确阻塞原因、恢复方式和所属责任单元

- [ ] 定义执行证据归位策略
  - 明确 logs / artifacts / runtime / callbacks / recent failures 的统一入口
  - 明确主视图与 runtime dock / replay / debug 的边界

- [ ] 设计实时更新机制
  - 明确 socket、poll、callback、mission 刷新之间的协同方式
  - 明确增量刷新与延迟加载策略

- [ ] 设计与现有 runtime 的兼容层
  - 明确从 mission、workflow instance、node state、agent records、executor state 生成主视图投影的流程
  - 避免要求底层一次性重写 schema

- [ ] 设计驾驶舱主视图信息架构
  - 明确顶部摘要、主线步骤条、角色编队区、并行区、中间产物区、阻塞与证据区的布局分工
  - 明确哪些信息属于主线，哪些信息属于辅助区

- [ ] 设计用户交互行为
  - 明确角色卡、步骤卡、阻塞卡、中间产物卡、证据入口的展开与跳转方式
  - 明确等待用户接管时的提示行为

- [ ] 输出联调样例
  - 提供单线任务样例
  - 提供并行任务样例
  - 提供等待澄清样例
  - 提供 executor 异常与治理阻塞样例

- [ ] 补齐测试计划
  - 设计视图投影层单元测试
  - 设计 mission / workflow / runtime 兼容映射测试
  - 设计并行分支、阻塞、恢复、中间产物更新等关键场景测试

- [ ] 评估渐进迁移路径
  - 明确如何在不破坏现有任务详情页和 runtime 面板的前提下接入主视图
  - 明确旧入口的降级、收口或复用策略
