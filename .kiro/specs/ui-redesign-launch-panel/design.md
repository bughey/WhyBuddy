# 设计文档：任务发起浮层面板

## 概述

本设计文档描述如何将当前底部固定的 `UnifiedLaunchComposer` 输入栏改造为居中浮层面板（Floating Panel Overlay），实现"任务自动驾驶 Autopilot Control"的完整发起体验。

**设计目标**：
- 将任务发起入口从底部固定栏升级为居中浮层面板，提供更丰富的任务配置空间
- 保留快速模式的简洁输入体验，同时为高级模式提供完整的规划、能力和交付配置
- 复用现有 `submitUnifiedLaunch()`、`buildLaunchRoutePlan()`、`useNLCommandStore` 等核心逻辑
- 消费 spec 1 的冷灰 SaaS 设计令牌
- 在 spec 2 的侧边栏布局内正确渲染

**设计决策**：
1. **浮层而非页面路由**：面板以 Portal 方式渲染到 `document.body`，不占用路由位置，打开/关闭不影响 URL。
2. **模式映射到现有路线**：五个模式选项卡（快速/标准/深度/研究/自定义）映射到现有 `LaunchRouteCandidateId`，不新增后端概念。
3. **渐进式展示**：快速模式仅展示输入框和启动按钮；高级模式逐步展开规划流程、能力驾驶舱和输出配置。
4. **组件拆分策略**：面板拆分为 Shell（壳层）+ 内容区块组件，每个区块独立管理自身数据和渲染。
5. **移动端降级为 Bottom Sheet**：移动端使用全屏底部抽屉替代居中浮层，保持核心输入和操作可用。

## 架构

### 组件层级

```
LaunchPanelPortal (Portal to document.body)
├── LaunchPanelBackdrop (半透明遮罩)
└── LaunchPanelShell (面板壳层, role="dialog")
    ├── LaunchPanelHeader (标题 + 关闭按钮)
    ├── LaunchModeTabBar (模式选项卡)
    ├── LaunchPanelBody (可滚动内容区)
    │   ├── LaunchGoalInput (目标输入区)
    │   ├── LaunchRoutePlanningFlow (自主规划路径, 仅高级模式)
    │   ├── LaunchCockpitGrid (能力驾驶舱, 仅高级模式)
    │   └── LaunchOutputChips (输出与交付, 仅高级模式)
    └── LaunchPanelActionBar (底部操作栏, 固定)
```

### 数据流

```
用户点击 Trigger_Button
  → LaunchPanelShell 打开 (open state)
  → useNLCommandStore.draftText 双向绑定到 LaunchGoalInput
  → buildLaunchRoutePlan() 根据 draftText + mode 计算路线
  → 用户点击"启动任务"
  → submitUnifiedLaunch() 调用现有 API
  → onTaskResolved / onWorkflowResolved 回调
  → LaunchPanelShell 关闭
```

### 与现有组件的关系

```
App.tsx
├── AppSidebar (spec 2)
│   └── Trigger_Button ("+ 新建任务")
├── Content_Area
│   ├── Router (Home / Tasks / Debug ...)
│   └── OfficeTaskCockpit
│       └── UnifiedLaunchComposer (现有, 将被替换为 Trigger_Button)
└── LaunchPanelPortal (新增, Portal 到 body)
    └── LaunchPanelShell
```

## 组件与接口

### 1. LaunchPanelShell（新建 `client/src/components/launch/LaunchPanelShell.tsx`）

#### Props

```typescript
interface LaunchPanelShellProps {
  open: boolean;
  onClose: () => void;
  createMission: TaskHubCreateMission;
  onTaskResolved?: (result: TaskHubCommandSubmissionResult) => void;
  onWorkflowResolved?: (result: UnifiedWorkflowResolution) => void;
}
```

#### 结构

```tsx
<LaunchPanelPortal>
  {/* 遮罩层 */}
  <div
    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
    onClick={onClose}
    aria-hidden="true"
  />

  {/* 面板主体 */}
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="launch-panel-title"
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-[720px] max-h-[85vh] flex flex-col rounded-xl border shadow-lg"
      style={{
        backgroundColor: 'var(--card)',
        color: 'var(--card-foreground)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius-xl, 1rem)',
        boxShadow: '0 22px 56px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.48)',
      }}
    >
      <LaunchPanelHeader onClose={onClose} />
      <LaunchModeTabBar mode={mode} onModeChange={setMode} />
      <LaunchPanelBody mode={mode} />
      <LaunchPanelActionBar
        mode={mode}
        onSubmit={handleSubmit}
        submitting={submitting}
        disabled={!hasDraftDestination}
      />
    </motion.div>
  </div>
</LaunchPanelPortal>
```

