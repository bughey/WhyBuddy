# 设计文档：Admin Audit And Support Operations

## 设计概述

本 spec 是管理员后台的后置增强，聚焦高风险运营动作和审计。基础原则是：能看不代表能改；能改必须有原因、确认、审计和最小权限。

## 管理员分级

```ts
type AdminCapability =
  | "admin:user:disable"
  | "admin:user:restore"
  | "admin:project:archive"
  | "admin:run:retry"
  | "admin:evidence:export"
  | "admin:audit:read";

const ADMIN_CAPABILITIES = {
  admin: [
    "admin:user:disable",
    "admin:project:archive",
    "admin:run:retry",
    "admin:audit:read",
  ],
  super_admin: [
    "admin:user:disable",
    "admin:user:restore",
    "admin:project:archive",
    "admin:run:retry",
    "admin:evidence:export",
    "admin:audit:read",
  ],
};
```

第一阶段可以只用简单 role 判断；如果后台动作继续增加，再引入 capability helper。

## 审计模型

```ts
interface AdminAuditLog {
  id: string;
  actorUserId: string;
  actorRole: "admin" | "super_admin";
  action: string;
  targetType: "user" | "project" | "run" | "artifact" | "evidence" | "system";
  targetId: string;
  projectId?: string;
  reason?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  result: "allowed" | "denied" | "failed";
  detail?: Record<string, unknown>;
  createdAt: string;
}
```

审计日志只允许追加，不允许更新和删除。

## API 草案

```text
POST /api/admin/users/:userId/disable
POST /api/admin/users/:userId/restore
POST /api/admin/projects/:projectId/archive
POST /api/admin/runs/:runId/retry
POST /api/admin/runs/:runId/mark-handled
GET  /api/admin/evidence/:evidenceId
POST /api/admin/evidence/:evidenceId/export
GET  /api/admin/audit
```

所有写操作请求体都必须包含 `reason`。

## 高风险操作确认

前端执行禁用用户、恢复用户、归档项目、重跑任务、导出 evidence 时，应展示确认弹层，并要求填写或选择原因。服务端不信任前端确认状态，只检查 `reason` 和权限。

## 脱敏策略

后台列表可默认展示脱敏邮箱：

```text
alice@example.com -> a***e@example.com
```

运行日志、artifact preview 和 evidence detail 可在服务端提供 `redacted` 字段。完整内容导出需要更高权限，并记录 `admin:evidence:export` 审计。

## 支持排障边界

管理员不直接 impersonate 普通用户。排障页面通过只读 project bundle、run detail、evidence timeline 和 audit log 还原上下文。需要代用户修改项目时，应另开明确的 support action，并记录原因。

## 与前置 spec 的关系

- 依赖 `consumer-email-auth-and-account` 提供用户、角色和禁用状态。
- 依赖 `personal-project-ownership-and-isolation` 提供项目 owner 和资源边界。
- 依赖 `admin-console-and-global-role-gate` 提供后台入口和只读后台视图。

## 非目标

不引入租户级后台、不引入部门岗位、不引入工单系统、不引入复杂审批流、不改变普通用户的项目所有权规则。
