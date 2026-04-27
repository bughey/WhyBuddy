# 需求文档

## 简介

本规格是 UI 改造项目（共 8 个 spec）的第 5 个，依赖 spec 1（`ui-redesign-color-and-tokens`）的色板与设计令牌体系，以及 spec 2（`ui-redesign-sidebar-navigation`）的左侧垂直导航栏布局。目标是将当前底部固定的 `UnifiedLaunchComposer` 输入栏改造为居中浮层面板（Floating Panel Overlay），匹配参考设计中的"任务自动驾驶 Autopilot Control"面板。

当前状态：
- `UnifiedLaunchComposer.tsx`：底部固定输入栏，支持 mission / clarify / workflow 三种发起模式
- 已支持附件上传、路线规划预览（`RoutePlanningOverlay`）、目的地预览（`DestinationPreviewCard`）
- 已支持 `submitUnifiedLaunch()` 统一发起 API，返回 mission 或 workflow 结果
- `LaunchAttachmentSection.tsx`：附件管理区域
- `LaunchRouteBanner.tsx`：路线候选横幅
- `LaunchRuntimeMeta.tsx`：运行时元信息展示
- `tasks-store.ts`：已具备 `createMission` 方法和 `MissionAutopilotSummary` 数据结构
- 参考设计要求一个居中浮层面板，包含模式选项卡、目标输入区、自主规划路径流程、能力驾驶舱、输出与交付区域和底部操作栏

## 术语表

- **Launch_Panel**：居中浮层面板组件，替代当前底部固定的 `UnifiedLaunchComposer` 输入栏，作为任务发起的主入口
- **Panel_Backdrop**：浮层面板的半透明遮罩层，覆盖在 3D 场景之上，点击可关闭面板
- **Mode_Tab_Bar**：面板顶部的模式选项卡栏，包含快速模式、标准模式、深度模式、研究模式、自定义模式
- **Goal_Input_Area**：面板中的目标输入文本区域，标题为"输入你的目标"，带字符计数
- **Route_Planning_Flow**：自主规划路径流程可视化区域，展示"目的地 → 路线规划 → 执行步骤 → 校验/证据"四步流程
- **Cockpit_Section**：能力驾驶舱区域，展示可用工具卡片（浏览器能力、代码执行器、文件系统、知识检索等）
- **Output_Section**：输出与交付区域，展示输出类型标签（结果摘要、生成文件、执行日志、证据截图、操作记录）
- **Panel_Action_Bar**：面板底部操作栏，包含添加附件、高级设置、保存为模板、启动任务按钮
- **Quick_Mode**：快速模式，简化面板仅展示目标输入和启动按钮，类似当前底部输入栏的行为
- **Advanced_Mode**：高级模式（标准/深度/研究/自定义），展示完整面板包含所有区域
- **Trigger_Button**：触发浮层面板打开的按钮，位于侧边栏或页面头部的"+ 新建任务"按钮

## 需求

### 需求 1：浮层面板触发与显示

**用户故事：** 作为用户，我希望点击"+ 新建任务"按钮后弹出一个居中浮层面板，以便我能在不离开当前页面的情况下发起新任务。

#### 验收标准

1. WHEN 用户点击侧边栏或页面头部的 Trigger_Button 时，THE Launch_Panel SHALL 以居中浮层形式渲染在页面上方
2. THE Launch_Panel SHALL 覆盖在 Scene3D_Viewport 和 Content_Area 之上，使用 `z-index` 确保层级正确
3. THE Panel_Backdrop SHALL 渲染为半透明遮罩（`rgba(0,0,0,0.4)` 或等效冷灰遮罩），覆盖整个视口
4. WHEN 用户点击 Panel_Backdrop 时，THE Launch_Panel SHALL 关闭并恢复底层页面的交互
5. THE Launch_Panel SHALL 在打开时使用 CSS transition 或 Framer Motion 动画（scale + opacity，duration 200–300ms）
6. THE Launch_Panel SHALL 在关闭时使用反向动画（duration 150–200ms）
7. THE Launch_Panel SHALL 在桌面端居中显示，最大宽度不超过 720px，最大高度不超过视口高度的 85%
8. THE Launch_Panel SHALL 在内容超出最大高度时支持内部垂直滚动

### 需求 2：模式选项卡

**用户故事：** 作为用户，我希望在面板顶部看到不同的任务模式选项卡，以便我能根据任务复杂度选择合适的发起模式。

#### 验收标准

