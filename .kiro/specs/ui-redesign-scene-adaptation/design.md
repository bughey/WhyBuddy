# 设计文档：3D 场景视口适配

## 概述

本设计文档描述如何将 Three.js 3D 办公室场景（`Scene3D.tsx`）适配到 spec 2 定义的侧边栏布局中，确保场景在侧边栏展开（240px）、折叠（64px）和隐藏（移动端）三种状态下正确渲染，并在 spec 5 的 Launch Panel 浮层打开时作为背景保持可见。

**设计目标**：
- R3F Canvas 使用容器宽度（100%）而非 `window.innerWidth`，自然适配侧边栏推挤布局
- 相机 FOV / 位置根据实际可用宽度动态调整，窄视口下场景核心区域保持可见
- 侧边栏折叠/展开过渡期间降级渲染以维持帧率
- 视图切换时保持 WebGL 上下文存活，避免重建开销
- Launch Panel 打开时场景继续渲染作为背景

**设计决策**：
1. **容器驱动尺寸**：Scene3D 的父容器自然占满 Content Area 宽度（由 spec 2 的 `margin-left: var(--sidebar-width)` 推挤），R3F Canvas 使用 `width: 100%; height: 100%` 自动适配。这是最简单且最可靠的方案，因为 R3F 的 `<Canvas>` 组件内置了 ResizeObserver 来响应容器尺寸变化。
2. **连续相机补偿**：不在断点处突变相机参数，而是根据 `effectiveWidth` 连续计算 FOV 补偿值，叠加在现有 mobile/tablet/desktop 三档预设之上。
3. **复用 `useViewportResizeState`**：利用 `useViewportTier.ts` 中已有的 `useViewportResizeState()` hook 检测 resize 活跃状态，在过渡期间自动切换 `performanceProfile` 为 `resizing`。
4. **CSS 隐藏保持上下文**：视图切换时使用 `visibility: hidden` 或条件渲染外层 wrapper 的 `display` 来隐藏场景，而非卸载 `<Scene3D />` 组件，确保 WebGL 上下文存活。
5. **z-index 分层**：Scene3D（z-0）→ Content UI（z-10）→ Panel Backdrop（z-50）→ Launch Panel（z-50），场景始终在最底层。

## 架构

### 整体布局层级

```
┌──────────────────────────────────────────────────────┐
│                    App.tsx                            │
│  ┌──────────┬───────────────────────────────────┐    │
│  │          │         Content Area               │    │
│  │ Sidebar  │    (margin-left: var(--sw))        │    │
│  │ (fixed)  │                                    │    │
│  │          │  ┌──────────────────────────────┐  │    │
│  │          │  │  Scene3D Container (z-0)     │  │    │
│  │          │  │  ┌────────────────────────┐  │  │    │
│  │          │  │  │  R3F Canvas            │  │  │    │
│  │          │  │  │  (width:100% h:100%)   │  │  │    │
│  │          │  │  └────────────────────────┘  │  │    │
│  │          │  └──────────────────────────────┘  │    │
│  │          │                                    │    │
│  │          │  ┌──────────────────────────────┐  │    │
│  │          │  │  Content UI Overlay (z-10)   │  │    │
│  │          │  │  (Task Cards, HUD, etc.)     │  │    │
│  │          │  └──────────────────────────────┘  │    │
│  └──────────┴───────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  Launch Panel Portal (z-50)                  │    │
│  │  ┌────────────────────────────────────────┐  │    │
│  │  │  Panel Backdrop (半透明遮罩)           │  │    │
│  │  │  ┌────────────────────────────────┐    │  │    │
│  │  │  │  Launch Panel Shell            │    │  │    │
│  │  │  └────────────────────────────────┘    │  │    │
│  │  └────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

### 尺寸响应链路

```
window.resize / sidebar toggle
  → Content Area 宽度变化 (CSS margin-left transition)
  → Scene3D 父容器宽度变化
  → R3F Canvas 内置 ResizeObserver 检测到变化
  → Canvas 自动更新 renderer.setSize()
  → useContainerWidth() hook 获取新宽度
  → 相机参数重新计算 (FOV 补偿)
  → 下一帧以新参数渲染
```

### 过渡期间性能降级链路

```
sidebar toggle 开始
  → useViewportResizeState() 返回 true
  → performanceProfile 切换为 'resizing'
  → DPR 降至 [1, 1]，关闭抗锯齿和次要特效
  → sidebar transition 结束 (200-300ms)
  → useViewportResizeState() 返回 false (经过 180ms settle)
  → performanceProfile 恢复为 'balanced'
  → DPR 恢复，重新开启特效
