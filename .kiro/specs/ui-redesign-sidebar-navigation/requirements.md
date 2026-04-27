# 需求文档

## 简介

本规格是 UI 改造项目（共 8 个 spec）的第 2 个，依赖 spec 1（`ui-redesign-color-and-tokens`）的色板与设计令牌体系。目标是将当前底部浮动 Toolbar（仅含 office/more 两个按钮）替换为固定左侧垂直导航栏，匹配参考设计中的完整导航结构：图标+文字导航项、底部用户信息区、任务统计页脚，并在不同屏幕尺寸下提供响应式适配（桌面展开侧边栏、平板图标侧边栏、移动端底部标签栏）。

当前状态：
- `Toolbar.tsx`：底部居中浮动栏，包含 `PRIMARY_NAV_ITEMS`（office / more）两个按钮
- `MoreDrawer.tsx`：Sheet 抽屉，包含 `MAIN_PATH_ITEMS`（office / tasks）和 `MORE_NAV_ITEMS`（config / permissions / audit / help）
- `navigation-config.ts`：定义 `PRIMARY_NAV_ITEMS`、`MAIN_PATH_ITEMS`、`MORE_NAV_ITEMS` 数组及路径常量
- 路由已存在：`/`、`/tasks`、`/debug`、`/debug/:section`、`/replay/:missionId`、`/lineage` 等
- 响应式断点：mobile ≤ 767px、tablet 768–1279px、desktop ≥ 1280px（`useViewportTier`）

## 术语表

- **Sidebar**：固定在页面左侧的垂直导航栏组件，桌面端宽度约 240px
- **Sidebar_Collapsed**：平板端的图标模式侧边栏，宽度约 64px，仅显示图标
- **Mobile_Tab_Bar**：移动端底部固定标签栏，显示 4–5 个核心导航项
- **Navigation_Item**：侧边栏中的单个导航条目，包含图标、中文标签和可选路由路径
- **User_Info_Block**：侧边栏底部的用户头像与信息区域
- **Task_Stats_Footer**：侧边栏底部的任务统计条，显示已完成/进行中/待处理计数
- **Scene3D_Viewport**：Three.js 3D 办公室场景的渲染区域，需随侧边栏宽度调整
- **Content_Area**：侧边栏右侧的主内容区域，承载路由页面
- **Toolbar_Legacy**：当前底部浮动导航栏组件（`Toolbar.tsx`），本 spec 完成后将被替换
- **MoreDrawer_Legacy**：当前右侧/底部抽屉导航组件（`MoreDrawer.tsx`），本 spec 完成后将被移除或精简

## 需求

### 需求 1：桌面端固定左侧导航栏

**用户故事：** 作为桌面端用户，我希望页面左侧有一个固定的垂直导航栏，包含所有主要功能入口，以便我能快速切换功能模块而无需打开抽屉。

#### 验收标准

1. WHEN 视口宽度 ≥ 1280px 时，THE Sidebar SHALL 以固定定位渲染在页面左侧，宽度为 240px
2. THE Sidebar SHALL 包含以下导航项（从上到下排列）：自动驾驶（`/`）、任务中心（`/tasks`）、项目空间、知识库、数据源、数据看板、智能体市场、通知中心、设置与集成（`/debug`）
3. WHEN 用户点击某个 Navigation_Item 时，THE Sidebar SHALL 使用 wouter 的 `setLocation` 导航到对应路由路径
4. THE Sidebar SHALL 高亮当前活跃路由对应的 Navigation_Item，使用 `--primary` 色作为活跃指示
5. THE Content_Area SHALL 位于 Sidebar 右侧，左边距等于 Sidebar 宽度（240px），不与 Sidebar 重叠
6. THE Scene3D_Viewport SHALL 在 Sidebar 存在时自动缩窄，渲染宽度为 `视口宽度 - 240px`
7. THE Sidebar SHALL 在顶部显示应用 Logo 或品牌标识区域
8. THE Sidebar SHALL 在底部显示 User_Info_Block，包含用户头像占位和用户名占位
9. THE Sidebar SHALL 在 User_Info_Block 下方显示 Task_Stats_Footer，包含已完成、进行中、待处理三个计数
10. THE Sidebar SHALL 消费 spec 1 定义的 `--sidebar`、`--sidebar-foreground`、`--sidebar-border`、`--sidebar-accent`、`--sidebar-primary` 等设计令牌

### 需求 2：平板端可折叠图标侧边栏

**用户故事：** 作为平板端用户，我希望侧边栏默认折叠为仅图标模式以节省屏幕空间，同时可以展开查看完整标签。

#### 验收标准

1. WHEN 视口宽度在 768px–1279px 之间时，THE Sidebar SHALL 默认以 Sidebar_Collapsed 模式渲染，宽度为 64px
2. WHILE Sidebar 处于折叠模式时，THE Sidebar SHALL 仅显示每个 Navigation_Item 的图标，隐藏文字标签
3. WHILE Sidebar 处于折叠模式时，THE Sidebar SHALL 在图标 hover 时显示 Tooltip 提示完整标签名
4. WHEN 用户点击折叠/展开按钮时，THE Sidebar SHALL 在 64px 和 240px 之间切换，使用 CSS transition 动画（duration 200–300ms）
5. THE Content_Area SHALL 在 Sidebar 折叠/展开时自动调整左边距，保持内容不被遮挡
6. WHILE Sidebar 处于折叠模式时，THE User_Info_Block SHALL 仅显示用户头像，隐藏用户名
7. WHILE Sidebar 处于折叠模式时，THE Task_Stats_Footer SHALL 隐藏

