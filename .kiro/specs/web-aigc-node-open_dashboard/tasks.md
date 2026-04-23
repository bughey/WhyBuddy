# 任务清单：打开看板节点

> 2026-04-23 现状核查：当前主仓已通过 `server/routes/node-adapters/open-dashboard-node-adapter.ts` 与 `server/routes/open-dashboard.ts` 补出 `open_dashboard` 最小闭环。节点现在可以返回前端可消费的 dashboard `target` 描述、透传 `context` 参数，并在接入全局 `PermissionCheckEngine` 时执行最小 `api:call` 权限校验。按当前代码事实，4 项任务均可判定为已完成。

- [x] 定义看板打开目标结构
- [x] 增加参数透传设计
- [x] 增加权限校验
- [x] 验证前端联动

补充说明：

- 当前“前端联动”按“返回 UI 可消费的 `target` 描述与 `uiHref / apiHref / route / context`”这一最小口径完成，不代表已经存在真实前端看板页面。
- 当前权限口径是最小 `api:call` 资源校验，不是完整页面级 ACL。
