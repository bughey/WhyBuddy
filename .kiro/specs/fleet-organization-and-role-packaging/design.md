# 设计文档：车队组织与角色封装

## 设计概述

本设计负责在“任务自动驾驶”叙事下，为 `Fleet` 增加一层稳定的角色封装模型。

它解决的核心问题不是“如何实现一个新的角色切换引擎”，而是“如何把已经存在的执行能力组织成用户看得懂、产品讲得通、运行时又能对得上的车队角色”。

因此本设计采用四层分离思路：

1. 产品角色层
2. 能力包层
3. 执行单元层
4. 运行事实层

其中最重要的原则是：

- 用户看到的是角色，不是节点目录
- 工程仍运行在 mission-first / workflow / runtime 之上
- 角色封装是投影层与组织层，不是对底层对象的强制改名
- 同一底层对象可随路线与阶段切换其角色归属

## 设计目标

本设计要实现以下结果：

- 让 `Fleet` 成为 `Route` 到 `Execution` 之间的稳定中间层
- 让驾驶舱可以用“角色编队”而不是“节点列表”表达执行组织
- 让 `agents / nodes / executors / skills / tools` 可以被统一包装
- 让 `Takeover`、`Risk`、`Confidence`、`Drive State` 与角色层建立清晰联系
- 让前端、回放、审计、治理系统共享同一套角色对象口径

## 核心原则

### 1. 角色优先展示，事实优先承载

用户界面优先展示车队角色，但角色背后必须有可追溯的工程事实支撑。

这意味着：

- 对外展示 `Planner / Researcher / Operator / Reviewer`
- 对内仍然由 `agent / node / executor / skill / tool` 等对象承载
- 任一角色摘要都必须可以追溯到真实运行单元

### 2. 角色不是底层对象的一对一别名

一个角色通常不是单一 agent，也不是单一 node。

更合理的表达是：

- 角色是“职责集合”
- 能力包是“完成职责所需的能力集合”
- 执行单元是“当前真正干活的实体”

因此：

- 一个 `Researcher` 可以由多个搜索节点、检索 agent、网页 executor 共同承载
- 一个 `Operator` 可以绑定 browser executor、native executor 和若干 action nodes
- 一个 `Reviewer` 可以由 review 节点、校验技能和人工确认入口共同组成

### 3. Route 决定编组，Drive State 决定表现

`Route` 决定当前任务需要哪些角色、按什么顺序或并行关系出现。
`Drive State` 决定这些角色当前是“正在编队、执行中、等待中、阻塞中、重规划中”。

因此车队组织不是一次性静态结构，而是执行中的动态投影。

### 4. 兼容优先，不做底层大改名

当前主仓已经积累了大量 `mission / workflow / runtime / node / executor` 命名与实现。

本设计不建议当前立即执行以下动作：

- 把全部 `agent` 统一改名为 `role`
- 把全部 `node` 统一改名为 `fleet action`
- 把全部 `executor` 统一改名为 `vehicle`
- 把全部 API 和测试同步重命名

正确做法是先增加角色封装层与投影层，再决定是否需要更深层重构。

## 分层模型

### 1. 产品角色层

该层是用户可理解的角色语义层，负责回答：

- 当前车队有哪些成员类型
- 每个角色正在负责什么
- 哪些角色在等待、阻塞、执行或复核

建议角色枚举如下：

- `planner`
- `clarifier`
- `researcher`
- `operator`
- `generator`
- `reviewer`
- `auditor`
- `coordinator`
- `generalist`
- `custom`

### 2. 能力包层

该层位于角色与执行单元之间，用于表达“这个角色靠哪些能力完成职责”。

建议能力包对象承载以下内容：

- skill bindings
- tool bindings
- MCP attachments
- policy bindings
- executor preferences
- node family tags

能力包的意义在于：

- 把 skill、tool、executor 从“用户视角角色”中抽离出来
- 又不至于让角色层失去工程承载能力
- 允许一个角色在不同任务中装配不同能力包

### 3. 执行单元层

该层是实际执行工作或推进流程的单元，至少包括：

- agents
- nodes
- executors
- workflow tasks
- runtime workers

这层负责：

- 真正运行
- 产生日志与产物
- 进入等待、失败、恢复、重试
- 为角色层提供事实来源

### 4. 运行事实层

该层是系统已存在的事实底座，包括：

- mission
- workflow definition
- workflow instance
- runtime node state
- agent records
- executor state
- logs / artifacts / replay / audit / HITL

该层不直接面向用户叙事，但负责提供全部真实信号。

