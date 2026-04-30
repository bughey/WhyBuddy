# 任务清单：Admin Console And Global Role Gate

- [ ] 在 `CurrentUser` 中确认 `role` 字段可用于区分 `user/admin/super_admin`
- [ ] 实现服务端 `requireAdmin` 中间件，复用 `requireAuth` 注入的同一套 DB-backed session，不新增独立 admin token
- [ ] 新增 `/api/admin/summary` 接口，返回后台概览指标
- [ ] 新增 `/api/admin/users` 和 `/api/admin/users/:userId` 只读接口
- [ ] 新增 `/api/admin/projects` 和 `/api/admin/projects/:projectId` 只读接口
- [ ] 新增 `/api/admin/runs` 和 `/api/admin/failures` 只读接口
- [ ] 新增 `/api/admin/audit` 基础审计读取接口
- [ ] 新增前端 `isAdmin` 派生状态或 helper
- [ ] 在应用 shell 中仅对管理员展示后台入口
- [ ] 新增 `/admin` 路由组和后台布局
- [ ] 新增后台 Overview、Users、Projects、Runs、Failures、Audit 页面
- [ ] 为普通用户直接访问 `/admin/*` 增加前端拒绝或跳转状态
- [ ] 确保所有后台数据请求都走 `/api/admin/*`，不复用普通用户项目列表穿透
- [ ] 补充测试，覆盖普通用户不可见入口、普通用户 API 403、管理员可访问后台和后台接口，并确认后台不依赖独立 admin session
- [ ] 在文档中声明第一阶段后台菜单写死，不迁移动态菜单/角色权限系统
