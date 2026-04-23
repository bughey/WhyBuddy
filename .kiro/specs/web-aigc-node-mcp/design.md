# 设计文档：MCP 节点

## 设计概述

`mcp` 是一类高风险外部工具节点。当前主仓对它的最小落地方式，不是把它直接塞进通用聊天节点，而是拆成三层闭环：

1. 节点输入适配层
   - 文件：`server/routes/node-adapters/mcp-node-adapter.ts`
   - 作用：把 `mcp` 节点输入归一化为统一的 MCP 调用请求
2. 工具治理与执行层
   - 文件：`server/tool/api/mcp-tool-adapter.ts`
   - 作用：做权限、governance、审批、超时、fallback、审计，再调用底层 invoker
3. 路由入口层
   - 文件：`server/routes/mcp.ts`
   - 作用：提供 `POST /api/mcp/nodes/execute`，并把执行状态稳定映射到 HTTP 响应码

## 当前主线契约

### 1. 节点输入契约

`mcp-node-adapter` 当前支持并转发以下字段：

- `serverId`
- `toolName`
- `arguments`
- `input`
- `context`
- `workflowId`
- `stage`
- `metadata`
- `agentId`
- `token`
- `timeoutMs`
- `requireApproval`
- `approverList`

其中：

- `serverId / toolName / input` 为必填
- `context` 支持字符串或字符串数组
- `approverList` 会被归一化为非空字符串数组

### 2. 工具执行结果契约

`mcp-tool-adapter` 统一返回 `McpToolExecutionResult`，状态稳定收敛为四类：

- `completed`
- `denied`
- `approval_required`
- `failed`

返回体中固定保留：

- `targetLabel`
- `operation`
- `resource`
- `output`
- `response`
- `error`
- `escalationId`
- `governance`
- `metadata`

### 3. governance / approval / fallback 的边界

当前实现采用以下优先级：

1. 若 `permission.governance.outcome === "approval_required"`，无论 `permission.allowed` 是什么，统一进入 `approval_required`
2. 若 `permission.governance.outcome === "blocked"`，无论 `permission.allowed` 是什么，统一进入 `denied`
3. 若没有 governance 阻断，但 `permission.allowed === false`，进入 `denied`
4. 若调用方显式要求 `requireApproval = true`，进入人工审批门 `approval_required`
5. 仅当以上治理/审批分支都未命中时，才真正调用底层 MCP invoker
6. 调用失败后，如 `metadata.fallback` 或 `metadata.errorFallback` 命中可恢复错误，则返回 `completed + fallbackUsed = true`
7. 调用失败且未命中 fallback，则返回 `failed`

这样做的目的，是保证 route、tool adapter、permission engine 三层对 `approval_required / denied / failed / completed` 的语义保持一致，避免出现“布尔值允许、治理结果却要求审批”时被错误放行。

## 运行流程

1. `mcp-node-adapter` 校验并归一化节点输入
2. `mcp-tool-adapter` 生成 canonical MCP resource
3. 如果启用了 permission engine，则按 `mcp_tool + call` 执行权限检查
4. 若 governance 命中审批或阻断策略，则优先进入 `approval_required` 或 `denied`
5. 若显式要求人工审批，则进入手动审批门
6. 若准入通过，则在超时控制下调用底层 MCP invoker
7. 若调用失败且命中 fallback 规则，则返回 fallback 结果
8. route 层根据最终状态映射 HTTP 状态码

## 主仓当前边界

当前主仓已具备：

- `mcp` 节点输入适配
- 独立 `MCP` 路由入口
- 权限 / 治理 / 审批 / 超时 / fallback / 审计的最小闭环
- 内部 `internal.memory / internal.reports / internal.registry / internal.workspace` 四类工具面

当前未纳入本 spec 完成口径：

- 更丰富的第三方外部 MCP server 生态
- 更高层级的 replay / observability 专项闭环
- 非当前主仓已有工具面的广泛接线
