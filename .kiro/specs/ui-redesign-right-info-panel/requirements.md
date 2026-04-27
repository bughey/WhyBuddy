# 需求文档

## 简介

本规格是 UI 改造项目（共 8 个 spec）的第 4 个，依赖 spec 1（`ui-redesign-color-and-tokens`）的冷灰 SaaS 色板与设计令牌体系，以及 spec 3（`ui-redesign-task-detail-cards`）的卡片化任务详情视图。目标是将当前右侧面板从 tab 切换布局（任务 / 团队流 / Agent / 记忆报告 / 历史）改造为结构化信息面板，匹配参考设计中的三段式布局：

- **任务概览**区域：创建时间、预估完成、已用时间、创建者、标签
- **实时进展**区域：整体进度百分比、子指标（内容产出、渠道覆盖、合作触达、数据回收）
- **近期动态**区域：带时间戳和彩色圆点的活动时间线

当前状态：
- `TasksCockpitDetail.tsx`：右侧面板，包含 InsightCard、DashboardMetric、ProgressiveItem 等组件，以 Accordion 折叠方式展示深层详情
- `OfficeWorkflowContextPanels.tsx`：workflow flow、history、agent inspector、memory reports 面板
- `tasks-store.ts`：已具备 `MissionTaskDetail`（含 createdAt、updatedAt、startedAt、stages、agents、timeline、autopilotSummary 等字段）和 `TaskAutopilotSummary`（含 destination、route、fleet、driveState、takeover、evidence 等字段）

## 术语表

- **Right_Info_Panel**：右侧信息面板，宽度 300–360px，替代当前 tab 切换布局，采用三段式垂直结构
- **Task_Overview_Section**：任务概览区域，展示任务元信息（创建时间、预估完成、已用时间、创建者、标签）
- **Live_Progress_Section**：实时进展区域，展示整体进度百分比和子维度指标
- **Recent_Activity_Section**：近期动态区域，展示带时间戳和彩色状态圆点的活动时间线
- **Progress_Ring**：环形进度指示器，用于展示整体进度百分比
- **Sub_Metric**：子维度指标项，展示某个维度的名称和完成百分比
- **Activity_Timeline_Item**：活动时间线条目，包含时间戳、彩色状态圆点和事件描述
- **Content_Area**：侧边栏右侧的主内容区域，承载路由页面
- **Autopilot_Summary**：`tasks-store` 中的 `TaskAutopilotSummary` 数据结构

## 需求

### 需求 1：右侧面板布局重构

**用户故事：** 作为桌面端用户，我希望右侧面板从 tab 切换布局改为三段式垂直信息面板，以便我能在一个连续滚动视图中看到任务概览、实时进展和近期动态。

#### 验收标准

1. THE Right_Info_Panel SHALL 替代当前 `TasksCockpitDetail` 中的 tab 切换布局，采用三段式垂直结构（Task_Overview_Section → Live_Progress_Section → Recent_Activity_Section）
2. THE Right_Info_Panel SHALL 保持宽度在 300–360px 范围内，通过 CSS `min-width: 300px` 和 `max-width: 360px` 约束
3. THE Right_Info_Panel SHALL 支持独立于中央内容区的垂直滚动，使用 `overflow-y: auto` 和 `scrollbar-gutter: stable`
4. THE Right_Info_Panel SHALL 在 spec 2 定义的侧边栏布局内正确渲染，不与左侧导航栏重叠
5. THE Right_Info_Panel SHALL 在没有选中任务时展示空态提示（如"选择一个任务查看详情"）
6. WHEN 用户切换选中任务时，THE Right_Info_Panel SHALL 在 200ms 内更新为新任务的数据

### 需求 2：任务概览区域

**用户故事：** 作为用户，我希望在右侧面板顶部看到任务的核心元信息，以便我能快速了解任务的基本情况。

#### 验收标准

1. THE Task_Overview_Section SHALL 展示标题"任务概览"（中文）或"Task Overview"（英文），使用 i18n 键
2. THE Task_Overview_Section SHALL 展示创建时间，从 `MissionTaskDetail.createdAt` 读取，格式化为相对时间或绝对日期
3. THE Task_Overview_Section SHALL 展示预估完成时间，优先从 `Autopilot_Summary.route.estimatedDuration` 读取，降级为"未知"
4. THE Task_Overview_Section SHALL 展示已用时间，根据 `createdAt` 和当前时间计算，格式化为"Xh Ym"或"Xd Yh"
5. THE Task_Overview_Section SHALL 展示创建者信息，从 `MissionTaskDetail.kind` 或 `Autopilot_Summary.destination.taskType` 读取
6. THE Task_Overview_Section SHALL 展示标签列表，从 `MissionTaskDetail.departmentLabels` 读取，以水平排列的标签胶囊形式展示
7. WHEN 某个字段数据不可用时，THE Task_Overview_Section SHALL 展示占位文本（如"—"），不留空白

### 需求 3：实时进展区域

**用户故事：** 作为用户，我希望在右侧面板中部看到任务的整体进度和各维度子指标，以便我能直观了解任务的推进情况。

#### 验收标准

