# 需求文档

## 简介

本规格是 UI 改造项目（共 8 个 spec）的第 3 个，依赖 spec 1（`ui-redesign-color-and-tokens`）的色板与设计令牌体系，以及 spec 2（`ui-redesign-sidebar-navigation`）的左侧垂直导航栏布局。目标是将当前中央内容区从三栏驾驶舱布局（`TasksQueueRail | Scene3D | TasksCockpitDetail`）改造为卡片化任务详情视图，匹配参考设计中的任务详情卡片布局。

当前状态：
- `OfficeTaskCockpit.tsx`：三栏布局，左侧任务队列、中间 3D 场景、右侧 `TasksCockpitDetail` 详情面板
- `TasksCockpitDetail.tsx`：右侧面板，包含 tab 切换（任务 / 团队流 / Agent / 记忆报告 / 历史）
- `TaskAutopilotPanel.tsx`：已具备 destination、route、driveState、fleet、takeover、evidence 等数据解析与展示能力
- `tasks-store.ts`：已具备 `MissionAutopilotSummary` 数据结构，包含目标、路线、车队、接管、证据等全部字段
- 参考设计要求中央区域在选中任务时展示卡片化详情，未选中时展示 3D 场景

## 术语表

- **Task_Detail_Cards_View**：中央内容区的卡片化任务详情视图，由多个独立卡片组件垂直排列组成
- **Task_Header_Card**：任务头部卡片，展示任务标题、描述、状态徽章、进度百分比、预估时间、优先级
- **Goal_Card**：目标卡片（"目标"区域），展示任务子目标列表及各子目标的完成进度指示器
- **Route_Card**：路线卡片（"路线"区域），展示水平步骤进度条，包含编号步骤和完成勾选标记
- **Fleet_Card**：编队执行卡片（"编队执行"区域），展示参与 Agent 的头像、角色标签和当前状态
- **Takeover_Card**：接管/证据卡片（"接管/证据"区域），展示待处理决策项和操作按钮
- **Command_Input_Bar**：底部任务指令输入栏，用于向当前任务发送指令或补充信息
- **Scene3D_Viewport**：Three.js 3D 办公室场景的渲染区域
- **Content_Area**：侧边栏右侧的主内容区域，承载路由页面
- **Autopilot_Summary**：`tasks-store` 中的 `MissionAutopilotSummary` 数据结构，包含 destination、route、driveState、fleet、takeover、evidence 等字段

## 需求

### 需求 1：中央区域视图切换

**用户故事：** 作为桌面端用户，我希望在选中任务时中央区域自动切换为卡片化任务详情视图，未选中时显示 3D 场景，以便我能在任务详情和办公室全景之间自然切换。

#### 验收标准

1. WHEN 用户在任务队列中选中一个任务时，THE Content_Area SHALL 将中央区域从 Scene3D_Viewport 切换为 Task_Detail_Cards_View
2. WHEN 当前没有选中任何任务时，THE Content_Area SHALL 在中央区域显示 Scene3D_Viewport 作为默认视图
3. WHEN 用户取消选中当前任务时，THE Content_Area SHALL 将中央区域从 Task_Detail_Cards_View 切换回 Scene3D_Viewport
4. THE Content_Area SHALL 在视图切换时使用 CSS transition 动画（duration 200–300ms），避免突兀的内容跳变
5. THE Task_Detail_Cards_View SHALL 占据中央区域的全部可用宽度和高度，支持垂直滚动以容纳所有卡片

### 需求 2：任务头部卡片

**用户故事：** 作为用户，我希望在任务详情顶部看到一个头部卡片，包含任务的核心信息摘要，以便我能快速了解任务的整体状态。

#### 验收标准

