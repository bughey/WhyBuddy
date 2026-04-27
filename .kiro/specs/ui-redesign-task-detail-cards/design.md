# 设计文档：任务详情卡片化布局

## 概述

本设计文档描述如何将 `OfficeTaskCockpit` 的中央内容区从当前三栏驾驶舱布局改造为卡片化任务详情视图。当用户选中一个任务时，中央区域从 `Scene3D` 切换为垂直排列的卡片组：任务头部卡片、目标卡片、路线卡片、编队执行卡片、接管/证据卡片，底部固定指令输入栏。

**设计目标**：
- 中央区域在"3D 场景"和"卡片化任务详情"之间条件切换
- 每个区域（目标、路线、编队、接管）是独立的卡片组件，便于复用和测试
- 数据消费统一从 `tasks-store` 的 `selectedDetail` 和 `autopilotSummary` 读取
- 卡片视觉风格消费 spec 1 的冷灰设计令牌
- 在 spec 2 的侧边栏布局内正确工作
- 对历史任务和无 autopilot 数据的任务提供降级展示

**设计决策**：
1. **条件渲染而非路由切换**：中央区域的视图切换通过 `selectedTaskId` 状态驱动条件渲染，不引入新路由。Scene3D 在任务选中时通过 `display: none` 隐藏而非卸载，保持 WebGL 上下文。
2. **独立卡片组件**：每个区域（Header、Goal、Route、Fleet、Takeover）是独立的 React 组件，接收 props 而非直接读取 store，便于单元测试和复用。
3. **复用 TaskAutopilotPanel 的解析逻辑**：`TaskAutopilotPanel.tsx` 已包含大量 autopilot 数据解析函数（`parseDestination`、`parseRoute`、`parseFleet`、`parseTakeover` 等），新卡片组件应复用这些解析函数，不重复实现。
4. **降级策略**：当 `autopilotSummary` 不可用时，从 `selectedDetail` 的基础字段（`stages`、`departmentLabels`、`decision`、`decisionPresets`）构建降级数据。
5. **底部输入栏复用**：底部指令输入栏复用现有 `UnifiedLaunchComposer` 的精简模式，不新建输入组件。

## 架构

### 整体布局结构

```
┌──────────────────────────────────────────────────────────────┐
│  App.tsx (spec 2 侧边栏布局)                                  │
│  ┌──────────┬───────────────────────────────────────────┐    │
│  │          │              Content Area                  │    │
│  │ Sidebar  │  ┌─────────────────────────────────────┐  │    │
│  │ (spec 2) │  │        OfficeTaskCockpit             │  │    │
│  │          │  │  ┌───────┬───────────────────────┐   │  │    │
│  │          │  │  │ Queue │  Center Area           │   │  │    │
│  │          │  │  │ Rail  │  ┌─────────────────┐   │   │  │    │
│  │          │  │  │       │  │ 无选中: Scene3D  │   │   │  │    │
│  │          │  │  │       │  │ 有选中: Cards    │   │   │  │    │
│  │          │  │  │       │  │  ┌─ Header ────┐ │   │   │  │    │
│  │          │  │  │       │  │  ├─ Goal ──────┤ │   │   │  │    │
│  │          │  │  │       │  │  ├─ Route ─────┤ │   │   │  │    │
│  │          │  │  │       │  │  ├─ Fleet ─────┤ │   │   │  │    │
│  │          │  │  │       │  │  ├─ Takeover ──┤ │   │   │  │    │
│  │          │  │  │       │  │  └─────────────┘ │   │   │  │    │
│  │          │  │  │       │  │  [Command Bar]   │   │   │  │    │
│  │          │  │  │       │  └─────────────────┘   │   │  │    │
│  │          │  │  └───────┴───────────────────────┘   │  │    │
│  │          │  └─────────────────────────────────────┘  │    │
│  └──────────┴───────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 组件层级

```
OfficeTaskCockpit
├── TasksQueueRail (左侧，不变)
├── CenterArea (中央区域，条件渲染)
│   ├── Scene3D (无选中任务时显示)
│   └── TaskDetailCardsView (有选中任务时显示)
│       ├── TaskHeaderCard
│       ├── CardsScrollArea (可滚动区域)
│       │   ├── GoalCard
│       │   ├── RouteCard
│       │   ├── FleetCard
│       │   └── TakeoverCard
│       └── CommandInputBar (底部固定)
└── (右侧 TasksCockpitDetail 在本 spec 中保留，后续 spec 可能移除或精简)
```

### 数据流

```
tasks-store
  ├── selectedTaskId ──→ 驱动视图切换
  ├── selectedDetail ──→ 基础任务数据 (title, status, stages, decision...)
  ├── autopilotSummary ──→ 自动驾驶数据 (destination, route, fleet, takeover...)
  │
  ├──→ TaskHeaderCard (title, status, progress, estimatedDuration, priority)
  ├──→ GoalCard (destination.subGoals, destination.successCriteria)
  ├──→ RouteCard (route.stages, route.currentStageIndex)
  ├──→ FleetCard (fleet.roles)
  └──→ TakeoverCard (takeover, decision, decisionPresets)