### 需求 3：移动端底部标签栏

**用户故事：** 作为移动端用户，我希望底部有一个固定标签栏提供核心导航，以便我能用拇指轻松切换功能。

#### 验收标准

1. WHEN 视口宽度 ≤ 767px 时，THE Sidebar SHALL 不渲染，改为渲染 Mobile_Tab_Bar
2. THE Mobile_Tab_Bar SHALL 固定在屏幕底部，高度约 56–64px，包含 4–5 个核心导航项
3. THE Mobile_Tab_Bar SHALL 至少包含以下导航项：自动驾驶（`/`）、任务中心（`/tasks`）、知识库、设置（`/debug`）
4. THE Mobile_Tab_Bar SHALL 为每个导航项显示图标和简短标签
5. THE Mobile_Tab_Bar SHALL 高亮当前活跃路由对应的标签项
6. THE Mobile_Tab_Bar SHALL 尊重 `env(safe-area-inset-bottom)` 以适配有底部安全区的设备
7. THE Content_Area SHALL 在移动端不设置左边距，底部留出 Mobile_Tab_Bar 的高度空间

### 需求 4：导航配置数据结构扩展

**用户故事：** 作为前端开发者，我希望 `navigation-config.ts` 中的导航数据结构能支持参考设计中的所有导航项，以便侧边栏和标签栏能从统一数据源渲染。

#### 验收标准

1. THE Navigation_Item SHALL 扩展为包含以下字段：`id`（唯一标识）、`icon`（LucideIcon）、`labelKey`（i18n 键）、`href`（可选路由路径）、`mobileVisible`（是否在移动端标签栏显示）
2. THE navigation-config.ts SHALL 导出一个新的 `SIDEBAR_NAV_ITEMS` 数组，包含参考设计中的全部 9 个导航项
3. WHEN Navigation_Item 的 `href` 未定义时，THE Sidebar SHALL 将该项渲染为禁用状态或占位状态
4. THE navigation-config.ts SHALL 导出一个 `getMobileTabItems()` 函数，返回 `mobileVisible: true` 的导航项子集（4–5 个）
5. THE navigation-config.ts SHALL 保留现有的 `getPrimaryNavigationId()`、`getCompatibilityRedirect()` 等函数的兼容性

### 需求 5：替换旧导航组件

**用户故事：** 作为前端开发者，我希望新的侧边栏完全替换旧的 Toolbar 和 MoreDrawer，以便消除导航入口的冗余。

#### 验收标准

1. WHEN Sidebar 组件就绪后，THE App SHALL 使用 Sidebar 替换 `<Toolbar />` 在 `App.tsx` 中的位置
2. THE Toolbar_Legacy 组件（`Toolbar.tsx`）SHALL 不再被 `App.tsx` 引用
3. THE MoreDrawer_Legacy 组件（`MoreDrawer.tsx`）SHALL 不再被 Sidebar 或 App 引用（原有的 debug/config/permissions/audit/help 入口已整合到 Sidebar 的"设置与集成"导航项中）
4. IF 其他组件（如 `OfficeTaskCockpit`）通过 `OFFICE_DESKTOP_OPEN_MORE_EVENT` 事件触发 MoreDrawer，THEN THE Sidebar SHALL 提供替代机制或移除该事件依赖
5. THE App SHALL 在 Sidebar 右侧渲染 `<Router />`，形成经典的侧边栏+内容区布局

### 需求 6：与 Scene3D 视口协调

**用户故事：** 作为用户，我希望 3D 办公室场景在侧边栏存在时能正确调整大小，不出现裁切或拉伸。

#### 验收标准

1. WHEN Sidebar 宽度变化时（展开/折叠/隐藏），THE Scene3D_Viewport SHALL 在下一帧重新计算渲染尺寸
2. THE Scene3D_Viewport SHALL 监听 Sidebar 宽度变化（通过 CSS 变量、Context 或 resize observer），而非硬编码偏移量
3. IF Scene3D 使用 `window.innerWidth` 计算画布尺寸，THEN THE Scene3D_Viewport SHALL 改为使用容器元素的实际宽度

### 需求 7：无障碍与键盘导航

**用户故事：** 作为使用键盘或辅助技术的用户，我希望侧边栏导航支持标准的无障碍交互模式。

#### 验收标准

1. THE Sidebar SHALL 使用 `<nav>` 语义元素包裹导航列表，并设置 `aria-label="主导航"`
2. THE Sidebar SHALL 为当前活跃的 Navigation_Item 设置 `aria-current="page"`
3. WHEN Sidebar 处于折叠模式时，THE Sidebar 的折叠/展开按钮 SHALL 设置 `aria-expanded` 属性
4. THE Mobile_Tab_Bar SHALL 使用 `role="tablist"` 和 `role="tab"` 语义
5. THE Sidebar 和 Mobile_Tab_Bar SHALL 支持 Tab 键在导航项之间移动焦点

