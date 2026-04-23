# 任务清单：MCP 节点

- [x] 定义 MCP 调用结构
  - 已完成：`server/routes/node-adapters/mcp-node-adapter.ts` 与 `server/tool/api/mcp-tool-adapter.ts` 已形成统一请求/响应契约
  - 已完成：canonical MCP resource 由 `mcp-checker` 负责生成与解析

- [x] 接入 A2A / skills 能力
  - 已完成：主仓已有 `mcp` 节点独立入口，可消费上游传入的 MCP 绑定与执行参数
  - 已完成：当前 spec 完成口径聚焦节点主线，不要求扩展到所有外部第三方 MCP server

- [x] 增加审计与超时控制
  - 已完成：`mcp-tool-adapter` 已支持权限检查、governance、人工审批、超时控制、审计写入
  - 已完成：`completed / denied / approval_required / failed` 已形成稳定状态集

- [x] 验证失败回退与人工升级
  - 已完成：支持 `fallback / errorFallback`
  - 已完成：支持 `requireApproval + approverList`
  - 已完成：支持 governance 触发审批或阻断

## 2026-04-23 本轮补强

- [x] 补齐 governance 结果优先于裸 `allowed` 布尔值的契约稳定性
- [x] 补齐 `approval_required / denied / failed / completed` 的 route 映射与 payload 一致性测试
- [x] 补齐内部 invoker 的 alias serverId 归一化测试
- [x] 中文 design / status / tasks 文档与代码事实同步

## 当前完成边界

- 已纳入本 spec：节点级 MCP 主线闭环、治理与审批边界、fallback 与审计
- 未纳入本 spec：更大范围的外部 MCP 生态接入、平台级 replay / observability 专项闭环