```

## 组件与接口

### 1. TaskDetailCardsView（新建 `client/src/components/tasks/TaskDetailCardsView.tsx`）

容器组件，负责组装所有卡片和底部输入栏。

#### Props

```typescript
interface TaskDetailCardsViewProps {
  taskId: string;
  detail: TaskDetail;                    // 来自 tasks-store 的 selectedDetail
  autopilotSummary: MissionAutopilotSummary | null;  // 来自 tasks-store
  locale: string;
  onSubmitOperatorAction: (payload: {
    action: MissionOperatorActionType;
    reason?: string;
  }) => Promise<void>;
  onLaunchDecision: (presetId: string) => Promise<void>;
  onSetDecisionNote: (taskId: string, note: string) => void;
  decisionNote: string;
  operatorActionLoading: boolean;
}
```

#### 结构

```tsx
<div className="flex h-full flex-col">
  {/* 头部卡片 - 不滚动 */}
  <TaskHeaderCard ... />

  {/* 可滚动卡片区域 */}
  <div className="flex-1 overflow-y-auto space-y-3 px-4 py-3">
    <GoalCard ... />
    <RouteCard ... />
    <FleetCard ... />
    <TakeoverCard ... />
  </div>

  {/* 底部指令输入栏 - 不滚动 */}
  <CommandInputBar ... />
</div>
```

### 2. TaskHeaderCard（新建 `client/src/components/tasks/TaskHeaderCard.tsx`）

#### Props

```typescript
interface TaskHeaderCardProps {
  title: string;
  description: string | null;
  status: MissionTaskStatus;
  progress: number;                    // 0-100
  estimatedDuration: string | null;    // 如 "30min", "2h"
  priority: string | null;            // 如 "high", "medium", "low"
  driveState: TaskAutopilotDriveState | null;
  locale: string;
}
```

#### 渲染逻辑

- 标题使用 `font-display text-lg font-semibold`
- 描述使用 `text-sm text-muted-foreground line-clamp-2`
- 状态徽章：圆角 pill 形状，背景色根据状态映射：
  - `running` → `bg-emerald-100 text-emerald-700`
  - `waiting` → `bg-amber-100 text-amber-700`
  - `failed` → `bg-red-100 text-red-700`
  - `done` → `bg-slate-100 text-slate-600`
  - `cancelled` → `bg-slate-100 text-slate-500`
  - `queued` → `bg-sky-100 text-sky-700`
- 进度指示器：水平条形进度条，使用 `--primary` 色填充
- 预估时间和优先级以小标签形式展示在标题行右侧

### 3. GoalCard（新建 `client/src/components/tasks/GoalCard.tsx`）

#### Props

```typescript
interface GoalCardProps {
  title: string;                       // i18n: "目标" / "Goals"
  goals: Array<{
    label: string;
    status: "completed" | "in_progress" | "pending";
    progress?: number;                 // 0-100，可选
  }>;
  overallProgress: number;             // 0-100
  locale: string;
}
```

#### 数据映射

从 `autopilotSummary` 构建 `goals` 数组：
1. 优先使用 `destination.subGoals`（如果是数组且非空）
2. 其次使用 `destination.successCriteria`（如果是数组且非空）
3. 降级：使用 `selectedDetail.summary` 或 `selectedDetail.title` 构建单条目标

#### 渲染逻辑

- 每个目标项左侧显示状态图标：✓（已完成，绿色）、● 动画（进行中，蓝色）、○（未开始，灰色）
- 右侧显示进度百分比（如果有）
- 底部显示整体进度条

### 4. RouteCard（新建 `client/src/components/tasks/RouteCard.tsx`）

#### Props

```typescript
interface RouteStepItem {
  index: number;
  label: string;
  status: "completed" | "active" | "pending";
}

