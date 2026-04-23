# 需求文档：任务自动驾驶 Runtime 编排层

## 目标

本 spec 定义“任务自动驾驶”中的 runtime 编排层，用于把上层产品对象：

- `Destination`
- `Route`
- `Fleet`
- `Takeover`

稳定映射到当前主仓已经存在的执行主线：

- `Mission Runtime`
- `workflow runtime`
- `wait-resume`
- `retry-escalate`

本 spec 的目标不是引入一套替代现有执行系统的新 runtime，而是在现有 mission-first 主干之上，补齐一层“编排与投影层”，回答四个关键问题：

- `Destination` 如何进入 Mission Runtime，并驱动任务理解、澄清、规划与最终交付。
- `Route` 如何落到 workflow runtime，成为可执行、可暂停、可重规划的执行路径。
- `Fleet` 如何落到 agent / skill / node / executor / adapter 的动态编组与实时执行。
- `Takeover` 如何复用现有 wait-resume、decision、approval、retry、escalate 主线，而不是另起一套人工介入机制。

## 背景

当前仓库已经分别定义了：

- `Destination` 的目标模型与解析方式；
- `Route` 的路线规划与路线模型；
- `Drive State` 与 `Replan` 的高层状态机；
- `Fleet` 的角色编组与实时执行视图；
- `Takeover` 的接管面板与决策点语义；
- `Mission Runtime` 的六阶段任务执行主线；
- `workflow runtime` 的节点、阶段、等待输入、恢复、重试、升级等底层能力。

但目前仍缺少一层明确的 runtime 编排定义，把这些对象串成一条统一主线。缺少这一层时，会出现以下问题：

- 上层概念停留在文档和界面语言，无法稳定落到真实运行时。
- `Route`、`Fleet`、`Takeover` 只能各自局部成立，缺少统一控制面。
- `wait-resume`、`retry-escalate`、`replan` 的边界容易混淆。
- replay / audit / cockpit 难以解释“系统为什么此刻这样推进任务”。

因此需要定义一个兼容优先的 runtime 编排层。

## 范围

本 spec 包含：

- runtime 编排层的职责边界与对象模型；
- `Destination / Route / Fleet / Takeover` 到现有 runtime 主线的映射关系；
- 与 `Mission Runtime` 六阶段主线的对接方式；
- 与 `workflow runtime` 的阶段、节点、等待、恢复、重试、升级控制面的对接方式；
- `wait-resume`、`retry-escalate`、`replan` 三类动作的边界；
- 面向 cockpit / replay / audit / telemetry 的投影与证据要求。

本 spec 不包含：

- 对底层 runtime engine 的推翻式重写；
- 对现有 `mission / workflow / task / runtime` 的大规模改名；
- 新的前端视觉布局设计；
- 对所有 Web-AIGC 节点的逐个重新建模。

## 核心术语

### Runtime 编排层

位于产品语义层与执行事实层之间的兼容层。它负责：

- 读取 `Destination / Route / Fleet / Takeover` 等产品对象；
- 绑定 Mission、workflow、agent、node、executor、decision 等事实对象；
- 决定此刻应继续执行、等待接管、局部重试、升级人工还是触发重规划；
- 为前端、回放、审计输出统一可解释投影。

### 编排绑定

指上层对象到现有运行时对象的稳定关联关系，例如：

- `Destination -> Mission`
- `Route -> workflow definition / workflow instance`
- `Fleet -> agents / skills / nodes / executors`
- `Takeover -> decision / approval / waiting / resume / escalate`

### 局部重试

在当前 Route、当前 workflow 路径和当前执行策略不变的前提下，对单个步骤、节点或依赖进行恢复性重试。

### 重规划

当当前路线不再适用时，对 `Route` 本身进行替换、修订或切换。重规划不是普通重试，也不是单纯等待输入。

## 需求

### 需求 1：系统必须定义独立的 Runtime 编排层

系统必须定义一层独立的 runtime 编排层，用于承接任务自动驾驶对象与现有执行主干之间的绑定、控制与投影。

验收标准：

- 编排层必须明确位于产品层对象与执行事实层之间，而不是替代任意一层。
- 编排层必须能同时表达当前选中的 `Route`、当前生效的 `Fleet`、当前待处理的 `Takeover` 与当前 Mission 执行上下文。
- 编排层必须支持运行中更新，而不是只在任务启动时一次性生成。
- 编排层必须可被前端、回放、审计与治理系统共同消费。

### 需求 2：`Destination` 必须映射到 Mission Runtime 主线

系统必须定义 `Destination` 如何进入 Mission Runtime，并在 Mission 六阶段主线中持续生效。

验收标准：

- `Destination` 中的目标、约束、成功标准、缺失信息、预期交付物必须能投影到 Mission 创建与推进上下文。
- Mission 的 `receive / understand / plan` 阶段必须能解释为对 `Destination` 的接收、理解、澄清与路线准备。
- 当 `Destination` 缺少关键信息时，编排层必须能生成澄清类 `Takeover`，而不是静默带病进入执行。
- `Destination` 在执行中被用户修改时，编排层必须能触发重新规划或重新绑定，而不是只更新文案。

### 需求 3：`Route` 必须映射到 workflow runtime 主线

系统必须定义 `Route` 如何成为现有 workflow runtime 的执行路径与控制依据。

验收标准：

