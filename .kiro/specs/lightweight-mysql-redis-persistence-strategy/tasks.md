# 任务清单：Lightweight MySQL Redis Persistence Strategy

- [x] 验证测试 MySQL 可达，并创建独立数据库 `cube_pets_office`，不删除或修改既有 `rbac-system-pc` 数据库
- [x] 验证测试 Redis 可达，仅执行连接检查，不写入业务 key
- [x] 新增 `.env.example` 或等价配置文档，包含 MySQL、session、Redis、queue Redis 的占位变量，禁止写入真实密码和 API key
- [x] 新增 MySQL 配置读取模块，支持 `DATABASE_PROVIDER=mysql`、连接池参数和敏感字段脱敏日志
- [x] 新增 MySQL health check，MySQL 不可用时返回明确服务不可用状态
- [x] 新增 Redis 可选配置读取模块，默认 `REDIS_ENABLED=false`，Redis 不可用时允许 MySQL-only 降级
- [x] 新增 Redis health check 和 key prefix 策略，避免与 `rbac-system-pc` 的 Redis key 冲突
- [x] 新增 migration runner，建立 `schema_migrations` 表并支持重复执行跳过
- [x] 编写初始 MySQL migration：`users`、`email_login_tokens`、`sessions`、`projects`
- [x] 新增 users repository，支持按 email 查询、创建用户、更新登录时间、更新状态和角色
- [x] 新增 sessions repository，支持创建、按 token hash 查询、刷新 lastSeen、撤销和清理过期 session
- [x] 新增 email login tokens repository，支持 token hash 落库、过期校验和 consumed 标记
- [x] 新增 projects repository 的最小 owner 查询能力，支持 `owner_user_id = currentUser.id` 过滤
- [x] 为 `data/database.json` 和 localStorage 明确 legacy/demo 边界，补充不再承接真实权限判断的说明
- [x] 补充基础设施测试，覆盖 migration 幂等、MySQL health、Redis disabled 降级、session 撤销和 project owner 查询
