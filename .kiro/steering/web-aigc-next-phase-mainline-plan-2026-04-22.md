# Web-AIGC 下一阶段主线计划

更新时间：2026-04-22

## 当前收口结果

本轮已经完成以下主线动作：

- 把 `risk-actions` 的命名空间 collection、sourceId 作用域、路由状态码和测试补齐到本地 `main`
- 把 `platform-b` 的 `mission / workflow / session / projection` 补线收回到本地 `main`
- 把 `dialogue-qa` 的 `chat / knowledge` 节点执行入口补齐到本地 `main`
- 把 `hitl-session` 的 metadata 契约、服务端决策链路和测试补齐到本地 `main`
- 完成定向 `vitest` 验证与 `node --run check`
- 开始清理本轮 `web-aigc` worktree，并把残差备份到本地独立目录

## 下一阶段目标

下一阶段不再继续扩散 worktree 数量，而是转成“主仓主线收口模式”：

1. 以 `main` 为唯一集成主线，减少多分支残差继续累积。
2. 对尚未完全收口的 `platform-c / tools-and-agents / risk-actions / controlflow / platform-a 热区` 做对账式补差。
3. 把已进入主仓的 `workflow runtime / mission projection / audit governance / node adapters` 进一步打通成可演示闭环。
4. 逐步把前端 HITL、监控面板、Office 上下文面板和任务面板统一到同一套 runtime 语义。

## 优先级顺序

### P0：主仓稳定性与治理补线

- 收口 `platform-c`：权限治理、审计事件、策略门禁
- 收口 `tools-and-agents`：`a2a / auto_agent / internal_api / guest-agents / skills`
- 收口 `risk-actions`：和 `server/index.ts`、RAG 初始化、治理钩子继续对账

### P1：图运行时与控制流主干

- 继续对齐 `platform-a` 与 `controlflow`
- 统一 `workflow-runtime-engine / workflow-graph-projection / workflow-domain`
- 补齐 runtime state、checkpoint、resume 的端到端回归

### P2：交互链路与前端闭环

- 收口 `hitl-session` 前端差异：
  - `DecisionPanel`
  - `DecisionHistory`
  - `tasks-store`
  - `mission-client`
- 把 Office 面板和 Web-AIGC 面板统一到同一套 session / projection 来源

### P3：整体验证与发布准备

- 跑更完整的 server 回归
- 检查 client 兼容面板回归
- 整理中文 steering 文档
- 视情况推送远端并准备下一轮合并

## 执行原则

- 不再新增大批量长期驻留 worktree
- 新能力优先在 `main` 主线按批次收口
- 高风险改动先补测试，再动热文件
- 所有写操作、权限、审计、回放链路优先保证一致性
- 前端适配不反向定义后端契约，统一以后端 runtime 契约为准

## 建议的下一批任务

建议紧接着推进这一批：

1. `platform-c` 审计与权限治理热区收口
2. `tools-and-agents` 的 `a2a / auto_agent / internal_api` 主仓对账
3. `risk-actions` 与 `server/index.ts` 的最终集成补线
4. `controlflow + platform-a` 的 runtime 热区归并
5. `hitl-session` 前端 UI 差异回收

## 下一阶段执行批次

为避免再次进入“开很多 worktree 但主仓迟迟不收口”的状态，下一阶段改为 `main` 主线批次推进，按下面 4 个批次执行：

### 批次 A：治理与门禁补齐

目标是先把高风险能力需要依赖的审计、权限、回放门禁补完整，再放开后续热区接入。

- 补齐 `platform-c` 中 `audit / permissions / lineage / replay` 的主仓实现与测试
- 对齐 `server/routes/*` 中和治理能力相关的挂载入口
- 统一高风险动作的事件命名、审计字段和拒绝原因结构
- 完成标准：高风险节点接入前，已有统一 permission check 和 audit trail

### 批次 B：工具与外部调用主干

目标是把 `tools-and-agents` 这条主干先收拢成可控接口，而不是继续分散在不同适配层中。

- 对账 `a2a / auto_agent / internal_api / guest-agents / skills`
- 明确工具调用的输入输出契约、错误结构和宿主能力边界
- 统一消息通知、内部 API、外部代理调用的治理钩子
- 完成标准：工具调用链路全部能挂到统一 runtime 和治理链路下

### 批次 C：运行时与控制流归并

目标是把 `platform-a` 与 `controlflow` 热区收回到统一 runtime 语义中，减少后续节点接入时反复改内核。

- 统一 `workflow-runtime-engine / workflow-graph-projection / workflow-domain`
- 补齐 `checkpoint / resume / transition / branch / loop` 的主仓回归
- 对齐控制流节点在 graph execution record 中的状态表达
- 完成标准：至少一条带条件分支和恢复能力的图链路可稳定回放

### 批次 D：HITL 与 Office 面板闭环

目标是把前端交互层和主仓 runtime 投影打通，形成可演示闭环，而不是只有服务端接口到位。

- 回收 `DecisionPanel / DecisionHistory / tasks-store / mission-client` 差异
- 统一 Office 面板、监控面板、任务面板的 session / projection 来源
- 校验人工确认、恢复执行、状态刷新在前端链路中的一致性
- 完成标准：HITL 决策链路可从 UI 发起、回写、恢复并在监控面板中看到

## 批次执行顺序

建议按 `A -> B -> C -> D` 推进，其中：

- `A` 是 `B` 和高风险节点继续推进的前置条件
- `B` 和 `C` 可以局部交错推进，但最终都要落回统一 runtime 契约
- `D` 放在后面，不是因为不重要，而是为了避免前端先固化一套和主仓不一致的语义

## 主仓推进规则

从这一阶段开始，默认采用以下规则：

- 不再为单个 spec 长时间保留独立 worktree
- 新改动优先直接在 `main` 上按小批次收口
- 每个批次先补测试，再改热文件
- 每个批次结束都要留下可复核的通过项：测试、文档、主仓提交
- 进度统计不再看“还有多少 worktree”，而看 `main` 上已经通过验证的提交与闭环能力

## 备注

- 本轮清理前，所有 `web-aigc` worktree 的脏内容都已单独备份到本地目录，便于后续追溯。
- 下一阶段默认不再依赖“看 worktree 是否还在”来判断进度，而以 `main` 分支中的已验证提交为准。
