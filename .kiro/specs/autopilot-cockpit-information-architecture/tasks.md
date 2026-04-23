# 任务清单：任务自动驾驶驾驶舱信息架构

- [ ] 梳理现有 `mission-first`、`office-task-cockpit`、`task-runtime-visibility`、`replay`、`audit` 页面中的信息块，形成可复用清单
- [ ] 定义三栏驾驶舱的一级信息块与二级展开信息块，明确哪些内容默认展示、哪些内容二级下钻
- [ ] 输出左侧“目标与路线栏”的内容结构，包括目的地卡片、路线卡片、阶段进度和风险提示
- [ ] 输出中间“执行主视图”的内容结构，包括编队状态、执行阶段、中间产物和事件摘要
- [ ] 输出右侧“接管与证据栏”的内容结构，包括 HITL 决策、待确认事项、审计摘要和回放入口
- [ ] 定义 `mission / workflow / projection / session` 到驾驶舱信息块的映射关系
- [ ] 定义 `Mission Runtime` 状态到驾驶舱执行态文案与标签的映射规则
- [ ] 定义 `selection / param_collection / user_input / confirm_judge` 到统一接管面板的映射方式
- [ ] 定义驾驶舱与 `replay / audit / lineage` 的跳转入口、上下文透传参数和证据摘要规则
- [ ] 输出首版桌面端布局约束，明确三栏宽度策略、折叠策略和最小可用展示顺序
- [ ] 为后续驾驶舱 UI 原型、前端实现和多任务扩展 spec 提供统一信息架构基线