```

## 组件与接口

### 1. Scene3D 容器适配（修改 `Scene3D.tsx`）

#### 当前结构

```tsx
<div className="absolute inset-0 z-0 h-full w-full touch-pan-y">
  <Canvas shadows camera={camera} dpr={dpr} ... >
    {/* 场景内容 */}
  </Canvas>
</div>
```

#### 新结构

容器结构不变，关键改动在于：
- Canvas 已经通过父容器的 `absolute inset-0` 自动占满可用空间
- 父容器位于 Content Area 内部，Content Area 的 `margin-left` 由 spec 2 控制
- 因此 Canvas 自然获得正确的渲染宽度，无需手动计算

```tsx
<div className="absolute inset-0 z-0 h-full w-full touch-pan-y">
  <Canvas
    shadows
    camera={camera}
    dpr={dpr}
    gl={{ antialias: !reducedSceneEffects, alpha: false }}
    resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
    onCreated={({ gl, camera: sceneCamera }) => {
      gl.setClearColor('#BFDFFF');
      gl.toneMapping = ACESFilmicToneMapping;
      gl.toneMappingExposure = isMobile ? 0.92 : 0.88;
      sceneCamera.lookAt(0, isMobile ? 1.6 : 1.35, 0);
    }}
  >
    <CameraController effectiveWidth={effectiveWidth} tier={tier} />
    {/* 其余场景内容不变 */}
  </Canvas>
</div>
```

**关键配置**：
- `resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}`：禁用 scroll 触发的 resize，resize debounce 设为 0 以确保过渡期间每帧更新。R3F 的 Canvas 组件内置 ResizeObserver，会自动响应容器尺寸变化并调用 `renderer.setSize()`。

### 2. useContainerWidth Hook（新建 `client/src/hooks/useContainerWidth.ts`）

用于在 R3F Canvas 外部获取容器实际宽度，供相机参数计算使用。

```typescript
import { useCallback, useSyncExternalStore } from 'react';

/**
 * 监听指定 DOM 元素的宽度变化。
 * 如果未提供 ref，回退到 window.innerWidth。
 */