1. THE Live_Progress_Section SHALL 展示标题"实时进展"（中文）或"Live Progress"（英文），使用 i18n 键
2. THE Live_Progress_Section SHALL 展示整体进度百分比，使用 Progress_Ring 环形指示器，从 `MissionTaskDetail.progress` 读取（0–100）
3. THE Progress_Ring SHALL 使用 SVG 圆环实现，stroke 颜色消费 `--primary` 令牌，背景轨道消费 `--muted` 令牌
4. THE Live_Progress_Section SHALL 展示 2–4 个 Sub_Metric 子维度指标，以两列网格布局排列
5. THE Live_Progress_Section SHALL 从以下数据源构建子指标：优先从 `Autopilot_Summary.route.stages` 的各阶段完成度派生，降级从 `MissionTaskDetail.stages` 的 `progress` 字段派生
6. WHEN 子指标数据不可用时，THE Live_Progress_Section SHALL 展示基于 `completedTaskCount / taskCount` 的单一进度指标作为降级
7. THE Sub_Metric SHALL 展示维度名称和百分比数值，百分比使用 `--font-mono` 字体

### 需求 4：近期动态区域

**用户故事：** 作为用户，我希望在右侧面板底部看到任务的近期活动时间线，以便我能了解最近发生了什么。

#### 验收标准

1. THE Recent_Activity_Section SHALL 展示标题"近期动态"（中文）或"Recent Activity"（英文），使用 i18n 键
2. THE Recent_Activity_Section SHALL 从 `MissionTaskDetail.timeline` 读取事件列表，按时间倒序排列，展示最近 10 条
3. THE Activity_Timeline_Item SHALL 展示时间戳（相对时间格式，如"3分钟前"）、彩色状态圆点和事件描述
4. THE Activity_Timeline_Item SHALL 根据事件 `level` 映射圆点颜色：info=蓝色、success=绿色（`--primary`）、warning=琥珀色、error=红色（`--destructive`）、default=灰色
5. THE Recent_Activity_Section SHALL 在事件列表为空时展示"暂无动态"空态提示
6. THE Recent_Activity_Section SHALL 在事件数量超过 10 条时展示"查看全部"链接或按钮
7. WHEN 新事件到达时（通过 Socket 推送），THE Recent_Activity_Section SHALL 在列表顶部插入新条目，使用 CSS transition 动画

### 需求 5：视觉风格与设计令牌消费

**用户故事：** 作为前端开发者，我希望右侧信息面板消费 spec 1 定义的设计令牌，以便面板视觉风格与新的冷灰 SaaS 色板一致。

#### 验收标准

1. THE Right_Info_Panel SHALL 使用 `--background` 作为面板背景色
2. THE Right_Info_Panel 中的各区域卡片 SHALL 使用 `--card` 作为背景色、`--card-foreground` 作为文字色
3. THE Right_Info_Panel 中的各区域卡片 SHALL 使用 `--border` 作为边框色、`--radius` 定义的圆角值
4. THE Right_Info_Panel 中的各区域卡片 SHALL 使用不超过两层的冷灰阴影（与 spec 1 的 box-shadow 规范一致）
5. THE Right_Info_Panel 中的区域标题 SHALL 使用 `--muted-foreground` 作为文字色，字号 11–12px，大写字母间距 0.12–0.16em
6. THE Right_Info_Panel 中的数值文字 SHALL 使用 `--font-mono` 字体并启用 `tabular-nums`
7. THE Right_Info_Panel 中的标签胶囊 SHALL 使用 `--secondary` 作为背景色、`--secondary-foreground` 作为文字色

### 需求 6：数据降级与空态处理

**用户故事：** 作为用户，我希望在数据不完整时右侧面板仍能正常展示降级内容，以便我不会看到空白或报错的界面。

#### 验收标准

1. WHEN Autopilot_Summary 为 null 或 undefined 时，THE Right_Info_Panel SHALL 仍然渲染所有区域，使用 `MissionTaskDetail` 中的基础字段作为降级数据源
2. WHEN 某个区域的数据源完全为空时，THE Right_Info_Panel SHALL 为该区域展示友好的空态提示文本
3. IF 任务详情加载失败，THEN THE Right_Info_Panel SHALL 展示错误提示并提供重试按钮
4. THE Right_Info_Panel SHALL 不因任何单个区域的数据异常而导致整个面板崩溃（每个区域应有独立的错误边界）

### 需求 7：与现有组件的兼容

**用户故事：** 作为前端开发者，我希望右侧面板改造不破坏现有的任务队列、3D 场景和底部操作区功能，以便现有功能继续正常工作。

#### 验收标准

1. THE Right_Info_Panel SHALL 不修改 `tasks-store` 的数据结构或 API 接口
2. THE Right_Info_Panel SHALL 不修改 `OfficeWorkflowContextPanels` 中 workflow flow、agent inspector 和 memory reports 面板的结构或逻辑
3. THE Right_Info_Panel SHALL 保留现有的 `TaskDetailView` 组件作为深层详情的展开入口（可通过"查看完整详情"按钮触发）
4. THE Right_Info_Panel SHALL 在 spec 3 的 `TaskDetailCardsView` 渲染时（中央区域显示卡片化详情），仍然正常展示右侧信息面板
5. THE Right_Info_Panel SHALL 不修改 `UnifiedLaunchComposer` 发起入口的功能
