# 任务清单：变量赋值节点

> 2026-04-22 现状收口：当前主仓已具备两层落地能力。其一，`server/core/web-aigc-controlflow.ts` 已支持 `variable_assignment` 的控制流快照推导，能按 `global / local / temp` 作用域计算赋值结果、写入 `variableChanges`，并在 graph projection 中输出赋值摘要。其二，`server/core/workflow-runtime-engine.ts` 已新增 `variable_assignment` 运行时内置适配器，可直接执行 `target / scope / source / expression / value` 配置，把结果写回实例变量、补充作用域快照与变更记录，并通过统一 runtime 事件面发出 `variable.assigned`。
>
> 2026-04-23 observability 收口补记：`shared/web-aigc-observability.ts` 已把 `variable.assigned` 纳入统一事件目录；`server/core/web-aigc-runtime-observability.ts` 已在 replay / audit 两个镜像面补齐统一 metadata 字段，包括 `actionId / resourceType / resourceId / assignmentScope / assignmentTarget / assignmentChanged`，变量赋值事件的最小观测口径已对齐。

- [x] 定义变量作用域模型
- [x] 定义赋值与表达式执行结构
- [x] 写入变量变更事件
- [x] 验证与条件节点联动

## 对账依据

- 控制流快照层：
  - `server/core/web-aigc-controlflow.ts`
  - `server/tests/workflow-graph-projection.test.ts`
- Runtime 执行层：
  - `server/core/workflow-runtime-engine.ts`
  - `server/tests/workflow-runtime-engine.test.ts`

## 当前完成口径

1. 作用域模型已落地为 `global / local / temp`，并在控制流快照与 runtime 输出中保留作用域信息。
2. 赋值来源已覆盖 `expression / source / value` 三类最小输入。
3. 变量变更已通过 `variableChanges` 与 `runtimeVariableChanges / runtimeVariableLastChange` 两套事实落点进入快照与 runtime 状态。
4. `variable_assignment -> condition` 的运行时联动已由测试覆盖，赋值结果可直接被下游条件节点消费。
5. 当前 `variable.assigned` 事件已经由 runtime 发出，并已被 `server/core/web-aigc-runtime-observability.ts` 镜像到 replay / audit；回放与审计两侧会共享一致的赋值资源标识与标准化 metadata，变量级最小观测闭环现已成立。

## 仍需关注

- 当前 runtime 的主变量平面仍以 `instance.variables` 为中心，`local / temp` 更多体现为附加作用域快照，而不是完全隔离的独立变量容器。
- 还没有看到更复杂表达式语言、批量赋值或嵌套路径写回等增强能力，这些不在本轮最小闭环范围内。
- 当前变量事件的 replay / audit 镜像已经覆盖最小闭环，但还没有继续扩展到 lineage 直写、批量赋值审计聚合或更细粒度的字段级脱敏策略。