1. THE Task_Header_Card SHALL 展示任务标题，使用 `--font-display` 字体
2. THE Task_Header_Card SHALL 展示任务描述或来源文本的前两行摘要
3. THE Task_Header_Card SHALL 展示任务状态徽章，使用与状态对应的语义色（running=绿色、waiting=琥珀色、failed=红色、done=灰色、cancelled=灰色）
4. THE Task_Header_Card SHALL 展示任务进度百分比，以圆形或条形进度指示器呈现
5. THE Task_Header_Card SHALL 展示预估时间信息（如果 Autopilot_Summary 中包含 `route.estimatedDuration`）
6. THE Task_Header_Card SHALL 展示任务优先级标签（如果 Autopilot_Summary 中包含优先级信息）
7. THE Task_Header_Card SHALL 消费 `tasks-store` 中的 `selectedDetail` 和 `autopilotSummary` 数据

### 需求 3：目标卡片

**用户故事：** 作为用户，我希望看到一个目标区域卡片，展示任务的子目标及其完成进度，以便我能了解任务的目标拆解和各子目标的推进情况。

#### 验收标准

1. THE Goal_Card SHALL 展示标题"目标"（中文）或"Goals"（英文），使用 i18n 键
2. THE Goal_Card SHALL 从 Autopilot_Summary 的 `destination.subGoals` 或 `destination.successCriteria` 中读取子目标列表
3. WHEN 子目标列表不为空时，THE Goal_Card SHALL 为每个子目标展示名称和完成状态指示器（已完成/进行中/未开始）
4. WHEN 子目标列表为空或 Autopilot_Summary 不可用时，THE Goal_Card SHALL 展示任务的主目标描述作为降级内容
5. THE Goal_Card SHALL 展示整体目标完成进度（已完成子目标数 / 总子目标数）

### 需求 4：路线卡片

**用户故事：** 作为用户，我希望看到一个路线区域卡片，以水平步骤进度条的形式展示任务的执行路线，以便我能直观了解任务走到了哪一步。

#### 验收标准

1. THE Route_Card SHALL 展示标题"路线"（中文）或"Route"（英文），使用 i18n 键
2. THE Route_Card SHALL 从 Autopilot_Summary 的 `route.stages` 中读取路线阶段列表
3. THE Route_Card SHALL 以水平步骤进度条形式展示各阶段，每个步骤包含编号和阶段名称
4. WHEN 某个阶段已完成时，THE Route_Card SHALL 在该步骤上显示勾选标记（checkmark）
5. WHEN 某个阶段正在执行时，THE Route_Card SHALL 高亮该步骤并显示进行中指示器
6. WHEN Autopilot_Summary 不可用时，THE Route_Card SHALL 从 `selectedDetail` 的 `stages` 字段读取 mission 阶段作为降级数据源
7. THE Route_Card SHALL 在步骤数量超过可视区域时支持水平滚动或自适应缩放

### 需求 5：编队执行卡片

**用户故事：** 作为用户，我希望看到一个编队执行区域卡片，展示参与当前任务的 Agent 角色及其状态，以便我能了解谁在负责什么。

#### 验收标准

1. THE Fleet_Card SHALL 展示标题"编队执行"（中文）或"Fleet Execution"（英文），使用 i18n 键
2. THE Fleet_Card SHALL 从 Autopilot_Summary 的 `fleet.roles` 中读取角色列表
3. THE Fleet_Card SHALL 为每个角色展示头像占位图标、角色名称标签和当前状态指示
4. WHEN 角色状态为 active 时，THE Fleet_Card SHALL 使用绿色指示器
5. WHEN 角色状态为 idle 或 waiting 时，THE Fleet_Card SHALL 使用灰色指示器
6. WHEN Autopilot_Summary 不可用时，THE Fleet_Card SHALL 从 `selectedDetail` 的 `departmentLabels` 或 `agents` 字段读取降级数据
7. THE Fleet_Card SHALL 以水平排列的方式展示角色卡片，支持换行

### 需求 6：接管/证据卡片

**用户故事：** 作为用户，我希望看到一个接管/证据区域卡片，展示当前待处理的决策项和可执行的操作按钮，以便我能快速响应需要人工介入的事项。

#### 验收标准