#### 焦点管理

- 打开时：焦点移动到 `LaunchGoalInput` 的 textarea
- 关闭时：焦点恢复到触发按钮
- Tab 键：在面板内部循环（焦点陷阱）
- Escape 键：关闭面板

### 2. LaunchModeTabBar（新建 `client/src/components/launch/LaunchModeTabBar.tsx`）

#### 模式定义

```typescript
type LaunchMode = 'quick' | 'standard' | 'deep' | 'research' | 'custom';

interface LaunchModeConfig {
  id: LaunchMode;
  labelZh: string;
  labelEn: string;
  icon: LucideIcon;
  routeMapping: LaunchRouteCandidateId | null; // 映射到现有路线
  showAdvancedSections: boolean;
}

const LAUNCH_MODES: LaunchModeConfig[] = [
  { id: 'quick',    labelZh: '快速模式', labelEn: 'Quick',    icon: Zap,       routeMapping: 'quick',    showAdvancedSections: false },
  { id: 'standard', labelZh: '标准模式', labelEn: 'Standard', icon: Target,    routeMapping: 'standard', showAdvancedSections: true },
  { id: 'deep',     labelZh: '深度模式', labelEn: 'Deep',     icon: Layers,    routeMapping: 'deep',     showAdvancedSections: true },
  { id: 'research', labelZh: '研究模式', labelEn: 'Research', icon: Search,    routeMapping: 'research', showAdvancedSections: true },
  { id: 'custom',   labelZh: '自定义模式', labelEn: 'Custom', icon: Settings2, routeMapping: null,       showAdvancedSections: true },
];
```

#### 渲染

```tsx
<div role="tablist" aria-label="任务模式" className="flex gap-1 px-4 py-2 border-b"
     style={{ borderColor: 'var(--border)' }}>
  {LAUNCH_MODES.map(mode => (
    <button
      key={mode.id}
      role="tab"
      aria-selected={mode.id === currentMode}
      onClick={() => onModeChange(mode.id)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
      style={{
        backgroundColor: mode.id === currentMode ? 'var(--primary)' : 'var(--muted)',
        color: mode.id === currentMode ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
      }}
    >
      <mode.icon size={14} />
      {t(locale, mode.labelZh, mode.labelEn)}
    </button>
  ))}
</div>
```

### 3. LaunchGoalInput（新建 `client/src/components/launch/LaunchGoalInput.tsx`）

#### Props

```typescript
interface LaunchGoalInputProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number; // 默认 2000
  autoFocus?: boolean;
}
```

#### 结构

```tsx
<div className="px-4 py-3">
  <label id="launch-goal-label" className="text-sm font-medium mb-2 block"
         style={{ color: 'var(--card-foreground)' }}>
    {t(locale, '输入你的目标', 'Enter your goal')}
  </label>
  <div className="relative">
    <textarea
      ref={textareaRef}
      value={value}
      onChange={e => onChange(e.target.value.slice(0, maxLength))}
      placeholder={t(locale, '描述你想要完成的任务目标...', 'Describe the task goal you want to accomplish...')}
      className="w-full min-h-[80px] max-h-[200px] resize-none rounded-lg border p-3 text-sm"
      style={{
        borderColor: 'var(--input)',
        backgroundColor: 'var(--background)',
      }}
      aria-labelledby="launch-goal-label"
      autoFocus={autoFocus}
    />
    <span className="absolute bottom-2 right-3 text-xs"
          style={{ color: 'var(--muted-foreground)' }}>
      {value.length} / {maxLength}
    </span>
  </div>
</div>
```

### 4. LaunchRoutePlanningFlow（新建 `client/src/components/launch/LaunchRoutePlanningFlow.tsx`）

#### 步骤定义

