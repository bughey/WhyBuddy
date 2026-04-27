# 需求文档

## 简介

本规格是 UI 改造项目（共 8 个 spec）的第 6 个，依赖 spec 2（`ui-redesign-sidebar-navigation`）的左侧垂直导航栏布局和 spec 5（`ui-redesign-launch-panel`）的居中浮层面板。目标是将当前 Three.js 3D 办公室场景（`Scene3D.tsx`）适配到新的侧边栏布局中，确保场景在侧边栏展开（240px）、折叠（64px）和隐藏（移动端）三种状态下正确渲染，并在 Launch Panel 浮层打开时作为背景保持可见。

当前状态：
- `Scene3D.tsx`：Three.js + React Three Fiber Canvas，包含 OfficeRoom、PetWorkers、MissionIsland、SandboxMonitor、SceneStageFlow、WaitingDecisionBubble、CrossPodParticles、CrossFrameworkParticles 等子组件
- 使用 `useViewportTier` 进行响应式断点判断（mobile ≤ 767px、tablet 768–1279px、desktop ≥ 1280px）
- Canvas 外层容器使用 `absolute inset-0` 占满父元素，Canvas 自身未硬编码宽高
- 相机位置和 FOV 按 mobile / tablet / desktop 三档硬编码，针对全宽视口优化
- `performanceProfile` 属性支持 `balanced` 和 `resizing` 两种模式，`resizing` 模式下降低 DPR 和关闭抗锯齿
- 当前 Canvas 的 `onCreated` 回调中 `lookAt` 目标和 `toneMappingExposure` 按 `isMobile` 区分

## 术语表

- **Scene3D_Viewport**：Three.js 3D 办公室场景的渲染区域，即 `Scene3D.tsx` 组件及其 R3F Canvas
- **Sidebar**：spec 2 定义的固定左侧垂直导航栏，桌面端宽度 240px
- **Sidebar_Collapsed**：平板端的图标模式侧边栏，宽度 64px
- **Content_Area**：侧边栏右侧的主内容区域，通过 `margin-left: var(--sidebar-width)` 推挤布局
- **Launch_Panel**：spec 5 定义的居中浮层面板，以 Portal 方式渲染在 Scene3D 之上
- **Panel_Backdrop**：Launch Panel 的半透明遮罩层，覆盖在 Scene3D 之上
- **Effective_Viewport_Width**：Scene3D 实际可用的渲染宽度，等于 `视口宽度 - 侧边栏宽度`
- **Resize_Transition**：侧边栏折叠/展开时的 CSS transition 动画期间（约 200–300ms）
- **WebGL_Context**：Three.js 使用的 WebGL 渲染上下文，创建和销毁成本高

## 需求

### 需求 1：容器宽度自适应

**用户故事：** 作为用户，我希望 3D 办公室场景在侧边栏存在时能自动调整渲染宽度，不出现裁切、拉伸或水平溢出。

#### 验收标准

1. THE Scene3D_Viewport SHALL 使用其父容器元素的实际宽度作为 Canvas 渲染宽度，而非 `window.innerWidth`
2. WHEN Sidebar 宽度为 240px（桌面展开）时，THE Scene3D_Viewport SHALL 在 `Effective_Viewport_Width`（视口宽度 - 240px）内完整渲染
3. WHEN Sidebar 宽度为 64px（平板折叠）时，THE Scene3D_Viewport SHALL 在 `Effective_Viewport_Width`（视口宽度 - 64px）内完整渲染
4. WHEN Sidebar 隐藏（移动端）时，THE Scene3D_Viewport SHALL 占满整个视口宽度
5. THE Scene3D_Viewport 的 R3F Canvas SHALL 使用 `style={{ width: '100%', height: '100%' }}` 或等效方式自动适配容器尺寸，不硬编码像素值

### 需求 2：相机适配窄视口

**用户故事：** 作为桌面端用户，我希望在侧边栏展开后 3D 场景的相机角度和视野能自动调整，使办公室场景在较窄的视口中仍然看起来完整且美观。

#### 验收标准

1. WHEN Effective_Viewport_Width ≤ 1040px（即 1280px 视口 - 240px 侧边栏）时，THE Scene3D_Viewport SHALL 调整相机 FOV 或相机位置，使办公室场景的核心区域（办公桌、宠物工作者、任务岛）保持可见
2. THE Scene3D_Viewport SHALL 根据 Effective_Viewport_Width 的变化平滑调整相机参数，而非在断点处突变
3. THE Scene3D_Viewport SHALL 在 Effective_Viewport_Width 范围 800px–1920px 内保持场景视觉合理性，核心对象不被裁切
4. THE Scene3D_Viewport SHALL 保留现有的 mobile / tablet / desktop 三档相机预设作为基础，在此基础上叠加侧边栏宽度补偿

