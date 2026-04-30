# 设计文档：Lightweight MySQL Redis Persistence Strategy

## 设计概览

本设计为 ToC 权限与 Project-first 主线补一层基础设施地基。核心取舍是 MySQL-first、Redis-optional：

- MySQL 是真实业务数据和权限判断的唯一事实源。
- Redis 用于加速、限流和短期状态，不承担不可替代的权限判断。
- `data/database.json` 继续允许服务现有 runtime/demo 能力，但真实账号、会话、项目归属必须逐步迁入 MySQL。
- 不迁移 `rbac-system-pc` 的 ToB 租户/RBAC 模型，只参考它的连接配置、健康检查、环境变量分层和 Redis 封装方式。

## 资源边界

测试环境已具备 MySQL 和 Redis。本项目使用独立 MySQL database：

```text
cube_pets_office
```

约束：

- 不删除、不清空、不修改 `rbac_multitenant`。
- 不把测试服务器真实密码/API key 写入仓库。
- 不在文档中固化测试服务器凭据。
- Redis 使用独立 logical DB 或 key prefix，避免与 `rbac-system-pc` 的 Redis key 冲突。

## 配置模型

建议新增配置项：

```env
DATABASE_PROVIDER=mysql
DB_HOST=your-mysql-host
DB_PORT=3306
DB_NAME=cube_pets_office
DB_USER=your-user
DB_PASSWORD=your-password

SESSION_SECRET=replace-me
SESSION_COOKIE_NAME=cube_office_session
SESSION_TTL_DAYS=30

REDIS_ENABLED=false
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=2
REDIS_KEY_PREFIX=cube:pets:office:

QUEUE_REDIS_ENABLED=false
QUEUE_REDIS_HOST=your-redis-host
QUEUE_REDIS_PORT=6379
QUEUE_REDIS_PASSWORD=your-password
QUEUE_REDIS_DB=3
QUEUE_REDIS_KEY_PREFIX=cube:pets:office:queue:
```

`REDIS_ENABLED=false` 是默认值。这样开发、测试和单机部署可以先跑通 MySQL-only；需要限流、缓存或队列时再打开 Redis。

## 技术选型

当前仓库已经包含 `mysql2`。MVP 建议先使用：

- `mysql2/promise` 连接池；
- 小型 repository 层；
- SQL migration 文件；
- migration 版本表；
- 针对 auth/project 的接口测试。

第一阶段不引入完整 Sequelize/RBAC 模型。后续如果表关系和查询复杂度明显增长，再评估 Drizzle、Prisma 或 Sequelize。

## 数据库表草案

### schema_migrations

```text
id
version
name
checksum
executed_at
```

### users

```text
id
email
email_normalized
password_hash
display_name
avatar_url
role                -- user | admin | super_admin
status              -- active | disabled
email_verified_at
last_login_at
created_at
updated_at
```

唯一索引：

```text
unique(email_normalized)
```

### email_login_tokens

```text
id
email_normalized
user_id
purpose             -- login | verify_email | reset_password
token_hash
request_ip
user_agent
expires_at
consumed_at
created_at
```

索引：

```text
index(email_normalized, purpose, expires_at)
index(token_hash)
```

### sessions

```text
id
user_id
token_hash
ip
user_agent
last_seen_at
expires_at
revoked_at
created_at
updated_at
```

索引：

```text
unique(token_hash)
index(user_id, revoked_at, expires_at)
```

### projects

```text
id
owner_user_id
name
description
status              -- active | archived
source              -- user | imported_local | demo
created_at
updated_at
archived_at
```

索引：

```text
index(owner_user_id, status, updated_at)
```

### project resource tables

后续项目资源可以按阶段迁入：

```text
project_specs
project_routes
project_missions
project_artifacts
project_evidence
admin_audit_logs
```

第一阶段只要求项目归属链路成立，复杂 runtime/knowledge/agent 历史数据可以继续保留 JSON 存储，但服务端 API 必须先校验 `project.owner_user_id`。

## Redis 使用边界

建议 key prefix：

```text
cube:pets:office:
```

可选 key：

```text
rate:email-login:ip:{ip}
rate:email-login:email:{emailHash}
session:{sessionId}
admin:force-logout:{userId}
queue:{jobType}:{jobId}
```

规则：

- Redis miss 不代表登录失效，应回查 MySQL。
- Redis down 不应阻断核心登录和项目访问。
- Redis 只缓存 session 安全摘要，不缓存 token 明文。
- 限流优先 Redis，Redis 不可用时退回保守 MySQL 检查或单机内存保护。

## 会话流

登录成功：

1. 校验邮箱/密码或邮箱登录 token。
2. 创建随机 session token。
3. 服务端保存 `sha256(sessionToken)` 到 `sessions.token_hash`。
4. 浏览器写入 httpOnly cookie。
5. 可选写 Redis session cache，TTL 不超过 MySQL session 过期时间。

请求鉴权：

1. 从 cookie 读取 session token。
2. 计算 hash。
3. Redis enabled 时先查缓存。
4. 缓存 miss 或 Redis 不可用时查 MySQL。
5. 校验 session 未过期、未撤销，且 user.status 为 `active`。
6. 注入 `req.user`。

退出或强制下线：

1. 写 `sessions.revoked_at`。
2. 删除或失效 Redis session cache。
3. 清理 cookie。

## 项目隔离流

普通用户接口：

```text
GET /api/projects
```

只查询：

```sql
where owner_user_id = currentUser.id
```

项目详情接口：

```text
GET /api/projects/:projectId
```

普通用户必须同时满足：

```text
project.id = :projectId
project.owner_user_id = currentUser.id
```

不满足时返回 404。管理员全局查看走 `/api/admin/projects/:projectId`，由 admin gate 控制。

## 迁移策略

第一阶段：

- 创建 MySQL 连接池。
- 创建 migration runner。
- 建立 `schema_migrations`、`users`、`sessions`、`email_login_tokens`、`projects`。
- 建立 repository 层和健康检查。

第二阶段：

- `consumer-email-auth-and-account` 接入 MySQL session。
- `personal-project-ownership-and-isolation` 接入 `projects.owner_user_id`。

第三阶段：

- 迁移 project specs/routes/missions/evidence 的权限敏感索引。
- JSON runtime 数据保留但必须经过 project ownership guard。

第四阶段：

- 视真实压力开启 Redis 限流、session cache、队列或 pub/sub。

## 失败与降级

- MySQL 不可用：登录、项目、管理员 API 返回 503，并输出不含密钥的错误日志。
- Redis 不可用：记录 warning，系统降级为 MySQL-only。
- migration 失败：启动阶段中止，避免半初始化 schema 被业务使用。
- 重复 migration：通过 `schema_migrations` 跳过已执行版本。

## 与其他 specs 的关系

本 spec 是 Wave 0，先于以下 specs：

1. `consumer-email-auth-and-account`
2. `personal-project-ownership-and-isolation`
3. `admin-console-and-global-role-gate`
4. `admin-audit-and-support-operations`

它不实现用户界面和业务功能，只提供数据库、Redis、session 和 project ownership 的基础设施约束。

## 非目标

不迁移 `rbac-system-pc` 的租户、组织、菜单、角色权限矩阵和数据权限规则。不实现协作项目成员。不实现付费订阅。不实现完整后台运营动作。