interface RouteCardProps {
  title: string;                       // i18n: "路线" / "Route"
  steps: RouteStepItem[];
  currentStepIndex: number;
  locale: string;
}
```

#### 数据映射

从 `autopilotSummary` 构建 `steps` 数组：
1. 优先使用 `route.stages`（如果是数组且非空），每个 stage 映射为一个 step
2. 降级：使用 `selectedDetail.stages`（mission 的十阶段），过滤出非空阶段

#### 渲染逻辑

- 水平步骤进度条：每个步骤是一个圆形编号节点，节点之间用连接线相连
- 已完成步骤：绿色背景 + 白色勾选图标，连接线为绿色实线
- 当前步骤：`--primary` 色边框 + 脉冲动画，连接线左侧绿色、右侧灰色
- 未开始步骤：灰色边框 + 灰色编号，连接线为灰色虚线
- 步骤名称显示在节点下方，使用 `text-xs`
- 当步骤数量 > 6 时，容器支持水平滚动

### 5. FleetCard（新建 `client/src/components/tasks/FleetCard.tsx`）

#### Props

```typescript
interface FleetMemberItem {
  id: string;
  role: string;                        // 角色名称，如 "Planner", "Executor"
  roleType: TaskAutopilotFleetRoleType;
  status: TaskAutopilotFleetRoleStatus;
  label: string;                       // 显示标签
}

interface FleetCardProps {
  title: string;                       // i18n: "编队执行" / "Fleet Execution"
  members: FleetMemberItem[];
  locale: string;
}
```

#### 数据映射

从 `autopilotSummary` 构建 `members` 数组：
1. 优先使用 `fleet.roles`（如果是数组且非空）
2. 降级：使用 `selectedDetail.departmentLabels` 构建简化角色列表

#### 渲染逻辑

- 每个成员以小卡片形式展示：圆形头像占位（使用角色类型对应的图标）+ 角色名称 + 状态指示点
- 状态指示点颜色：`active` → 绿色、`idle` → 灰色、`waiting` → 琥珀色、`error` → 红色
- 成员卡片水平排列，使用 `flex-wrap` 换行
- 每个成员卡片宽度约 80–100px，高度约 90–110px

### 6. TakeoverCard（新建 `client/src/components/tasks/TakeoverCard.tsx`）

#### Props

```typescript
interface TakeoverCardProps {
  title: string;                       // i18n: "接管/证据" / "Takeover/Evidence"
  hasPendingDecision: boolean;
  decisionPrompt: string | null;
  decisionPresets: Array<{ id: string; label: string }>;
  decisionNote: string;
  onSetDecisionNote: (note: string) => void;
  onLaunchDecision: (presetId: string) => Promise<void>;
  onSubmitOperatorAction: (payload: {
    action: MissionOperatorActionType;
    reason?: string;
  }) => Promise<void>;
  operatorActionLoading: boolean;
  takeoverSummary: string | null;      // 来自 autopilot takeover 解析
  locale: string;
}
```

#### 渲染逻辑

- 有待处理决策时：
  - 显示决策提示文本
  - 显示决策选项按钮（来自 `decisionPresets`）
  - 显示备注输入框
- 无待处理决策时：
  - 显示接管摘要（来自 autopilot takeover 解析）
  - 或显示"当前无需接管"空态提示
- 操作按钮使用 `--primary` 色作为主按钮样式

### 7. CommandInputBar（新建 `client/src/components/tasks/CommandInputBar.tsx`）

#### Props

```typescript
interface CommandInputBarProps {
  taskId: string;
  locale: string;
}
```

#### 渲染逻辑

- 固定在卡片视图底部，高度约 48–56px
- 包含文本输入框和发送按钮
- 复用 `UnifiedLaunchComposer` 的精简模式或直接使用简化的输入组件
- 输入框 placeholder：`t(locale, "输入任务指令...", "Enter task command...")`

### 8. OfficeTaskCockpit 改造

#### 中央区域条件渲染

在 `OfficeTaskCockpit.tsx` 中，将当前中央区域的 `Scene3D` 替换为条件渲染：

```tsx
{/* 中央区域 */}
<div className="relative flex-1 min-w-0 min-h-0">
  {/* Scene3D - 无选中任务时显示 */}
  <div style={{ display: activeTaskId ? 'none' : 'block' }}
       className="absolute inset-0">
    <Scene3D ... />
  </div>

  {/* 卡片化任务详情 - 有选中任务时显示 */}
  {activeTaskId && selectedDetail && (
    <TaskDetailCardsView
      taskId={activeTaskId}
      detail={selectedDetail}
      autopilotSummary={autopilotSummary}
      locale={locale}
      onSubmitOperatorAction={handleSubmitOperatorAction}
      onLaunchDecision={handleLaunchDecision}
      onSetDecisionNote={setDecisionNote}
      decisionNote={decisionNote}
      operatorActionLoading={operatorActionLoadingByMissionId[activeTaskId] ?? false}
    />
  )}