export function useContainerWidth(ref: React.RefObject<HTMLElement | null>): number {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const el = ref.current;
      if (!el) {
        window.addEventListener('resize', onStoreChange, { passive: true });
        return () => window.removeEventListener('resize', onStoreChange);
      }
      const observer = new ResizeObserver(onStoreChange);
      observer.observe(el);
      return () => observer.disconnect();
    },
    [ref]
  );

  const getSnapshot = useCallback(() => {
    const el = ref.current;
    return el ? el.clientWidth : window.innerWidth;
  }, [ref]);

  const getServerSnapshot = useCallback(() => 1280, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

### 3. CameraController 组件（新建内联组件或独立文件）

在 R3F Canvas 内部运行，根据 `effectiveWidth` 动态调整相机参数。

```typescript
interface CameraControllerProps {
  effectiveWidth: number;
  tier: ViewportTier;
}
```

#### 相机补偿算法

```typescript
/**
 * 根据实际可用宽度计算相机 FOV 补偿值。
 * 
 * 基准：desktop 全宽 (1280px+) 时 FOV = 40
 * 当宽度缩小时，适当增大 FOV 以保持场景核心区域可见。
 * 
 * 补偿范围：0° ~ +6°
 * - effectiveWidth >= 1200px → 补偿 0°
 * - effectiveWidth = 800px → 补偿 +6°
 * - 线性插值
 */
function computeFovCompensation(effectiveWidth: number): number {
  const WIDE_THRESHOLD = 1200;
  const NARROW_THRESHOLD = 800;
  const MAX_COMPENSATION = 6;

  if (effectiveWidth >= WIDE_THRESHOLD) return 0;
  if (effectiveWidth <= NARROW_THRESHOLD) return MAX_COMPENSATION;

  const ratio = (WIDE_THRESHOLD - effectiveWidth) / (WIDE_THRESHOLD - NARROW_THRESHOLD);
  return ratio * MAX_COMPENSATION;
}

/**
 * 根据实际可用宽度计算相机 X 轴偏移。
 * 当视口变窄时，相机略微向右偏移以补偿侧边栏占用的空间，
 * 使场景中心在视觉上保持居中。
 * 
 * 补偿范围：0 ~ +0.3
 */
function computeCameraXOffset(effectiveWidth: number, sidebarWidth: number): number {
  if (sidebarWidth === 0) return 0;
  const MAX_OFFSET = 0.3;
  const ratio = Math.min(sidebarWidth / 240, 1);
  return ratio * MAX_OFFSET;
}
```

#### CameraController 实现

```tsx
function CameraController({ effectiveWidth, tier }: CameraControllerProps) {
  const { camera } = useThree();

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;

    // 基础 FOV（来自现有三档预设）
    const baseFov = tier === 'mobile' ? 46 : tier === 'tablet' ? 43 : 40;
    const fovCompensation = computeFovCompensation(effectiveWidth);
    const targetFov = baseFov + fovCompensation;

    // 平滑过渡 FOV
    camera.fov = targetFov;
    camera.updateProjectionMatrix();
  }, [effectiveWidth, tier, camera]);

  return null;
}
```

### 4. Scene3D Props 扩展

```typescript
export interface Scene3DProps {
  performanceProfile?: ScenePerformanceProfile;
  /** 侧边栏当前宽度（px），用于相机补偿计算。默认 0。 */
  sidebarWidth?: number;
  /** 是否隐藏场景（视图切换时使用 CSS 隐藏而非卸载）。默认 false。 */
  hidden?: boolean;
}
```

### 5. performanceProfile 自动切换逻辑

在 Scene3D 的父组件（如 `Home.tsx`）中：

```tsx
function Home() {
  const isResizing = useViewportResizeState();

  // 侧边栏过渡期间自动降级
  const sceneProfile: ScenePerformanceProfile = isResizing ? 'resizing' : 'balanced';

  return (
    <div className="relative h-full w-full">
      <Scene3D
        performanceProfile={sceneProfile}
        sidebarWidth={sidebarWidth}
      />
      {/* 其他 UI 内容 */}
    </div>
  );
}
```

### 6. WebGL 上下文保持策略

#### 视图切换场景

当用户在 3D 场景视图和任务详情卡片之间切换时：

```tsx
{/* 方案：使用 CSS visibility 控制显隐 */}
<div style={{ visibility: showScene ? 'visible' : 'hidden' }}>
  <Scene3D performanceProfile={sceneProfile} sidebarWidth={sidebarWidth} />
</div>

{showTaskDetail && (
  <TaskDetailCards />
)}
```

**为什么用 `visibility: hidden` 而非 `display: none`**：
- `visibility: hidden` 保持元素在布局中占位，Canvas 尺寸不变
- WebGL 上下文不会因为元素不可见而被回收
- R3F 的渲染循环在 `visibility: hidden` 时仍然运行（可通过 `frameloop="demand"` 优化）

**可选优化**：当场景隐藏时，将 `frameloop` 切换为 `"demand"` 以暂停自动渲染循环，减少 GPU 负载：

```tsx
<Canvas
  frameloop={hidden ? 'demand' : 'always'}
  // ...
/>
```

### 7. Launch Panel 背景模式

Launch Panel 通过 Portal 渲染到 `document.body`，其 z-index（50）高于 Scene3D（0）。Scene3D 无需做任何特殊处理：

- Panel Backdrop 的 `pointer-events: auto` 拦截所有鼠标事件
- Scene3D 的 Canvas 继续渲染（动画不暂停）
- 半透明遮罩在视觉上将场景降为背景

如果需要在 Launch Panel 打开时进一步降低场景 GPU 负载，可选择：
- 将 DPR 降至 `[1, 1]`
- 暂停粒子系统（CrossPodParticles、CrossFrameworkParticles）

### 8. 与 spec 2 侧边栏的集成

#### 侧边栏宽度传递

spec 2 在 Content Area 上设置了 CSS 变量 `--sidebar-width`。Scene3D 可通过以下方式获取：

**方案 A（推荐）：通过 prop 传递**

```tsx
// App.tsx 或 Home.tsx
const sidebarWidth = isMobile ? 0 : (sidebarCollapsed ? 64 : 240);

<Scene3D sidebarWidth={sidebarWidth} performanceProfile={sceneProfile} />
```

**方案 B：通过 CSS 变量读取**

```typescript
function useSidebarWidth(): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      const val = getComputedStyle(el).getPropertyValue('--sidebar-width');
      setWidth(parseInt(val, 10) || 0);
    });
    observer.observe(el, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, []);
  return width;
}
```

推荐方案 A，因为 prop 传递更直接、更可测试，且不依赖 DOM 查询。

## 数据模型

本次改动不涉及后端数据模型变更。

### 前端状态

| 状态 | 存储位置 | 说明 |
|------|----------|------|
| `sidebarWidth` | `App.tsx` 的 `useState` 或 prop 传递 | 当前侧边栏宽度（0 / 64 / 240） |
| `effectiveWidth` | `useContainerWidth` hook 派生 | Scene3D 容器的实际像素宽度 |
| `performanceProfile` | `Home.tsx` 或父组件派生 | 由 `useViewportResizeState()` 驱动 |
| `hidden` | 父组件控制 | 视图切换时是否隐藏场景 |

### 相机参数映射表

| 视口层级 | 侧边栏状态 | Effective Width (1280px 视口) | 基础 FOV | FOV 补偿 | 最终 FOV |
|----------|-----------|-------------------------------|----------|----------|----------|
| Desktop | 展开 240px | 1040px | 40° | +2.4° | 42.4° |
| Desktop | 折叠 64px | 1216px | 40° | 0° | 40° |
| Tablet | 折叠 64px | 960px (1024px 视口) | 43° | +3.6° | 46.6° |
| Tablet | 展开 240px | 784px (1024px 视口) | 43° | +6° | 49° |
| Mobile | 隐藏 0px | 375px | 46° | +6° | 52° |

> 注：移动端 FOV 补偿值已经在现有预设中体现（46° vs 40°），额外补偿主要影响 tablet 和 desktop 窄视口场景。

## 正确性属性

### Property 1: Canvas 宽度等于容器宽度

*对于任意*侧边栏状态（展开 / 折叠 / 隐藏），R3F Canvas 的渲染宽度应等于其父容器的 `clientWidth`，误差不超过 1px。

**验证: 需求 1.1, 1.2, 1.3, 1.4**

### Property 2: FOV 补偿单调性

*对于任意*两个 `effectiveWidth` 值 `w1 > w2`，`computeFovCompensation(w1) ≤ computeFovCompensation(w2)`。即视口越窄，FOV 补偿越大。

**验证: 需求 2.1, 2.2**

### Property 3: FOV 补偿有界

*对于任意* `effectiveWidth` 值，`computeFovCompensation(effectiveWidth)` 的返回值应在 `[0, 6]` 范围内。

**验证: 需求 2.3**

### Property 4: 过渡期间性能降级

*当* `useViewportResizeState()` 返回 `true` 时，Scene3D 的 `performanceProfile` 应为 `'resizing'`。*当*返回 `false` 时，应为 `'balanced'`。

**验证: 需求 3.2, 3.3**

### Property 5: WebGL 上下文存活

*当* Scene3D 从可见切换为隐藏（`hidden: true`）再切回可见（`hidden: false`）时，Canvas 的 WebGL 上下文应为同一个实例（不重新创建）。

**验证: 需求 4.1, 4.2, 4.3**

### Property 6: 场景层级正确

*对于任意*时刻，Scene3D 的 z-index 应低于 Content UI overlay 的 z-index，Content UI overlay 的 z-index 应低于 Launch Panel 的 z-index。

**验证: 需求 5.1, 5.3**

## 错误处理

1. **容器宽度为 0**：如果 `useContainerWidth` 返回 0（组件尚未挂载或容器不可见），使用 `window.innerWidth` 作为 fallback，确保相机参数计算不会产生除零错误。
2. **ResizeObserver 不可用**：在不支持 ResizeObserver 的环境中（极少数旧浏览器），回退到 `window.resize` 事件监听。R3F 内部已处理此兼容性。
3. **WebGL 上下文丢失**：监听 Canvas 的 `webglcontextlost` 事件，在上下文恢复后重新初始化场景。R3F 内部已处理此场景。
4. **CSS 变量未设置**：如果 `--sidebar-width` CSS 变量未被 spec 2 设置（spec 2 尚未实现），`sidebarWidth` prop 默认为 0，场景按全宽渲染，不影响现有功能。

## 测试策略

### 单元测试

- `computeFovCompensation()` 在各种 `effectiveWidth` 值下的返回值正确性
- `computeFovCompensation()` 的单调性和有界性（属性测试）
- `computeCameraXOffset()` 在各种 `sidebarWidth` 值下的返回值正确性
- `useContainerWidth` hook 在 ref 为 null 时回退到 `window.innerWidth`

### 组件测试

- Scene3D 在 `performanceProfile='resizing'` 时 DPR 降至 `[1, 1]`
- Scene3D 在 `hidden=true` 时不卸载 Canvas（DOM 中仍存在 canvas 元素）
- Scene3D 在 `sidebarWidth=240` 时相机 FOV 大于 `sidebarWidth=0` 时的 FOV

### 集成测试

- 在 1280px 视口 + 240px 侧边栏下，Scene3D 容器宽度为 1040px
- 侧边栏折叠/展开过渡期间 `performanceProfile` 正确切换
- Launch Panel 打开时 Scene3D 仍在渲染（canvas 元素存在且可见）
- 构建成功：`pnpm run build`

### 冒烟测试

- Scene3D 不使用 `window.innerWidth` 计算 Canvas 尺寸
- Scene3D 不在视图切换时卸载和重新挂载
- 现有 3D 场景子组件（OfficeRoom、PetWorkers 等）不受影响