```typescript
interface RoutePlanStep {
  id: string;
  labelZh: string;
  labelEn: string;
  icon: LucideIcon;
  status: 'pending' | 'active' | 'completed';
}

const ROUTE_PLAN_STEPS: RoutePlanStep[] = [
  { id: 'destination', labelZh: '目的地',   labelEn: 'Destination',  icon: MapPin,     status: 'pending' },
  { id: 'planning',    labelZh: '路线规划', labelEn: 'Route Plan',   icon: Route,      status: 'pending' },
  { id: 'execution',   labelZh: '执行步骤', labelEn: 'Execution',    icon: Play,       status: 'pending' },
  { id: 'validation',  labelZh: '校验/证据', labelEn: 'Validation',  icon: ShieldCheck, status: 'pending' },
];
```

#### 渲染

水平流程图，每个步骤为圆形图标 + 标签，步骤之间用连接线串联。根据 `buildLaunchRoutePlan()` 的结果和用户输入状态更新步骤 status：
- 用户输入了目标文本 → `destination` 变为 `completed`
- 路线规划完成 → `planning` 变为 `active`
- 其余步骤保持 `pending`

### 5. LaunchCockpitGrid（新建 `client/src/components/launch/LaunchCockpitGrid.tsx`）

#### 工具卡片定义

```typescript
interface CockpitTool {
  id: string;
  labelZh: string;
  labelEn: string;
  icon: LucideIcon;
  requiresAdvancedRuntime: boolean;
}

const COCKPIT_TOOLS: CockpitTool[] = [
  { id: 'browser',   labelZh: '浏览器能力', labelEn: 'Browser',       icon: Globe,       requiresAdvancedRuntime: true },
  { id: 'executor',  labelZh: '代码执行器', labelEn: 'Code Executor', icon: Terminal,     requiresAdvancedRuntime: true },
  { id: 'filesystem', labelZh: '文件系统',  labelEn: 'File System',   icon: FolderOpen,   requiresAdvancedRuntime: true },
  { id: 'knowledge', labelZh: '知识检索',   labelEn: 'Knowledge',     icon: BookOpen,     requiresAdvancedRuntime: false },
  { id: 'web',       labelZh: '网络搜索',   labelEn: 'Web Search',    icon: Search,       requiresAdvancedRuntime: false },
  { id: 'vision',    labelZh: '视觉理解',   labelEn: 'Vision',        icon: Eye,          requiresAdvancedRuntime: false },
];
```

#### 渲染

2×3 或 3×2 网格布局，每个卡片为小型卡片（图标 + 名称）。当 `runtimeMode !== 'advanced'` 时，`requiresAdvancedRuntime: true` 的卡片显示为禁用状态（`opacity: 0.5`）。

### 6. LaunchOutputChips（新建 `client/src/components/launch/LaunchOutputChips.tsx`）

#### 输出类型定义

```typescript
interface OutputType {
  id: string;
  labelZh: string;
  labelEn: string;
  defaultSelected: boolean;
}

const OUTPUT_TYPES: OutputType[] = [
  { id: 'summary',    labelZh: '结果摘要',   labelEn: 'Summary',     defaultSelected: true },
  { id: 'files',      labelZh: '生成文件',   labelEn: 'Files',       defaultSelected: true },
  { id: 'logs',       labelZh: '执行日志',   labelEn: 'Exec Logs',   defaultSelected: false },
  { id: 'screenshots', labelZh: '证据截图',  labelEn: 'Screenshots', defaultSelected: false },
  { id: 'records',    labelZh: '操作记录',   labelEn: 'Records',     defaultSelected: false },
];
```

#### 渲染

水平排列的可切换标签，选中状态使用 `--primary` 背景 + `--primary-foreground` 文字，未选中使用 `--muted` 背景 + `--muted-foreground` 文字。

### 7. LaunchPanelActionBar（新建 `client/src/components/launch/LaunchPanelActionBar.tsx`）

#### Props

```typescript
interface LaunchPanelActionBarProps {
  mode: LaunchMode;
  onSubmit: () => void;
  onAddAttachment: () => void;
  submitting: boolean;
  disabled: boolean;
  attachmentCount: number;
}
```

#### 渲染