## 核心对象设计

### 1. FleetComposition

`FleetComposition` 用于表达某一条路线、某一阶段或某一时刻的车队编组快照。

```ts
type FleetComposition = {
  fleetId: string;
  missionId?: string;
  routeId?: string;
  routeStageId?: string;
  driveState?: string;
  roles: FleetRolePackage[];
  formationMode: "planned" | "active" | "fallback" | "replanned";
  sourceRefs: FleetSourceRefs;
  updatedAt: string;
};
```

### 2. FleetRolePackage

`FleetRolePackage` 是本设计最核心的对象，用于描述一个用户可理解的车队角色如何由底层能力承载。

```ts
type FleetRolePackage = {
  rolePackageId: string;
  roleType:
    | "planner"
    | "clarifier"
    | "researcher"
    | "operator"
    | "generator"
    | "reviewer"
    | "auditor"
    | "coordinator"
    | "generalist"
    | "custom";
  title: string;
  responsibility: string;
  status: "pending" | "forming" | "running" | "waiting" | "blocked" | "reviewing" | "done";
  routeStageIds: string[];
  inputContract: RoleInputContract[];
  outputContract: RoleOutputContract[];
  capabilityPackages: CapabilityPackageRef[];
  executionUnits: ExecutionUnitRef[];
  attachmentRefs: AttachmentRef[];
  riskProfile: RoleRiskProfile;
  takeoverProfile?: RoleTakeoverProfile;
  displaySummary?: string;
};
```

### 3. CapabilityPackage

`CapabilityPackage` 用于把角色职责与技能、工具、策略、执行器偏好等工程能力绑定起来。

```ts
type CapabilityPackageRef = {
  packageId: string;
  packageType: "research" | "generation" | "operation" | "review" | "governance" | "custom";
  skillIds: string[];
  toolIds: string[];
  mcpIds?: string[];
  executorTypes?: string[];
  policyIds?: string[];
};
```

### 4. ExecutionUnitRef

`ExecutionUnitRef` 用于描述角色当前实际依赖的执行单元。

```ts
type ExecutionUnitRef =
  | {
      unitKind: "agent";
      unitId: string;
      label?: string;
    }
  | {
      unitKind: "node";
      unitId: string;
      label?: string;
    }
  | {
      unitKind: "executor";
      unitId: string;
      label?: string;
    }
  | {
      unitKind: "task";
      unitId: string;
      label?: string;
    };
```

### 5. AttachmentRef

`AttachmentRef` 用于表达附着在角色上的非主执行能力。

```ts
type AttachmentRef = {
  attachmentKind: "skill" | "tool" | "mcp" | "policy" | "memory" | "evidence";
  attachmentId: string;
  label?: string;
};
```

## 角色定义设计

### 1. Planner

职责：

- 理解 `Destination`
- 生成或调整 `Route`
- 拆分阶段
- 决定编组需求

常见底层来源：

- planner agent
- planning node
- route recommendation logic
- strategy synthesis skills

典型输入：

- destination
- constraints
- success criteria

典型输出：

- route draft
- stage plan
- fleet requirements

### 2. Clarifier

职责：

- 发现缺失信息
- 组织澄清问题
- 触发用户补充或确认

常见底层来源：

- input collection nodes
- confirm / decision / clarification nodes
- HITL wait state

典型接管关系：

- 与 `Takeover Point` 强关联
- 与低置信度目标理解强关联

### 3. Researcher

职责：

- 检索外部信息
- 读取知识、文档、网页与上下文
- 比对多个来源

常见底层来源：

- search nodes
- QA nodes
- RAG pipeline
- browser search executor

### 4. Operator

职责：

- 实际执行外部操作
- 驱动浏览器、沙箱、本地执行器或平台动作
- 完成需要“去做”的步骤

常见底层来源：

- browser executor
- native executor
- sandbox executor
- action nodes

典型风险：

- 权限风险
- 成本风险
- 外部失败风险

### 5. Generator

职责：

- 生成正文、摘要、代码、文件、表格、图像或结构化结果

常见底层来源：

- llm nodes
- file generation nodes
- chart / document / media nodes

### 6. Reviewer

职责：

- 审阅结果
- 对照成功标准检查输出
- 提出修正或退回

常见底层来源：

- review nodes
- verify nodes
- judge / compare logic

### 7. Auditor

职责：

- 关联风险、证据、审计、合规、回放
- 确认是否满足治理要求

常见底层来源：

- audit events
- lineage
- evidence collection
- policy checks

