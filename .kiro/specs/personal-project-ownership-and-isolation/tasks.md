# 任务清单：Personal Project Ownership And Isolation

- [x] 为 `Project` 类型新增 `ownerUserId`
- [x] 扩展 project store snapshot/migration，为旧项目补充 owner 归属
- [x] 调整当前项目选择状态，使其按当前用户隔离
- [x] 新增服务端项目模型或持久化适配层，支持按 `ownerUserId` 查询
- [x] 实现 `requireProjectOwner` / `ProjectGuard` 中间件或等价 guard，替代 tenant context 并统一普通用户越权项目 404 策略
- [x] 实现普通用户项目列表接口，只返回当前用户项目
- [x] 实现项目创建接口，自动写入当前用户为 owner
- [x] 实现项目详情、更新、归档接口，并校验 owner
- [x] 实现 project bundle 读取，确保 specs/routes/missions/artifacts/evidence 继承项目 owner 校验
- [x] 实现项目消息、spec、route、mission link、artifact、evidence 写入接口，并校验 owner
- [x] 调整任务创建和执行回流路径，保证 projectId 绑定前已校验 owner
- [x] 为普通用户访问他人项目返回 404 或统一不可访问错误
- [x] 为管理员后台项目查询预留独立接口边界，不复用普通项目列表穿透
- [x] 补充 owner 隔离测试，覆盖列表、详情、写入、bundle、历史迁移和越权访问
- [x] 更新相关 Project-first 文档，说明本阶段不做项目成员协作