```tsx
<div className="flex items-center justify-between px-4 py-3 border-t"
     style={{ borderColor: 'var(--border)' }}>
  <div className="flex items-center gap-2">
    <button onClick={onAddAttachment} className="flex items-center gap-1 text-sm">
      <Paperclip size={14} />
      {t(locale, '添加附件', 'Add Attachment')}
      {attachmentCount > 0 && <span className="text-xs">({attachmentCount})</span>}
    </button>
    <button className="flex items-center gap-1 text-sm">
      <Settings size={14} />
      {t(locale, '高级设置', 'Advanced Settings')}
    </button>
    <button className="flex items-center gap-1 text-sm">
      <Save size={14} />
      {t(locale, '保存为模板', 'Save as Template')}
    </button>
  </div>
  <button
    onClick={onSubmit}
    disabled={disabled || submitting}
    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
    style={{
      backgroundColor: disabled ? 'var(--muted)' : 'var(--primary)',
      color: disabled ? 'var(--muted-foreground)' : 'var(--primary-foreground)',
    }}
  >
    {submitting
      ? t(locale, '提交中...', 'Submitting...')
      : t(locale, '启动任务', 'Launch Task')}
  </button>
</div>
```

### 8. 触发入口集成

#### 侧边栏触发按钮

在 `AppSidebar`（spec 2）的导航列表上方或下方新增一个"+ 新建任务"按钮：

```tsx
<button
  onClick={() => setLaunchPanelOpen(true)}
  className="mx-3 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
  style={{
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-foreground)',
  }}
>
  <Plus size={16} />
  {!collapsed && t(locale, '新建任务', 'New Task')}
</button>
```

#### 面板状态管理

面板的 open/close 状态通过 `useState` 在 `App.tsx` 或 `OfficeTaskCockpit.tsx` 中管理：

```typescript
const [launchPanelOpen, setLaunchPanelOpen] = useState(false);
```

#### 替换现有 UnifiedLaunchComposer

在 `OfficeTaskCockpit.tsx` 中，将底部固定的 `<UnifiedLaunchComposer />` 替换为触发按钮。当用户点击触发按钮时打开 `LaunchPanelShell`。

### 9. 响应式适配

| 视口 | 面板形态 | 最大宽度 | 高级区域 |
|------|----------|----------|----------|
| Desktop ≥ 1280px | 居中浮层 | 720px | 全部展示 |
| Tablet 768–1279px | 居中浮层 | 90vw | 全部展示 |
| Mobile ≤ 767px | 底部抽屉 | 100vw | 隐藏 Cockpit + Output |

移动端底部抽屉使用 `position: fixed; bottom: 0; left: 0; right: 0;` 布局，从底部滑入，最大高度 90vh。

## 数据模型

本次改动不涉及后端数据模型变更。

### 前端状态

| 状态 | 存储位置 | 说明 |
|------|----------|------|
| `launchPanelOpen` | `App.tsx` 或 `OfficeTaskCockpit.tsx` 的 `useState` | 面板打开/关闭状态 |
| `launchMode` | `LaunchPanelShell` 的 `useState` | 当前选中的模式选项卡 |
| `draftText` | `useNLCommandStore` | 目标输入文本（复用现有） |
| `attachments` | `LaunchPanelShell` 的 `useState` | 附件列表（复用现有逻辑） |
| `selectedOutputTypes` | `LaunchPanelShell` 的 `useState` | 选中的输出类型 ID 集合 |
| `routePlan` | 由 `buildLaunchRoutePlan()` 派生 | 路线规划结果（复用现有） |

### i18n 扩展

需要在 `client/src/i18n/` 的中英文资源中新增：

```typescript
launchPanel: {
  title: "任务自动驾驶",
  subtitle: "Autopilot Control",
  goalInputLabel: "输入你的目标",
  goalInputPlaceholder: "描述你想要完成的任务目标...",
  routePlanningTitle: "自主规划路径",
  cockpitTitle: "能力驾驶舱 COCKPIT",
  outputTitle: "输出与交付",
  addAttachment: "添加附件",
  advancedSettings: "高级设置",
  saveAsTemplate: "保存为模板",
  launchTask: "启动任务",
  submitting: "提交中...",
  modeQuick: "快速模式",
  modeStandard: "标准模式",
  modeDeep: "深度模式",
  modeResearch: "研究模式",
  modeCustom: "自定义模式",
  newTask: "新建任务",
}
```

## 正确性属性

### Property 1: 面板与遮罩互斥渲染

