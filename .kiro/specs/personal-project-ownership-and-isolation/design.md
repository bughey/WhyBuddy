# 设计文档：Personal Project Ownership And Isolation

## 设计概述

本 spec 把 Project-first 数据从“前端项目投影”升级为“账号归属的个人项目空间”。普通用户的所有项目读写都以 `ownerUserId === currentUser.id` 为核心规则；管理员全局查看能力由后台 spec 承接，不能污染普通项目接口。

## 数据模型扩展

```ts
interface Project {
  id: string;
  ownerUserId: string;
  name: string;
  goal: string;
  status: ProjectStatus;
  summary?: string;
  currentSpecId?: string;
  currentRouteId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

interface ProjectOwnedResource {
  id: string;
  projectId: string;
  createdAt: string;
}
```

现有 `ProjectMessage`、`ProjectSpec`、`ProjectRoute`、`ProjectMission`、`ProjectArtifact`、`ProjectEvidence` 不需要重复写 `ownerUserId`，但服务端查询时必须通过 `projectId` 回查项目归属。

## 访问规则

```ts
function canReadProject(user, project) {
  return project.ownerUserId === user.id || isAdmin(user);
}

function canWriteProject(user, project) {
  return project.ownerUserId === user.id;
}

function requireProjectOwner(projectId) {
  // 读取 project
  // 如果不存在或 ownerUserId 不匹配，普通用户返回 404
  // 将 project 注入 req.project
}
```

普通项目 API 不接受 `ownerUserId` 参数。项目归属只能来自认证上下文。

## API 草案

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
POST   /api/projects/:projectId/archive

GET    /api/projects/:projectId/bundle
POST   /api/projects/:projectId/messages
POST   /api/projects/:projectId/specs
POST   /api/projects/:projectId/routes
POST   /api/projects/:projectId/missions/link
POST   /api/projects/:projectId/artifacts
POST   /api/projects/:projectId/evidence
```

所有接口先走 `requireAuth`，再走 `requireProjectOwner`/`ProjectGuard` 或创建时绑定当前用户。该 guard 是裁剪版登录架构中替代 tenant context 的核心边界。

## 前端行为

- 登录后项目列表只展示当前用户项目。
- 未登录用户不能创建真实项目。
- 当前项目选择状态应和当前用户绑定，避免 A 用户退出后 B 用户看到 A 的 `currentProjectId`。
- 本地 store 的 storage key 或 snapshot 中应包含用户归属信息。
- 访问无权项目时展示“项目不存在或已不可访问”。

## 历史项目迁移

迁移流程应满足：

- 只在用户登录后执行。
- 为缺少 `ownerUserId` 的项目补当前用户 ID。
- 对已有 `ownerUserId` 的项目不改写。
- 迁移结果幂等。
- 迁移完成后更新 schema version 或 migration marker。

## 管理员边界

管理员全局查看项目使用 `/api/admin/projects` 等后台接口。普通 `/api/projects` 永远返回当前用户自己的项目，即使当前用户是管理员，也默认展示管理员自己的项目。这样可以避免后台穿透能力影响普通用户体验。

## 与现有 Project-first spec 的关系

- `project-domain-model` 提供基础对象和 store。
- 本 spec 补 `ownerUserId`、认证上下文和服务端隔离。
- `project-execution-center`、`project-spec-center`、`project-fsd-route-planner`、`project-evidence-artifact-replay` 后续都应通过本 spec 的项目归属规则访问项目资源。

## 非目标

本 spec 不引入 ProjectMember、ProjectRole、邀请、共享链接、团队空间或 ToB 数据权限。后续如果需要协作，再新增项目成员 RBAC spec。