### 需求 3：侧边栏过渡期间平滑渲染

**用户故事：** 作为用户，我希望在侧边栏折叠/展开动画期间 3D 场景能平滑过渡，不出现闪烁、撕裂或明显的帧率下降。

#### 验收标准

1. WHEN Sidebar 在折叠和展开之间切换时，THE Scene3D_Viewport SHALL 在 Resize_Transition 期间持续渲染，不出现白屏或黑屏
2. WHILE Resize_Transition 进行中，THE Scene3D_Viewport SHALL 将 `performanceProfile` 切换为 `resizing` 模式，降低 DPR 并关闭非必要特效以维持帧率
3. WHEN Resize_Transition 结束后，THE Scene3D_Viewport SHALL 将 `performanceProfile` 恢复为 `balanced` 模式
4. THE Scene3D_Viewport SHALL 通过监听容器尺寸变化（ResizeObserver 或等效机制）在每一帧正确更新 Canvas 尺寸，而非依赖 `window.resize` 事件

### 需求 4：WebGL 上下文保持

**用户故事：** 作为前端开发者，我希望在用户切换场景视图和任务详情卡片（spec 3）之间时不重新创建 WebGL 上下文，以避免性能损耗和闪烁。

#### 验收标准

1. WHEN 用户从 3D 场景视图切换到任务详情卡片视图时，THE Scene3D_Viewport SHALL 保持 WebGL_Context 存活，不销毁和重建
2. WHEN 用户从任务详情卡片视图切回 3D 场景视图时，THE Scene3D_Viewport SHALL 立即恢复渲染，不出现重新初始化延迟
3. THE Scene3D_Viewport SHALL 通过 CSS `visibility: hidden` 或 `display: none` 隐藏（而非卸载组件）来实现视图切换时的上下文保持
4. IF WebGL_Context 因浏览器资源回收而丢失，THEN THE Scene3D_Viewport SHALL 检测到上下文丢失事件并自动重新初始化

### 需求 5：Launch Panel 背景模式

**用户故事：** 作为用户，我希望在打开任务发起浮层面板时 3D 场景仍然作为背景可见，营造沉浸式的视觉体验。

#### 验收标准

1. WHEN Launch_Panel 打开时，THE Scene3D_Viewport SHALL 继续渲染但不接受用户交互（鼠标事件被 Panel_Backdrop 拦截）
2. WHEN Launch_Panel 打开时，THE Scene3D_Viewport SHALL 保持当前渲染状态，不暂停动画循环
3. THE Panel_Backdrop SHALL 渲染在 Scene3D_Viewport 之上，使用半透明遮罩（`rgba(0,0,0,0.4)` 或等效冷灰遮罩）
4. WHEN Launch_Panel 关闭时，THE Scene3D_Viewport SHALL 立即恢复完整交互能力

### 需求 6：性能约束

**用户故事：** 作为前端开发者，我希望场景适配改动不引入明显的性能回退，保持流畅的用户体验。

#### 验收标准

1. THE Scene3D_Viewport SHALL 在侧边栏展开状态下（Effective_Viewport_Width ≈ 1040px）维持与当前全宽视口相当的帧率表现
2. THE Scene3D_Viewport SHALL 在 Resize_Transition 期间通过降低 DPR 至 `[1, 1]` 来减少 GPU 负载
3. THE Scene3D_Viewport SHALL 不在每次容器尺寸变化时重新创建 Canvas 或 WebGL_Context
4. THE Scene3D_Viewport SHALL 使用 `ResizeObserver` 或 R3F 内置的 resize 机制响应容器尺寸变化，避免使用高频 `requestAnimationFrame` 轮询容器尺寸

### 需求 7：响应式断点兼容

**用户故事：** 作为前端开发者，我希望场景适配与现有的 `useViewportTier` 断点系统兼容，不引入第二套断点逻辑。

#### 验收标准

1. THE Scene3D_Viewport SHALL 继续使用 `useViewportTier` 提供的 `isMobile`、`isTablet`、`isDesktop` 判断基础视口层级
2. THE Scene3D_Viewport SHALL 在 `useViewportTier` 的基础上额外感知侧边栏宽度（通过 CSS 变量 `--sidebar-width`、Context 或 prop），用于精细调整相机参数
3. THE Scene3D_Viewport SHALL 不修改 `useViewportTier` 的断点阈值（mobile ≤ 767px、tablet 768–1279px、desktop ≥ 1280px）