1. THE Takeover_Card SHALL 展示标题"接管/证据"（中文）或"Takeover/Evidence"（英文），使用 i18n 键
2. WHEN 当前任务有待处理决策时，THE Takeover_Card SHALL 展示决策提示文本和可选的决策选项按钮
3. WHEN 当前任务有待处理的操作动作时，THE Takeover_Card SHALL 展示操作按钮（如批准、拒绝、重试等）
4. THE Takeover_Card SHALL 从 Autopilot_Summary 的 `takeover` 字段和 `selectedDetail` 的 `decision`、`decisionPresets` 字段读取数据
5. WHEN 没有待处理决策或操作时，THE Takeover_Card SHALL 展示"当前无需接管"的空态提示
6. THE Takeover_Card SHALL 在用户点击操作按钮后调用 `tasks-store` 的 `submitOperatorAction` 或 `launchDecision` 方法

### 需求 7：底部指令输入栏

**用户故事：** 作为用户，我希望在卡片化详情视图底部有一个指令输入栏，以便我能向当前任务发送补充信息或指令。

#### 验收标准

1. THE Command_Input_Bar SHALL 固定在 Task_Detail_Cards_View 的底部，不随卡片内容滚动
2. THE Command_Input_Bar SHALL 复用现有的 `UnifiedLaunchComposer` 组件或其精简变体
3. WHEN 用户在 Command_Input_Bar 中提交内容时，THE Command_Input_Bar SHALL 将内容关联到当前选中的任务
4. THE Command_Input_Bar SHALL 在没有选中任务时不渲染

### 需求 8：卡片视觉风格

**用户故事：** 作为前端开发者，我希望所有卡片组件消费 spec 1 定义的设计令牌，以便卡片视觉风格与新的冷灰 SaaS 色板一致。

#### 验收标准

1. THE Task_Detail_Cards_View 中的所有卡片 SHALL 使用 `--card` 作为背景色、`--card-foreground` 作为文字色
2. THE Task_Detail_Cards_View 中的所有卡片 SHALL 使用 `--border` 作为边框色
3. THE Task_Detail_Cards_View 中的所有卡片 SHALL 使用 `--radius` 定义的圆角值
4. THE Task_Detail_Cards_View 中的所有卡片 SHALL 使用不超过两层的冷灰阴影（与 spec 1 的 box-shadow 规范一致）
5. THE Task_Detail_Cards_View SHALL 使用 `--background` 作为卡片之间的间隔背景色
6. THE Task_Detail_Cards_View SHALL 在 spec 2 定义的侧边栏布局内正确渲染，不与侧边栏重叠

### 需求 9：数据降级与空态处理

**用户故事：** 作为用户，我希望在数据不完整时卡片仍能正常展示降级内容，以便我不会看到空白或报错的界面。

#### 验收标准

1. WHEN Autopilot_Summary 为 null 或 undefined 时，THE Task_Detail_Cards_View SHALL 仍然渲染所有卡片，使用 `selectedDetail` 中的基础字段作为降级数据源
2. WHEN 某个卡片的数据源完全为空时，THE Task_Detail_Cards_View SHALL 为该卡片展示友好的空态提示文本
3. IF 任务详情加载失败，THEN THE Task_Detail_Cards_View SHALL 展示错误提示并提供重试按钮
4. THE Task_Detail_Cards_View SHALL 不因任何单个卡片的数据异常而导致整个视图崩溃（每个卡片应有独立的错误边界）

### 需求 10：与现有组件的兼容

**用户故事：** 作为前端开发者，我希望卡片化改造不破坏现有的任务队列、3D 场景和底部操作区功能，以便现有功能继续正常工作。

#### 验收标准

1. THE Task_Detail_Cards_View SHALL 不修改 `TasksQueueRail` 组件的结构或逻辑
2. THE Task_Detail_Cards_View SHALL 不修改 `Scene3D` 组件的结构或逻辑
3. THE Task_Detail_Cards_View SHALL 不修改 `tasks-store` 的数据结构或 API 接口
4. THE Task_Detail_Cards_View SHALL 保留现有的 `UnifiedLaunchComposer` 发起入口功能
5. WHEN Task_Detail_Cards_View 渲染时，THE Scene3D_Viewport SHALL 被隐藏但不被卸载（保持 WebGL 上下文），以便切换回时无需重新初始化