*对于任意*时刻，`LaunchPanelShell` 和 `LaunchPanelBackdrop` 要么同时渲染，要么同时不渲染。不应出现遮罩存在但面板不存在、或面板存在但遮罩不存在的状态。

**验证: 需求 1.1, 1.2, 1.3**

### Property 2: 快速模式区域隐藏

*当* `launchMode === 'quick'` 时，`LaunchRoutePlanningFlow`、`LaunchCockpitGrid` 和 `LaunchOutputChips` 不应出现在渲染树中。

**验证: 需求 2.3, 4.5, 5.5, 6.4**

### Property 3: 高级模式区域完整

*当* `launchMode` 为 `'standard' | 'deep' | 'research' | 'custom'` 之一时，`LaunchRoutePlanningFlow`、`LaunchCockpitGrid` 和 `LaunchOutputChips` 应全部出现在渲染树中。

**验证: 需求 2.4**

### Property 4: 提交按钮状态一致性

*对于任意*时刻，"启动任务"按钮的 `disabled` 属性应等于 `draftText.trim().length === 0 || submitting === true`。

**验证: 需求 7.6, 7.7**

### Property 5: 字符计数准确性

*对于任意* `draftText` 值，字符计数显示应等于 `draftText.length`，且 `draftText.length` 不应超过 `maxLength`（2000）。

**验证: 需求 3.3, 3.4**

### Property 6: 模式选项卡唯一选中

*对于任意*时刻，`LaunchModeTabBar` 中恰好有一个选项卡的 `aria-selected` 为 `"true"`。

**验证: 需求 2.1, 2.2**

### Property 7: 面板关闭后状态清理

*当* `LaunchPanelShell` 从 `open=true` 变为 `open=false` 时，面板不应阻止底层页面的交互（遮罩和面板均从 DOM 中移除或设为不可见）。

**验证: 需求 1.4**

### Property 8: 无障碍语义完整

*对于* `LaunchPanelShell`，其根元素应设置 `role="dialog"` 和 `aria-modal="true"`。`LaunchModeTabBar` 应设置 `role="tablist"`，每个选项卡应设置 `role="tab"`。

**验证: 需求 11.1, 11.6**

## 错误处理

1. **任务提交失败**：`submitUnifiedLaunch()` 抛出异常时，面板不关闭，在 `LaunchPanelActionBar` 上方展示错误提示（使用 `toast.error()`），"启动任务"按钮恢复可点击状态。
2. **附件上传失败**：复用现有 `LaunchAttachmentSection` 的错误处理逻辑，在附件区域展示错误提示。
3. **路线规划异常**：`buildLaunchRoutePlan()` 返回异常结果时，`LaunchRoutePlanningFlow` 展示所有步骤为 `pending` 状态，不阻断用户提交。
4. **Portal 挂载失败**：如果 `document.body` 不可用（SSR 场景），面板降级为内联渲染。

## 测试策略

### 单元测试

- `LAUNCH_MODES` 数组完整性（5 个模式、ID 唯一、图标非空）
- `COCKPIT_TOOLS` 数组完整性
- `OUTPUT_TYPES` 数组完整性
- 模式到路线映射的正确性
- 字符计数逻辑（边界值：0、1、1999、2000、2001）

### 组件测试

- `LaunchPanelShell` 在 `open=true` 时渲染面板和遮罩
- `LaunchPanelShell` 在 `open=false` 时不渲染
- `LaunchModeTabBar` 默认选中"快速模式"
- 切换到"标准模式"后高级区域出现
- 点击遮罩触发 `onClose`
- 按 Escape 键触发 `onClose`
- 目标输入为空时"启动任务"按钮禁用
- 输入文本后"启动任务"按钮启用
- 提交中"启动任务"按钮显示 loading 状态
- 焦点陷阱：Tab 键不逃逸面板

### 集成测试

- 点击侧边栏"+ 新建任务"按钮打开面板
- 在面板中输入目标并点击"启动任务"，验证 `submitUnifiedLaunch()` 被调用
- 任务创建成功后面板自动关闭
- 构建成功：`pnpm run build`

### 冒烟测试

- 面板不引入新的后端 API 调用
- 面板不修改 `tasks-store` 的数据结构
- 面板在桌面、平板、移动端三种视口下均可打开和关闭