### 8. Coordinator

职责：

- 组织多角色协作
- 汇总分支进度
- 管理交接和收敛

常见底层来源：

- orchestration logic
- workflow stage coordination
- mission runtime aggregation

### 9. Generalist / Custom

用于处理无法稳定细分的场景：

- 小任务中由单一 agent 承担多重职责
- 历史节点体系暂未完成角色化分类
- 归类置信度低或存在冲突

这类角色必须：

- 明确标记为混合角色
- 保留底层来源
- 允许后续重新分类

## 映射设计

### 1. agents -> role carriers

`agent` 最适合作为角色承载者之一，但不应被直接等同为角色本身。

映射原则：

- 一个 agent 可承载一个或多个角色包
- 同一 agent 在不同阶段可切换承载的角色类型
- 动态角色系统属于这一层的底层实现候选，而不是产品语义本身

### 2. nodes -> role actions

`node` 更适合表示“角色在做的动作”，而不是角色本身。

例如：

- search node 更像 `Researcher` 的动作
- confirm_judge node 更像 `Clarifier` 或 `Reviewer` 的动作
- file_generation node 更像 `Generator` 的动作
- open_page / open_dashboard 更像 `Operator` 的动作

因此节点应优先映射为：

- role action
- stage action
- execution evidence

而非用户主视图中的一级对象。

### 3. executors -> role actuators

`executor` 负责“让角色真的能做事”，但不宜直接作为用户主视图的一等角色。

建议表达为：

- `Operator` 绑定 browser/native/sandbox executor
- `Researcher` 可能借助 browser executor 获取信息
- `Generator` 可能借助 sandbox executor 生成文件

也就是说，executor 更像角色的执行装置，而不是角色本身。

### 4. skills / tools / MCP -> role attachments

这些对象最适合被放入“能力包”或“附着能力”层。

建议映射为：

- skill -> role capability
- tool -> role attachment
- MCP -> role extension

产品上不应直接对用户说：

- “当前是 `web_search` skill 在工作”
- “当前是 `mcp-foo` 在推进任务”

而应说：

- “研究员正在搜索并比对资料”
- “执行员正在调用外部系统完成操作”

### 5. workflow / runtime -> role projection source

`workflow` 和 `runtime` 是角色投影的事实来源，不是角色对象本身。

它们负责告诉系统：

- 当前哪个阶段在运行
- 哪些 node 激活中
- 哪些 executor 正在执行
- 哪些 agent 正在占用
- 哪些阻塞、失败、等待正在发生

角色层则把这些事实重新组织成“谁在干什么”的表达。

## Route 与 Fleet 的关系

### 1. Route 生成角色需求

在 `Route` 生成后，系统应推导出该路线需要的角色组合。

例如：

- 研究型路线通常至少需要 `Planner + Researcher + Reviewer`
- 外部操作型路线通常至少需要 `Planner + Operator + Reviewer`
- 高风险任务可能额外需要 `Auditor`

### 2. 路线阶段驱动角色启停

角色不是整个任务期间都同等活跃。

例如：

- `planning` 阶段，`Planner` 与 `Clarifier` 活跃
- `fleet-forming` 阶段，`Coordinator` 活跃
- `executing` 阶段，`Researcher / Operator / Generator` 活跃
- `reviewing` 阶段，`Reviewer / Auditor` 活跃

### 3. Replan 触发车队重组

当路线变化时，车队应支持以下变化：

- 新增角色
- 移除角色
- 替换能力包
- 调整角色优先级
- 将并行子编组重新收敛

这也是为什么 `Fleet` 不能被视为静态数组。

## Drive State 与 Fleet 的关系

建议把角色状态与高层 `Drive State` 对齐，但不要求一一对应。

示例关系如下：

| 高层 Drive State | 车队角色表现 |
| --- | --- |
| `understanding` | `Planner / Clarifier` 正在理解目标 |
| `clarifying` | `Clarifier` 等待补充或确认 |
| `planning` | `Planner` 组织路线与编组 |
| `fleet-forming` | `Coordinator` 绑定能力包与执行单元 |
| `executing` | `Researcher / Operator / Generator` 推进执行 |
| `reviewing` | `Reviewer / Auditor` 进行核查 |
| `blocked` | 相关角色进入 `blocked` 或 `waiting` |
| `takeover-required` | 相关角色暴露接管原因 |
| `replanning` | `Planner / Coordinator` 重组车队 |
| `delivered` | 主要角色进入 `done` |

## Takeover 与治理设计

