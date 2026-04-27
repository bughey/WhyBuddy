<!--
 * @Author: wangchunji
 * @Date: 2026-04-27 14:28:54
 * @Description: 
 * @LastEditTime: 2026-04-27 15:27:58
 * @LastEditors: wangchunji
-->
# 任务清单：左侧垂直导航栏

## 任务

- [ ] 1. 扩展导航配置数据结构（`navigation-config.ts`）
  - [ ] 1.1 新增 `SidebarNavigationId` 类型，包含 9 个导航项 ID
  - [ ] 1.2 新增 `SidebarNavigationItem` 接口，包含 `id`、`icon`、`href`、`mobileVisible`、`disabled` 字段
  - [ ] 1.3 新增 `SIDEBAR_NAV_ITEMS` 常量数组，包含全部 9 个导航项（自动驾驶、任务中心、项目空间、知识库、数据源、数据看板、智能体市场、通知中心、设置与集成）
  - [ ] 1.4 新增 `getMobileTabItems()` 函数，返回 `mobileVisible: true` 的导航项子集
  - [ ] 1.5 新增 `getActiveSidebarId(path: string)` 函数，根据当前路径返回活跃导航项 ID
  - [ ] 1.6 保留现有 `getPrimaryNavigationId()`、`getCompatibilityRedirect()`、`PRIMARY_NAV_ITEMS` 等导出以保持兼容
- [ ] 2. 扩展 i18n 资源
  - [ ] 2.1 在中文资源中新增 `sidebar` 命名空间，包含 9 个导航项标签及折叠/展开/即将推出等辅助文案
  - [ ] 2.2 在英文资源中新增对应的 `sidebar` 命名空间
- [ ] 3. 创建 AppSidebar 组件（`client/src/components/AppSidebar.tsx`）
  - [ ] 3.1 实现侧边栏外壳：`<aside>` 元素，固定定位，消费 `--sidebar`、`--sidebar-foreground`、`--sidebar-border` 令牌
  - [ ] 3.2 实现 SidebarHeader 子组件：顶部 Logo/品牌区域
  - [ ] 3.3 实现 SidebarNavItem 子组件：图标+文字导航项，支持 active/disabled/collapsed 三种状态
  - [ ] 3.4 实现活跃项高亮：使用 `--sidebar-primary` 和 `--sidebar-primary-foreground` 令牌，左侧 3px 指示条
  - [ ] 3.5 实现折叠模式：collapsed 时宽度 64px，仅显示图标，hover 显示 Tooltip
  - [ ] 3.6 实现折叠/展开切换按钮，带 `aria-expanded` 属性和 CSS transition 动画
  - [ ] 3.7 实现 SidebarUserBlock 子组件：底部用户头像+用户名区域（collapsed 时仅显示头像）
  - [ ] 3.8 实现 SidebarTaskStats 子组件：已完成/进行中/待处理计数条（collapsed 时隐藏）
  - [ ] 3.9 为 `<nav>` 元素设置 `aria-label="主导航"`，活跃项设置 `aria-current="page"`
  - [ ] 3.10 禁用项（`disabled: true` 或无 `href`）渲染为 `opacity: 0.5`、`cursor: not-allowed`，点击不触发导航
- [ ] 4. 创建 MobileTabBar 组件（`client/src/components/MobileTabBar.tsx`）
  - [ ] 4.1 实现底部固定标签栏：消费 `--sidebar`、`--sidebar-border` 令牌，尊重 `env(safe-area-inset-bottom)`
  - [ ] 4.2 渲染 `getMobileTabItems()` 返回的 4–5 个导航项，每项显示图标和简短标签
  - [ ] 4.3 实现活跃项高亮，使用 `--sidebar-primary` 令牌
  - [ ] 4.4 设置 `role="tablist"` 和 `role="tab"` 语义
- [ ] 5. 改造 App.tsx 布局
  - [ ] 5.1 移除 `<Toolbar />` 的 import 和渲染
  - [ ] 5.2 新增 `sidebarCollapsed` 状态，平板端默认折叠
  - [ ] 5.3 在非移动端渲染 `<AppSidebar>`，在移动端渲染 `<MobileTabBar>`
  - [ ] 5.4 为 Content Area 设置 `margin-left` 等于当前侧边栏宽度，并通过 CSS 变量 `--sidebar-width` 传递
  - [ ] 5.5 为 Content Area 的 `margin-left` 添加 `transition` 动画以配合折叠/展开
  - [ ] 5.6 移除 `OFFICE_DESKTOP_OPEN_MORE_EVENT` 事件的监听和分发逻辑（如存在于 App 层）
- [ ] 6. Scene3D 视口协调
  - [ ] 6.1 确认 Scene3D 的 `<Canvas>` 使用容器宽度（`width: 100%`）而非 `window.innerWidth`
  - [ ] 6.2 如果 Scene3D 使用硬编码宽度，改为通过 `ResizeObserver` 或 CSS 变量 `--sidebar-width` 感知侧边栏宽度
  - [ ] 6.3 验证侧边栏折叠/展开时 3D 场景正确重新渲染，无裁切或拉伸
- [ ] 7. 清理旧导航依赖
  - [ ] 7.1 确认 `App.tsx` 不再引用 `Toolbar` 组件
  - [ ] 7.2 确认 `App.tsx` 不再引用 `MoreDrawer` 组件（如果之前由 Toolbar 内部引用则已随 Toolbar 移除）
  - [ ] 7.3 确认 `OFFICE_DESKTOP_OPEN_MORE_EVENT` 不再被任何组件 dispatch 或 listen
  - [ ] 7.4 保留 `Toolbar.tsx` 和 `MoreDrawer.tsx` 文件不删除（后续统一清理 spec 处理）
- [ ] 8. 验证与回归
  - [ ] 8.1 运行 `pnpm run build` 验证构建成功
  - [ ] 8.2 验证桌面端（≥ 1280px）渲染展开侧边栏，内容区正确偏移
  - [ ] 8.3 验证平板端（768–1279px）渲染折叠图标栏，内容区正确偏移
  - [ ] 8.4 验证移动端（≤ 767px）渲染底部标签栏，无侧边栏
  - [ ] 8.5 验证点击"自动驾驶"导航到 `/`，点击"任务中心"导航到 `/tasks`，点击"设置与集成"导航到 `/debug`
  - [ ] 8.6 验证禁用导航项（项目空间、知识库等）点击无响应
  - [ ] 8.7 验证现有路由（`/`、`/tasks`、`/tasks/:id`、`/debug`、`/debug/:section`、`/replay/:id`）仍可正常访问
  - [ ] 8.8 验证 Scene3D 在侧边栏展开/折叠/隐藏时正确调整渲染尺寸