1. THE Mode_Tab_Bar SHALL 展示以下五个选项卡：快速模式、标准模式、深度模式、研究模式、自定义模式
2. THE Mode_Tab_Bar SHALL 默认选中"快速模式"选项卡
3. WHEN 用户选择"快速模式"时，THE Launch_Panel SHALL 仅展示 Goal_Input_Area 和 Panel_Action_Bar，隐藏 Route_Planning_Flow、Cockpit_Section 和 Output_Section
4. WHEN 用户选择"标准模式"、"深度模式"、"研究模式"或"自定义模式"时，THE Launch_Panel SHALL 展示完整面板包含所有区域
5. THE Mode_Tab_Bar SHALL 高亮当前选中的选项卡，使用 `--primary` 色作为活跃指示
6. THE Mode_Tab_Bar SHALL 将选中的模式映射到现有的 `LaunchRouteCandidateId`，以便复用现有路线规划逻辑

### 需求 3：目标输入区域

**用户故事：** 作为用户，我希望在面板中有一个清晰的目标输入区域，以便我能描述我想要完成的任务。

#### 验收标准

1. THE Goal_Input_Area SHALL 展示标题"输入你的目标"（中文）或"Enter your goal"（英文），使用 i18n 键
2. THE Goal_Input_Area SHALL 包含一个多行文本输入框（textarea），最小高度 80px，最大高度 200px，支持自动扩展
3. THE Goal_Input_Area SHALL 在文本输入框右下角展示实时字符计数（格式："当前字数 / 最大字数"）
4. THE Goal_Input_Area SHALL 设置最大字符数为 2000
5. THE Goal_Input_Area SHALL 复用现有 `useNLCommandStore` 的 `draftText` 和 `setDraftText` 状态管理
6. THE Goal_Input_Area SHALL 在输入框为空时展示占位提示文本，引导用户描述任务目标

### 需求 4：自主规划路径流程

**用户故事：** 作为用户，我希望在高级模式下看到一个自主规划路径的流程可视化，以便我能了解系统将如何处理我的任务。

#### 验收标准

1. THE Route_Planning_Flow SHALL 展示标题"自主规划路径"（中文）或"Autonomous Route Planning"（英文）
2. THE Route_Planning_Flow SHALL 以水平流程图形式展示四个步骤：目的地 → 路线规划 → 执行步骤 → 校验/证据
3. THE Route_Planning_Flow SHALL 使用连接线或箭头将四个步骤串联
4. WHEN 用户输入目标文本后，THE Route_Planning_Flow SHALL 高亮"目的地"步骤，表示已完成输入
5. THE Route_Planning_Flow SHALL 仅在 Advanced_Mode 下渲染，Quick_Mode 下隐藏
6. THE Route_Planning_Flow SHALL 消费现有 `buildLaunchRoutePlan()` 的路线规划结果来更新步骤状态

### 需求 5：能力驾驶舱区域

**用户故事：** 作为用户，我希望在高级模式下看到系统可用的能力工具卡片，以便我能了解系统将使用哪些工具来完成任务。

#### 验收标准

1. THE Cockpit_Section SHALL 展示标题"能力驾驶舱 COCKPIT"
2. THE Cockpit_Section SHALL 以网格布局展示工具卡片，每个卡片包含图标和工具名称
3. THE Cockpit_Section SHALL 至少展示以下工具卡片：浏览器能力、代码执行器、文件系统、知识检索
4. THE Cockpit_Section SHALL 根据当前运行时模式（`runtimeMode`）标记不可用的工具卡片为禁用状态
5. THE Cockpit_Section SHALL 仅在 Advanced_Mode 下渲染，Quick_Mode 下隐藏

### 需求 6：输出与交付区域

**用户故事：** 作为用户，我希望在高级模式下看到预期的输出类型标签，以便我能了解任务完成后将产出哪些交付物。

#### 验收标准

1. THE Output_Section SHALL 展示标题"输出与交付"（中文）或"Output & Delivery"（英文）
2. THE Output_Section SHALL 以水平排列的标签（chips）形式展示输出类型：结果摘要、生成文件、执行日志、证据截图、操作记录
3. THE Output_Section SHALL 允许用户点击标签切换选中/未选中状态
4. THE Output_Section SHALL 仅在 Advanced_Mode 下渲染，Quick_Mode 下隐藏

### 需求 7：底部操作栏

**用户故事：** 作为用户，我希望面板底部有一个操作栏，包含附件添加、设置和启动任务按钮，以便我能完成任务配置并发起执行。

#### 验收标准