</div>
```

#### autopilotSummary 获取

从 `tasks-store` 获取当前选中任务的 autopilot summary：

```typescript
const autopilotSummary = useTasksStore(state => {
  if (!activeTaskId) return null;
  const detail = state.detailsById[activeTaskId];
  return detail?.autopilotSummary ?? null;
});
```

## 数据模型

本次改动不涉及后端数据模型变更。所有数据消费来自现有的 `tasks-store`。

### 前端状态依赖

| 数据 | 来源 | 说明 |
|------|------|------|
| `selectedTaskId` | `tasks-store` | 驱动视图切换 |
| `selectedDetail` | `tasks-store.detailsById[id]` | 任务详情基础数据 |
| `autopilotSummary` | `selectedDetail.autopilotSummary` | 自动驾驶投影数据 |
| `decisionNote` | `tasks-store.decisionNotes[id]` | 决策备注 |
| `operatorActionLoading` | `tasks-store.operatorActionLoadingByMissionId[id]` | 操作加载状态 |

### 卡片数据降级策略

| 卡片 | 主数据源 (autopilotSummary) | 降级数据源 (selectedDetail) |
|------|---------------------------|---------------------------|
| TaskHeaderCard | `destination.goal`, `driveState`, `route.estimatedDuration` | `title`, `status`, `progress`, `summary` |
| GoalCard | `destination.subGoals`, `destination.successCriteria` | `summary`, `title` |
| RouteCard | `route.stages` | `stages` (mission 十阶段) |
| FleetCard | `fleet.roles` | `departmentLabels` |
| TakeoverCard | `takeover` | `decision`, `decisionPresets`, `decisionPrompt` |

### i18n 扩展

需要在 `client/src/i18n/` 的中英文资源中新增卡片标签：

```typescript
taskDetailCards: {
  goals: "目标",
  route: "路线",
  fleetExecution: "编队执行",
  takeoverEvidence: "接管/证据",
  noTakeoverNeeded: "当前无需接管",
  enterCommand: "输入任务指令...",
  estimatedTime: "预估时间",
  priority: "优先级",
  progress: "进度",
  stepCompleted: "已完成",
  stepActive: "进行中",
  stepPending: "未开始",
  noGoalsAvailable: "暂无目标数据",
  noRouteAvailable: "暂无路线数据",
  noFleetAvailable: "暂无编队数据",
  retryLoad: "重试加载",
  loadError: "数据加载失败",
}
```

## 正确性属性

### Property 1: 视图切换互斥

*对于任意*时刻，Scene3D 和 TaskDetailCardsView 不应同时可见。当 `selectedTaskId` 非空且 `selectedDetail` 存在时仅显示 TaskDetailCardsView，否则仅显示 Scene3D。

**验证: 需求 1.1, 1.2, 1.3**

### Property 2: 卡片数据源一致性

*对于任意*选中的任务，TaskHeaderCard 展示的 `title` 和 `status` 应与 `tasks-store` 中 `detailsById[selectedTaskId]` 的对应字段完全一致。

**验证: 需求 2.1, 2.3, 2.7**

### Property 3: 路线步骤状态单调性

*对于* RouteCard 中的步骤列表，已完成步骤应连续排列在列表前部，当前步骤最多一个，未开始步骤应连续排列在列表后部。不应出现"已完成 → 未开始 → 已完成"的交叉状态。

**验证: 需求 4.4, 4.5**

### Property 4: 降级数据完整性

*对于任意* `autopilotSummary` 为 null 的任务，所有五个卡片组件应仍然渲染（不崩溃），且至少展示来自 `selectedDetail` 的降级内容或空态提示。

**验证: 需求 9.1, 9.2**

### Property 5: 设计令牌消费

*对于* TaskDetailCardsView 中的所有卡片元素，其 `background-color` 应消费 `var(--card)` 或 `var(--background)`，`border-color` 应消费 `var(--border)`，`border-radius` 应消费 `var(--radius)` 或其派生值。不应包含硬编码的暖色 rgba 值。

**验证: 需求 8.1, 8.2, 8.3**

### Property 6: Scene3D 上下文保持

*当* TaskDetailCardsView 渲染时，Scene3D 的 DOM 元素应仍然存在于文档中（`display: none`），其 WebGL 上下文不应被销毁。切换回 Scene3D 时不应触发 Three.js 的重新初始化。

**验证: 需求 10.5**

### Property 7: 操作按钮幂等性

*对于* TakeoverCard 中的决策按钮，在操作加载中（`operatorActionLoading === true`）时，所有操作按钮应处于 disabled 状态，防止重复提交。

**验证: 需求 6.6**

## 错误处理

1. **autopilotSummary 解析异常**：如果 `autopilotSummary` 中的某个字段格式异常，对应卡片应 catch 异常并展示降级内容，不影响其他卡片。
2. **任务详情加载失败**：如果 `selectedDetail` 为 null 且 `error` 非空，展示错误提示卡片和重试按钮。
3. **操作提交失败**：TakeoverCard 中的操作按钮提交失败时，通过 `toast.error` 提示用户，按钮恢复可点击状态。
4. **i18n 键缺失**：如果某个 i18n 键缺失，使用英文 fallback 文本。

## 测试策略

### 单元测试

- `TaskHeaderCard`：验证不同 status 值对应正确的徽章颜色类名
- `GoalCard`：验证 goals 数组为空时展示空态提示
- `RouteCard`：验证步骤状态的单调性（Property 3）
- `FleetCard`：验证 members 数组为空时展示空态提示
- `TakeoverCard`：验证 `hasPendingDecision` 为 false 时展示空态提示
- `TakeoverCard`：验证 `operatorActionLoading` 为 true 时按钮 disabled

### 组件测试

- `TaskDetailCardsView`：验证传入完整 autopilotSummary 时所有卡片正确渲染
- `TaskDetailCardsView`：验证传入 null autopilotSummary 时所有卡片使用降级数据渲染
- `TaskDetailCardsView`：验证传入空 detail 时展示错误提示

### 集成测试

- `OfficeTaskCockpit`：验证选中任务时中央区域切换为 TaskDetailCardsView
- `OfficeTaskCockpit`：验证取消选中时中央区域切换回 Scene3D
- `OfficeTaskCockpit`：验证 Scene3D 在任务选中时仍存在于 DOM 中（`display: none`）

### 构建验证

- 运行 `pnpm run build` 验证构建成功
- 运行 `node --run check` 验证不引入新的 TypeScript 错误