- 编排层必须能把选中的 `Route` 映射到 workflow definition、workflow phase、runtime node、decision point 或 adapter 组合。
- `Route Stage` 必须能映射到现有 workflow 阶段或 Mission 阶段语义，避免成为纯展示层。
- `Route Step` 必须能映射到一个或多个底层执行单元，而不是强制与单个 node 一一对应。
- 当前选中的路线、候选路线、路线切换原因与重规划差异必须被保留为运行时证据。
- `Route` 的暂停、恢复、失败、重规划必须能被现有 runtime 主线承接。

### 需求 4：`Fleet` 必须映射到能力编组与执行资源

系统必须定义 `Fleet` 如何映射到实际运行中的 agent、skill、node、executor、adapter 与外部资源。

验收标准：

- 每个 `Fleet` 角色必须能映射到一个或多个底层执行单元。
- Mission 的 `provision` 阶段必须能承接 `Fleet` 的编组、能力检查、资源准备与权限校验。
- `Fleet` 的变化必须能随着 `Route` 切换、重规划或执行异常而动态调整。
- 编排层必须能输出用户可读的角色视图，也必须保留到底层执行资源的可追踪关联。
- `Fleet` 的运行健康、阻塞与负载变化必须能够反馈到高层状态与视图。

### 需求 5：`Takeover` 必须映射到 wait-resume / decision / approval / escalate

系统必须把 `Takeover` 统一映射到现有等待、恢复、审批、人工升级链路，而不是另起一套人工介入机制。

验收标准：

- `Takeover` 必须能映射到 Mission waiting 状态、runtime `WAITING_INPUT`、decision payload、approval 记录或 `escalate()` 动作。
- 阻塞型 `Takeover` 必须显式让编排层进入等待态，而不是只在界面上弹出提示。
- 用户提交接管结果后，编排层必须能通过 `resume()` 或 Mission 决策链路恢复原路径、切换路线或进入重规划。
- 高风险、权限、预算或异常接管必须能进入人工升级链路，并保留审计证据。
- `Takeover` 必须区分必须接管与建议接管，并体现不同的 runtime 阻塞语义。

### 需求 6：系统必须定义统一的 runtime 控制主线

编排层必须把现有 Mission Runtime、workflow runtime、wait-resume、retry-escalate 串成一条统一控制主线。

验收标准：

- 系统必须能表达以下主线：接收目标、选路、编队、执行、等待接管、恢复执行、局部重试、人工升级、重规划、交付完成。
- 编排层必须定义标准控制动作，至少包括继续执行、等待、恢复、重试、升级、终止、重规划。
- 不同控制动作必须有清晰的生效范围，例如对单个步骤生效、对当前 Route 生效或对整个 Mission 生效。
- 编排层不得把不同语义的动作混为一谈，例如把重规划写成重试，把等待接管写成执行中。

### 需求 7：系统必须明确区分 `wait-resume`、`retry-escalate` 与 `replan`

系统必须明确三类运行时行为的边界，避免主线解释混乱。

验收标准：

- 缺失信息、预算确认、权限确认、路线确认、结果验收应优先进入 `wait-resume` 或 decision 链路。
- 短暂依赖失败、可恢复节点错误、幂等工具失败应优先进入局部 `retry`。
- 多次重试无效、路线前提失效、用户改目标、风险超阈值等场景必须能够触发 `replan`。
- 高风险异常、恢复预算耗尽、需要人工兜底的场景必须能进入 `escalate`。
- replay / audit 必须能解释一次运行中到底发生了等待、重试、升级还是重规划。

### 需求 8：编排层必须支持高层状态投影与证据留存

编排层必须将真实运行时事实投影为高层驾驶态，并保留可追踪证据。

验收标准：

- 编排层必须能把 Mission、workflow、fleet、takeover 的运行信号投影为当前 `Drive State`、当前阶段、当前步骤、当前接管与当前阻塞原因。
- 每次关键切换必须能关联到底层 Mission 事件、workflow 事件、decision 记录、executor 状态或审计证据。
- replay 必须能重建关键编排决策，例如为何切到另一条路线、为何要求用户接管、为何触发升级。
- audit 必须能解释高风险路径上的权限、预算、风险接受与交付验收。

### 需求 9：编排层必须兼容现有 mission-first 主仓

本 spec 不得要求当前主仓先完成大规模底层重命名，才能引入自动驾驶 runtime 编排语义。

验收标准：

- 编排层应优先通过 binding、projection、view model 或服务端聚合对象落地。
- 现有 `Mission Runtime`、workflow engine、Web-AIGC nodes、executor callbacks、decision 提交流程必须继续可用。
- `Destination / Route / Fleet / Takeover` 是上层编排对象，不要求立刻替换底层 `Mission / Workflow / Runtime / Task` 命名。
- 编排层必须允许分阶段接入，而不是要求一次性迁移全仓。

### 需求 10：编排层必须支持后续驾驶舱与治理面扩展

runtime 编排层必须成为后续驾驶舱、回放、治理与调试面的共享骨架。

验收标准：

- 驾驶舱必须能基于编排层对象展示当前目标、当前路线、当前车队、当前接管与当前执行主线。
- 任务详情、回放、审计、遥测必须能够共享同一组编排相关关联键与语义。
- 编排层不得只服务某一个 UI 页面，而应成为统一 runtime 解释层。
- 后续 spec 在涉及路线执行、接管、恢复、回放时，应能直接复用本 spec 的映射口径。
