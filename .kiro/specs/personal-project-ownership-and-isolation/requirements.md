# 需求文档：Personal Project Ownership And Isolation

## 目标

让 ToC 用户登录后只看到、只操作自己的项目。Project-first 主线中的 project、message、clarification、spec、route、mission、artifact 和 evidence 都必须继承同一套个人归属边界。

## 背景

当前项目领域模型已经建立 `Project` 和一组 project-scoped 资源，但第一阶段主要在前端 localStorage 中维护，没有账号归属和服务端访问控制。账号体系落地后，项目必须从 demo 投影升级为用户私有数据。管理员可通过后台查看全局项目，但普通用户不能通过 URL、ID 或接口参数访问他人项目。

## 需求

### 需求 1：项目归属

系统应为每个项目记录 `ownerUserId`。项目创建时，`ownerUserId` 必须来自当前登录用户。

### 需求 2：项目列表隔离

普通用户查看项目列表时，只能看到自己拥有的项目。接口不应返回其他用户的项目摘要、状态或数量。

### 需求 3：项目详情隔离

普通用户读取项目详情时，只能读取自己的项目。访问他人项目时应返回 404 或 403；ToC 第一阶段建议使用 404 以减少信息泄露。

### 需求 4：项目资源继承归属

ProjectMessage、ProjectClarificationQuestion、ProjectSpec、ProjectRoute、ProjectMission、ProjectArtifact 和 ProjectEvidence 都应通过 `projectId` 继承项目 owner 校验。

### 需求 5：项目写操作保护

普通用户只能更新、归档、推进、写入自己项目下的资源。前端隐藏按钮不是权限边界，服务端必须兜底校验。

### 需求 6：任务和执行关联

任务、mission、workflow 或 runtime 绑定到项目时，必须校验当前用户是否拥有该项目。项目执行结果回流 artifact/evidence 时也必须保持 owner 边界。

### 需求 7：历史数据迁移

系统应支持将已有 localStorage/demo 项目迁移到当前登录用户，避免用户登录后看不到历史项目。迁移应可重复执行且不产生重复项目。

### 需求 8：管理员穿透能力

管理员可以通过后台 API 查看全局项目和指定项目详情。管理员穿透能力必须走独立后台接口或显式 admin mode，不能影响普通用户项目接口的过滤逻辑。

### 需求 9：审计记录

关键项目写操作应记录操作人、项目、动作、时间和结果。第一阶段可写入项目 evidence 或基础审计日志；更完整的管理员审计由后置 spec 承接。

### 需求 10：非目标

本阶段不做项目分享、项目成员、团队协作、项目角色、租户数据范围或行级数据规则。
