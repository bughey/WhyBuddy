# 任务清单：Admin Audit And Support Operations

- [ ] 定义 `AdminAuditLog` 类型和只追加持久化策略
- [ ] 定义后台操作 capability helper，区分 `admin` 和 `super_admin`
- [ ] 为管理员写操作增加 `reason` 校验
- [ ] 实现禁用用户接口，并写入审计日志
- [ ] 实现恢复用户接口，仅允许 `super_admin` 调用
- [ ] 实现管理员归档项目接口，不物理删除项目证据链
- [ ] 实现失败任务重试接口，并记录操作者和原因
- [ ] 实现失败任务标记已处理接口
- [ ] 实现管理员 evidence 查看接口，默认返回脱敏内容
- [ ] 实现 evidence 导出接口，仅允许高权限管理员调用并记录审计
- [ ] 新增后台高风险动作确认 UI，要求填写或选择原因
- [ ] 新增后台审计详情页，支持按 actor、target、action、project 和时间筛选
- [ ] 为用户邮箱、日志、artifact preview 和 evidence detail 增加脱敏 helper
- [ ] 补充测试，覆盖权限分级、reason 必填、审计只追加、禁用用户无法登录、导出审计记录
- [ ] 在文档中声明本 spec 为后置可选，不阻塞 ToC 登录和个人项目隔离 MVP
