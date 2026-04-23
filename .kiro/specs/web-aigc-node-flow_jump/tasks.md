# 任务清单：流程跳转节点

- [x] 定义跳转目标与校验规则
  已落地 `flow_jump` 节点最小执行约定：优先读取 `targetNodeId`，兼容 `nextNodeId` / `target`，并强校验当前节点必须存在一条指向目标节点的显式 `jump` 边。
- [x] 实现执行指针切换
  `flow_jump` 通过运行时 `advance -> nextNodeId` 机制切换 `currentNodeId`，沿现有图运行时执行指针继续推进，无需额外分叉引擎。
- [x] 写入跳转审计事件
  跳转执行时会写入 `edge.transitioned` 运行时事件，且当 `metadata.kind === "jump"` 时会被镜像为审计 `DECISION_MADE` 事件。
- [x] 验证跨分支跳转场景
  已补充跨分支 `jump` 成功用例与非法目标拒绝用例，并补充 jump 审计镜像测试，当前主仓测试可通过。
