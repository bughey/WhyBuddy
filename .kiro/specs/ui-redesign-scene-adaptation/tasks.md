# 任务清单：3D 场景视口适配

## 说明

本任务清单对应 `ui-redesign-scene-adaptation` spec，将 Three.js 3D 办公室场景适配到 spec 2 的侧边栏布局中。依赖 spec 2（`ui-redesign-sidebar-navigation`）和 spec 5（`ui-redesign-launch-panel`）。

## 任务

- [ ] 1. 创建 useContainerWidth Hook
  - [ ] 1.1 新建 `client/src/hooks/useContainerWidth.ts`，使用 `useSyncExternalStore` + `ResizeObserver` 监听容器宽度
  - [ ] 1.2 实现 ref 为 null 时回退到 `window.innerWidth` 的 fallback 逻辑
  - [ ] 1.3 实现 SSR 安全的 `getServerSnapshot`（返回 1280）
  - [ ] 1.4 编写单元测试，验证 ref 为 null 时返回 window.innerWidth

- [ ] 2. 实现相机补偿算法
  - [ ] 2.1 新建 `client/src/components/three/camera-compensation.ts`，实现 `computeFovCompensation(effectiveWidth)` 函数
  - [ ] 2.2 实现 `computeCameraXOffset(effectiveWidth, sidebarWidth)` 函数
  - [ ] 2.3 编写单元测试，验证 FOV 补偿的单调性（宽度越小补偿越大）
  - [ ] 2.4 编写单元测试，验证 FOV 补偿的有界性（返回值在 [0, 6] 范围内）
  - [ ] 2.5 编写属性测试（fast-check），对任意 effectiveWidth 验证单调性和有界性

- [ ] 3. 创建 CameraController 组件
  - [ ] 3.1 在 `client/src/components/three/CameraController.tsx` 中实现 R3F 内部组件，接收 effectiveWidth 和 tier props
  - [ ] 3.2 在 useEffect 中根据 effectiveWidth 计算最终 FOV 并更新 PerspectiveCamera
  - [ ] 3.3 保留现有 mobile/tablet/desktop 三档基础 FOV 预设，在此基础上叠加补偿值

- [ ] 4. 改造 Scene3D 组件
  - [ ] 4.1 为 Scene3D 新增 `sidebarWidth` 和 `hidden` props
  - [ ] 4.2 在 Scene3D 内部使用 `useContainerWidth` 获取容器实际宽度
  - [ ] 4.3 将 `CameraController` 组件插入 Canvas 内部，传递 effectiveWidth 和 tier
  - [ ] 4.4 确认 Canvas 的 `resize` 配置为 `{ scroll: false, debounce: { scroll: 0, resize: 0 } }`
  - [ ] 4.5 实现 `hidden` prop 控制：hidden 时设置 `visibility: hidden` 并将 `frameloop` 切换为 `demand`
  - [ ] 4.6 确认 Canvas 外层容器使用 `absolute inset-0` 自动占满父元素，不硬编码宽高

- [ ] 5. 实现过渡期间性能降级
  - [ ] 5.1 在 Scene3D 的父组件（Home.tsx）中，使用 `useViewportResizeState()` 检测 resize 活跃状态
  - [ ] 5.2 当 resize 活跃时将 `performanceProfile` 设为 `resizing`，结束后恢复为 `balanced`
  - [ ] 5.3 确认 `resizing` 模式下 DPR 降至 `[1, 1]`、关闭抗锯齿和次要特效（现有逻辑已支持）

- [ ] 6. 集成侧边栏宽度传递
  - [ ] 6.1 在 Home.tsx 中将 `sidebarWidth` 作为 prop 传递给 Scene3D
  - [ ] 6.2 确认 Content Area 的 `margin-left` 由 spec 2 的 CSS 变量控制，Scene3D 父容器自然缩窄
  - [ ] 6.3 验证侧边栏展开（240px）、折叠（64px）、隐藏（0px）三种状态下 Scene3D 容器宽度正确

- [ ] 7. WebGL 上下文保持验证
  - [ ] 7.1 确认视图切换时 Scene3D 使用 `visibility: hidden` 而非组件卸载
  - [ ] 7.2 验证从 Scene3D 切换到 TaskDetailCardsView 再切回时，Canvas 元素仍存在于 DOM 中
  - [ ] 7.3 验证切回后场景立即恢复渲染，无重新初始化延迟

- [ ] 8. 验证与回归
  - [ ] 8.1 运行 `pnpm run build` 验证构建成功
  - [ ] 8.2 验证 1280px 视口 + 240px 侧边栏下场景核心区域（办公桌、宠物、任务岛）完整可见
  - [ ] 8.3 验证 1024px 视口 + 64px 侧边栏下场景视觉合理
  - [ ] 8.4 验证移动端（375px）场景全宽渲染正常
  - [ ] 8.5 验证侧边栏折叠/展开过渡期间无白屏、黑屏或明显帧率下降
  - [ ] 8.6 验证 Launch Panel 打开时场景作为背景继续渲染
  - [ ] 8.7 验证现有 3D 子组件（OfficeRoom、PetWorkers、MissionIsland、SandboxMonitor）不受影响
