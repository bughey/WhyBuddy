# 任务清单：状态指示器卡片

## 任务

- [ ] 1. 创建 SidebarStatusBlock 组件
  - [ ] 1.1 新建 `client/src/components/SidebarStatusBlock.tsx`，接收 collapsed 和 locale props
  - [ ] 1.2 实现 driveState 到圆点颜色和标签的映射函数
  - [ ] 1.3 实现 Autopilot Control 卡片：状态圆点 + 标题 + 状态标签
  - [ ] 1.4 实现 Mission Control 卡片：模式图标 + 标题 + 模式标签
  - [ ] 1.5 实现折叠模式：仅显示圆点/图标，hover 显示 Tooltip
  - [ ] 1.6 消费 `--sidebar-*` 设计令牌

- [ ] 2. 集成到 AppSidebar
  - [ ] 2.1 在 AppSidebar 的 SidebarUserBlock 上方插入 SidebarStatusBlock
  - [ ] 2.2 传递 collapsed 和 locale props

- [ ] 3. i18n 扩展
  - [ ] 3.1 在中英文资源中新增状态标签翻译键（自主执行中/规划中/等待接管/异常/已完成/待命中）

- [ ] 4. 验证
  - [ ] 4.1 编写组件测试：各种 driveState 值的渲染正确性
  - [ ] 4.2 编写组件测试：collapsed 模式下文字隐藏
  - [ ] 4.3 编写组件测试：无选中任务时展示"待命中"
  - [ ] 4.4 运行 `pnpm run build` 验证构建成功
