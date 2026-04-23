# web-aigc-node-mcp 现状说明

## 结论

按当前主仓代码与测试事实，`web-aigc-node-mcp` 仍可维持完成态，但本轮补强聚焦了一个更真实的主线风险点：

- 之前 `McpToolAdapter` 主要依赖 `permission.allowed === false` 才进入治理阻断分支
- 这会导致一种潜在不一致：如果外部或替代权限引擎返回 `allowed: true`，但同时附带 `governance.outcome = approval_required / blocked`，适配器可能错误放行
- 本轮已将这一契约收紧为“治理结果优先于裸布尔允许值”

## 本轮收口内容

### 1. 治理结果优先级已固定

当前 `mcp-tool-adapter` 已明确采用以下语义：

- `governance.outcome = approval_required`：返回 `approval_required`
- `governance.outcome = blocked`：返回 `denied`
- 若无 governance 阻断，再看 `permission.allowed`
- 若显式 `requireApproval = true`，进入人工审批门

这保证了 route、tool adapter、permission engine 三层对 MCP 高风险调用的解释一致。

### 2. route 层状态映射保持稳定

当前路由 `server/routes/mcp.ts` 仍然稳定映射：

- `completed -> 200`
- `approval_required -> 409`
- `denied -> 403`
- `failed -> 500`

并且在 `denied / approval_required` 场景下，不会丢失治理明细 payload。

### 3. 内部 invoker 与主仓别名保持一致

`internal-mcp-tool-invoker.ts` 当前支持将：

- `workspace.memory`
- `workspace.files`
- `workspace.reports`
- `workflow.registry`

归一化到内部标准服务：

- `internal.memory`
- `internal.workspace`
- `internal.reports`
- `internal.registry`

本轮补了别名路径的测试，避免 route / adapter 用别名、invoker 用内部名时出现返回结构不一致。

## 本轮定向验证范围

已核对并补测试的文件：

- `server/routes/mcp.ts`
- `server/tool/api/mcp-tool-adapter.ts`
- `server/tool/api/internal-mcp-tool-invoker.ts`
- `server/tests/mcp-routes.test.ts`
- `server/tests/mcp-tool-adapter.test.ts`
- `server/tests/internal-mcp-tool-invoker.test.ts`
- `server/tests/permission-mcp-checker-wiring.test.ts`

## 当前剩余风险

- 当前主线已经较稳定，但仍主要覆盖内部 MCP 工具面，外部第三方 MCP server 的兼容性还未在本 spec 范围内系统验证
- 目前重点是节点级闭环与治理契约稳定性，不等同于更高层 replay / observability 专项已经全部收口
- 仓库当前较脏，其他 worker 若同时改动 MCP 周边代码，后续仍需要主线再做一次统一对账