1. THE Panel_Action_Bar SHALL 固定在 Launch_Panel 的底部，不随面板内容滚动
2. THE Panel_Action_Bar SHALL 包含以下操作按钮（从左到右）：添加附件、高级设置、保存为模板、启动任务
3. WHEN 用户点击"添加附件"按钮时，THE Panel_Action_Bar SHALL 触发文件选择器，复用现有的附件上传逻辑（`LaunchAttachmentSection`）
4. WHEN 用户点击"启动任务"按钮时，THE Panel_Action_Bar SHALL 调用现有的 `submitUnifiedLaunch()` API 发起任务
5. WHEN 任务发起成功后，THE Launch_Panel SHALL 自动关闭并通过 `onTaskResolved` 或 `onWorkflowResolved` 回调通知父组件
6. WHEN 任务正在提交时，THE Panel_Action_Bar SHALL 将"启动任务"按钮设为 loading 状态，禁止重复提交
7. THE Panel_Action_Bar SHALL 在目标输入为空时将"启动任务"按钮设为禁用状态

### 需求 8：保留现有任务创建 API

**用户故事：** 作为前端开发者，我希望浮层面板复用现有的任务创建 API 和状态管理，以便不引入重复的数据流。

#### 验收标准

1. THE Launch_Panel SHALL 复用现有的 `submitUnifiedLaunch()` 函数作为任务提交入口
2. THE Launch_Panel SHALL 复用现有的 `useNLCommandStore` 管理草稿文本状态
3. THE Launch_Panel SHALL 复用现有的 `useWorkflowStore` 管理工作流提交状态
4. THE Launch_Panel SHALL 复用现有的 `buildLaunchRoutePlan()` 和 `buildLaunchDestinationPreview()` 函数
5. THE Launch_Panel SHALL 不新增任何后端 API 端点
6. THE Launch_Panel SHALL 保留 `onTaskResolved` 和 `onWorkflowResolved` 回调接口，与现有 `OfficeTaskCockpit` 的集成方式一致

### 需求 9：面板视觉风格

**用户故事：** 作为前端开发者，我希望浮层面板消费 spec 1 定义的设计令牌，以便面板视觉风格与新的冷灰 SaaS 色板一致。

#### 验收标准

1. THE Launch_Panel SHALL 使用 `--card` 作为面板背景色、`--card-foreground` 作为文字色
2. THE Launch_Panel SHALL 使用 `--border` 作为面板边框色
3. THE Launch_Panel SHALL 使用 `--radius` 定义的圆角值（面板整体使用 `--radius-xl`）
4. THE Launch_Panel SHALL 使用不超过两层的冷灰阴影（与 spec 1 的 box-shadow 规范一致）
5. THE Mode_Tab_Bar SHALL 使用 `--muted` 作为未选中选项卡背景、`--primary` 作为选中选项卡指示色
6. THE Panel_Action_Bar 的"启动任务"按钮 SHALL 使用 `--primary` 作为背景色、`--primary-foreground` 作为文字色

### 需求 10：响应式适配

**用户故事：** 作为移动端用户，我希望浮层面板在小屏幕上也能正常使用，以便我能在任何设备上发起任务。

#### 验收标准

1. WHEN 视口宽度 ≤ 767px 时，THE Launch_Panel SHALL 以全屏底部抽屉（bottom sheet）形式渲染，而非居中浮层
2. WHEN 视口宽度在 768px–1279px 之间时，THE Launch_Panel SHALL 以居中浮层形式渲染，最大宽度为视口宽度的 90%
3. WHEN 视口宽度 ≥ 1280px 时，THE Launch_Panel SHALL 以居中浮层形式渲染，最大宽度为 720px
4. THE Launch_Panel SHALL 在所有视口宽度下保持 Mode_Tab_Bar、Goal_Input_Area 和 Panel_Action_Bar 的可用性
5. THE Launch_Panel SHALL 在移动端隐藏 Cockpit_Section 和 Output_Section，仅保留核心输入和操作区域

### 需求 11：无障碍与键盘导航

**用户故事：** 作为使用键盘或辅助技术的用户，我希望浮层面板支持标准的无障碍交互模式。

#### 验收标准

1. THE Launch_Panel SHALL 使用 `role="dialog"` 和 `aria-modal="true"` 语义
2. THE Launch_Panel SHALL 设置 `aria-labelledby` 指向面板标题元素
3. WHEN Launch_Panel 打开时，THE Launch_Panel SHALL 将焦点移动到 Goal_Input_Area 的文本输入框
4. WHEN 用户按下 Escape 键时，THE Launch_Panel SHALL 关闭
5. THE Launch_Panel SHALL 实现焦点陷阱（focus trap），Tab 键在面板内部循环，不逃逸到底层页面
6. THE Mode_Tab_Bar SHALL 使用 `role="tablist"` 和 `role="tab"` 语义，支持左右箭头键切换选项卡