角色封装层必须能够承接治理与接管语义。

建议每个角色具备两个附属投影：

- `RoleRiskProfile`
- `RoleTakeoverProfile`

示例：

```ts
type RoleRiskProfile = {
  riskTags: string[];
  primaryRiskLevel?: "low" | "medium" | "high";
  notes?: string[];
};

type RoleTakeoverProfile = {
  takeoverKinds: Array<"clarification" | "approval" | "permission" | "budget" | "result_acceptance" | "exception">;
  waitingForUser?: boolean;
  reason?: string;
};
```

这样可以把不同角色天然携带的治理职责表达清楚：

- `Clarifier` 更关心信息缺口
- `Operator` 更关心权限、预算、外部执行异常
- `Reviewer` 更关心结果接受与退回
- `Auditor` 更关心策略、证据、合规

## mission-first / runtime 兼容策略

### 1. 分层共存

建议明确如下分层：

- 产品层：`Destination / Route / Fleet / Drive State / Takeover`
- 工程层：`mission / workflow / task / runtime / node / executor / audit`

两层共存，不要求立即合并命名。

### 2. 投影优先

建议优先实现以下投影能力：

- mission + route -> fleet composition
- workflow stage + runtime node state -> role status
- agent records + executor state -> role carriers
- artifacts + logs + audit -> role evidence

### 3. 不让前端凭空造角色

前端可以做展示层 view model，但不能在缺少底层依据时凭空声明：

- “这是 Reviewer”
- “这是 Operator”

角色判断至少应来自：

- route planner 提供的角色需求
- role packaging projection 的统一规则
- runtime 归类映射表

## Web-AIGC 节点体系的渐进封装

当前大量 Web-AIGC 节点不应直接对用户暴露为主语义。

建议采用两步法：

### 第一步：节点家族归类

先按节点用途归入角色家族，例如：

- 搜索、文档检索、网页问答 -> `Researcher`
- 用户输入、确认、参数收集 -> `Clarifier`
- 文件生成、格式输出、图表生成 -> `Generator`
- 浏览器打开、系统调用、控制台动作 -> `Operator`
- 审核、判断、确认 -> `Reviewer`

### 第二步：角色能力包沉淀

在归类稳定后，再逐步形成：

- 研究能力包
- 生成能力包
- 执行能力包
- 复核能力包

这样可以避免一次性重写节点系统。

## 前端展示约束

为确保角色封装层真正可用，前端展示建议遵守以下约束：

- 默认展示角色卡，而不是节点列表
- 默认展示角色职责、状态、焦点和结果摘要
- 需要时才展开到底层 agent / node / executor 明细
- skill、tool、MCP 默认作为附着能力，不作为主入口
- 角色卡应与步骤、阻塞点、中间结果、证据入口联动

## 风险与边界

### 风险 1：与 dynamic-role-system 定义冲突

`dynamic-role-system` 更偏工程实现层，关注 role template、agent load/unload、切换约束。
本 spec 更偏产品建模层，关注用户可理解的车队角色封装。

因此需要明确：

- 动态角色系统是底层机制候选
- 车队角色封装是上层产品语义

### 风险 2：角色名称好看，但映射不稳

如果角色没有稳定映射规则，前端会出现同一底层对象在不同页面被说成不同角色的问题。

因此必须优先统一归类规则，再做大规模展示接入。

### 风险 3：把 skill / tool / executor 直接抬成角色

这会让用户重新面对工程细节，破坏角色层的意义。

因此必须坚持：

- skill / tool / MCP 是附着能力
- executor 是执行装置
- agent / node 是执行单元
- role 才是用户主语义

### 风险 4：过早要求底层全量改造

如果要求先改完 runtime 才能建立角色层，会导致 spec 长期无法落地。

因此首轮应以：

- 投影层
- 分类表
- 能力包目录
- 角色摘要对象

作为最小落地单位。

## 设计结论

本 spec 的最终设计结论如下：

1. `Fleet` 应被定义为面向当前 `Route` 的角色化能力编队
2. 用户主语义应落在 `FleetRolePackage`，而不是底层 node / tool / executor
3. 角色封装必须区分“角色层、能力包层、执行单元层、运行事实层”
4. `agents / nodes / executors / skills / tools` 必须被统一包装，但不应被强行合并为同一层对象
5. 角色组织应受 `Route`、`Drive State`、`Replan` 和 `Takeover` 共同影响
6. 与 `mission-first / workflow / runtime` 的关系应是“投影与兼容”，而不是“替换与重写”
