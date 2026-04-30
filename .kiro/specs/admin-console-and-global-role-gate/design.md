# 设计文档：Admin Console And Global Role Gate

## 设计概述

本 spec 为 ToC 产品增加管理员后台。用户侧仍以“我的项目”为主，后台作为独立运营视角存在。第一阶段采用全局角色 gate：`user` 不能访问，`admin` 和 `super_admin` 可以访问。

## 角色判断

```ts
type UserRole = "user" | "admin" | "super_admin";

function isAdmin(user: CurrentUser | undefined) {
  return user?.role === "admin" || user?.role === "super_admin";
}
```

服务端中间件：

```ts
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  if (req.user.role !== "admin" && req.user.role !== "super_admin") {
    return res.status(403).json({ success: false, error: "Admin privileges required" });
  }

  next();
}
```

## 路由与 API

前端路由：

```text
/admin
/admin/users
/admin/users/:userId
/admin/projects
/admin/projects/:projectId
/admin/runs
/admin/failures
/admin/audit
```

服务端 API：

```text
GET /api/admin/summary
GET /api/admin/users
GET /api/admin/users/:userId
GET /api/admin/projects
GET /api/admin/projects/:projectId
GET /api/admin/runs
GET /api/admin/failures
GET /api/admin/audit
```

所有 `/api/admin/*` 先走 `requireAuth`，再走 `requireAdmin`。后台第一阶段复用同一套 DB-backed session，不新增 `admin_session`、`AdminTokenService` 或独立 admin token。

## 后台菜单

后台菜单第一阶段写死：

- Overview
- Users
- Projects
- Runs
- Failures
- Audit

不引入 `Menu` 表，不引入 role-menu 关系，不迁移 web-main 的 `/system/menus`。

## 页面职责

### Overview

展示用户数、项目数、运行中任务、失败任务、最近异常和系统健康摘要。

### Users

展示用户列表和详情。第一阶段以查看为主，禁用/恢复用户等写操作由后置运营 spec 承接。

### Projects

展示全局项目列表和详情。管理员可查看项目上下文、owner、状态、spec、route、mission、artifact 和 evidence 摘要。

### Runs / Failures

展示运行任务、失败任务、等待接管任务和最近执行轨迹，用于运营排障。

### Audit

展示基础审计日志。更完整的不可篡改审计、导出和敏感操作记录由后置 spec 承接。

## 前端入口

应用 shell 通过 `isAdmin(currentUser)` 判断是否展示后台入口。普通用户看不到入口；即使手动输入 URL，也由路由守卫和服务端 API 拒绝。

## 与 web-main 的取舍

可参考：

- `access.ts` 的 route gate 思路
- `getCurrentUser` / `currentUser.roles` 的用户上下文
- `/system/users`、`/system/operation-logs`、`/system/monitor` 的后台信息架构

不迁移：

- 独立 admin token / admin_session 双会话体系
- 动态菜单树
- 菜单 CRUD
- 角色管理页
- 权限管理页
- 租户、部门、岗位、用户组
- 数据权限配置

## 非目标

本 spec 不处理项目 owner 隔离本身，不处理登录注册，不处理管理员禁用用户、删除项目、重跑任务和导出 evidence 等高风险操作。
