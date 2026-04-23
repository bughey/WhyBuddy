# 任务清单：路线规划器与路线模型

- [ ] 定义 Route Set 与 Route 的 TypeScript 领域模型
  - [ ] 补充 `RouteSet`、`Route`、`RouteStage`、`RouteStep`、`RouteRisk`、`RouteTakeoverPoint` 等核心类型。
  - [ ] 明确 `fast / standard / deep / custom` 路线模式。
  - [ ] 明确 Route 与 Destination、Mission、Workflow 的关联字段。

- [ ] 定义主路线与候选路线生成规则
  - [ ] 支持至少生成一条主路线。
  - [ ] 支持快速、标准、深度三类候选路线。
  - [ ] 为每条路线生成推荐理由、差异摘要、预估成本与预估时长。
  - [ ] 保留未选择候选路线作为规划证据。

- [ ] 设计 Route Planner 的规划流程
  - [ ] 定义 Destination Analyzer。
  - [ ] 定义 Route Candidate Builder。
  - [ ] 定义 Risk Evaluator。
  - [ ] 定义 Takeover Point Generator。
  - [ ] 定义 Runtime Mapping Builder。
  - [ ] 定义 Recommendation Selector。

- [ ] 设计并行与串行路线表达
  - [ ] 支持 Route Step 依赖关系。
  - [ ] 支持 parallel group。
  - [ ] 支持 join / merge 汇总点。
  - [ ] 支持在 runtime 不具备真实并行时降级为串行执行。
  - [ ] 记录并行降级原因。

- [ ] 定义风险点模型与风险生成规则
  - [ ] 支持上下文不足风险。
  - [ ] 支持权限不足风险。
  - [ ] 支持成本超限风险。
  - [ ] 支持质量不确定风险。
  - [ ] 支持外部工具失败风险。
  - [ ] 支持数据可信度不足风险。
  - [ ] 支持长耗时风险。
  - [ ] 支持策略敏感风险。

- [ ] 定义接管点模型与接管生成规则
  - [ ] 支持澄清问题接管点。
  - [ ] 支持路线选择接管点。
  - [ ] 支持权限确认接管点。
  - [ ] 支持预算确认接管点。
  - [ ] 支持风险接受接管点。
  - [ ] 支持结果验收接管点。
  - [ ] 支持人工覆盖接管点。
  - [ ] 区分必须接管与建议接管。

- [ ] 建立 Route 到现有 workflow / mission runtime 的映射
  - [ ] 映射 Route Stage 到十阶段 workflow pipeline。
  - [ ] 映射 Route Step 到 workflow node / runtime adapter / agent action。
  - [ ] 映射接管点到 HITL / wait-resume / decision 链路。
  - [ ] 映射失败恢复到 `retry / escalate / terminate` 控制面。
  - [ ] 映射 runtime event 到 Route 状态投影。

- [ ] 设计 Route 重规划机制
  - [ ] 定义重规划触发条件。
  - [ ] 定义 `RouteReplanRecord`。
  - [ ] 保留原路线与新路线差异。
  - [ ] 保留已完成步骤证据。
  - [ ] 支持继续当前路线、切换候选路线、生成新路线、请求用户接管。

- [ ] 设计 Route 的前端驾驶舱摘要
  - [ ] 提供主路线摘要。
  - [ ] 提供候选路线对比摘要。
  - [ ] 提供当前阶段与当前步骤。
  - [ ] 提供风险点与接管点数量。
  - [ ] 提供剩余步骤、预计时间、预计成本。
  - [ ] 提供路线推荐原因。

- [ ] 设计 Route 的审计、回放与证据链
  - [ ] 记录路线生成输入。
  - [ ] 记录主路线推荐原因。
  - [ ] 记录候选路线与用户选择。
  - [ ] 记录接管点触发与用户决策。
  - [ ] 记录重规划前后快照。
  - [ ] 将 Route 与 Mission Runtime 事件流关联。

- [ ] 补充测试计划
  - [ ] 覆盖快速路线生成。
  - [ ] 覆盖标准路线生成。
  - [ ] 覆盖深度路线生成。
  - [ ] 覆盖主路线推荐。
  - [ ] 覆盖候选路线保留。
  - [ ] 覆盖并行组降级。
  - [ ] 覆盖风险点生成。
  - [ ] 覆盖接管点生成。
  - [ ] 覆盖 Route 到 workflow / mission runtime 的映射。
  - [ ] 覆盖重规划记录。
