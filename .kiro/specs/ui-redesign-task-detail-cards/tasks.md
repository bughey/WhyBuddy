<!--
 * @Author: wangchunji
 * @Date: 2026-04-27 14:35:21
 * @Description: 
 * @LastEditTime: 2026-04-27 14:39:35
 * @LastEditors: wangchunji
-->
# 任务清单

## 任务

- [ ] 1. 创建 TaskHeaderCard 组件
  - [ ] 1.1 新建 `client/src/components/tasks/TaskHeaderCard.tsx`，接收 title、description、status、progress、estimatedDuration、priority、driveState、locale 等 props
  - [ ] 1.2 实现状态徽章渲染，根据 status 值映射对应的语义色类名（running=绿色、waiting=琥珀色、failed=红色、done=灰色、cancelled=灰色、queued=蓝色）
  - [ ] 1.3 实现进度条渲染，使用 `--primary` 色填充，支持 0-100 范围
  - [ ] 1.4 实现预估时间和优先级标签的条件渲染（数据存在时显示，不存在时隐藏）
  - [ ] 1.5 使用 spec 1 设计令牌：`--card` 背景、`--card-foreground` 文字、`--border` 边框、`--radius` 圆角
  - [ ] 1.6 编写单元测试，验证不同 status 值对应正确的徽章颜色类名

- [ ] 2. 创建 GoalCard 组件
  - [ ] 2.1 新建 `client/src/components/tasks/GoalCard.tsx`，接收 title、goals 数组、overallProgress、locale 等 props
  - [ ] 2.2 实现子目标列表渲染，每项包含状态图标（✓/●/○）和名称
  - [ ] 2.3 实现整体进度条渲染
  - [ ] 2.4 实现空态处理：goals 为空时展示"暂无目标数据"提示
  - [ ] 2.5 编写数据映射辅助函数，从 autopilotSummary 的 `destination.subGoals` 或 `destination.successCriteria` 构建 goals 数组，降级使用 selectedDetail 的 summary
  - [ ] 2.6 编写单元测试，验证空数组和正常数组的渲染行为

- [ ] 3. 创建 RouteCard 组件
  - [ ] 3.1 新建 `client/src/components/tasks/RouteCard.tsx`，接收 title、steps 数组、currentStepIndex、locale 等 props
  - [ ] 3.2 实现水平步骤进度条渲染：圆形编号节点 + 连接线 + 步骤名称
  - [ ] 3.3 实现步骤状态样式：已完成（绿色+勾选）、当前（primary 色+脉冲）、未开始（灰色）
  - [ ] 3.4 实现步骤数量 > 6 时的水平滚动支持
  - [ ] 3.5 编写数据映射辅助函数，从 autopilotSummary 的 `route.stages` 构建 steps 数组，降级使用 selectedDetail 的 stages
  - [ ] 3.6 实现空态处理：steps 为空时展示"暂无路线数据"提示
  - [ ] 3.7 编写单元测试，验证步骤状态的单调性（已完成在前、当前最多一个、未开始在后）

- [ ] 4. 创建 FleetCard 组件
  - [ ] 4.1 新建 `client/src/components/tasks/FleetCard.tsx`，接收 title、members 数组、locale 等 props
  - [ ] 4.2 实现成员卡片渲染：圆形头像占位图标 + 角色名称 + 状态指示点
  - [ ] 4.3 实现状态指示点颜色映射：active=绿色、idle=灰色、waiting=琥珀色、error=红色
  - [ ] 4.4 实现水平排列和 flex-wrap 换行
  - [ ] 4.5 编写数据映射辅助函数，从 autopilotSummary 的 `fleet.roles` 构建 members 数组，降级使用 selectedDetail 的 departmentLabels
  - [ ] 4.6 实现空态处理：members 为空时展示"暂无编队数据"提示
  - [ ] 4.7 编写单元测试，验证空数组和正常数组的渲染行为

- [ ] 5. 创建 TakeoverCard 组件
  - [ ] 5.1 新建 `client/src/components/tasks/TakeoverCard.tsx`，接收 hasPendingDecision、decisionPrompt、decisionPresets、decisionNote、操作回调等 props
  - [ ] 5.2 实现有待处理决策时的渲染：决策提示文本 + 决策选项按钮 + 备注输入框
  - [ ] 5.3 实现无待处理决策时的渲染：接管摘要或"当前无需接管"空态提示
  - [ ] 5.4 实现操作按钮的 loading 状态：operatorActionLoading 为 true 时所有按钮 disabled
  - [ ] 5.5 编写单元测试，验证 hasPendingDecision 为 false 时展示空态，为 true 时展示决策 UI

- [ ] 6. 创建 TaskDetailCardsView 容器组件
  - [ ] 6.1 新建 `client/src/components/tasks/TaskDetailCardsView.tsx`，组装 TaskHeaderCard + 可滚动卡片区域（GoalCard、RouteCard、FleetCard、TakeoverCard）+ 底部 CommandInputBar
  - [ ] 6.2 实现数据映射层：从 detail 和 autopilotSummary 提取各卡片所需的 props，包含降级逻辑
  - [ ] 6.3 实现底部 CommandInputBar：固定在底部，复用 UnifiedLaunchComposer 精简模式或简化输入组件
  - [ ] 6.4 实现错误边界：每个卡片用 ErrorBoundary 包裹，单个卡片异常不影响其他卡片
  - [ ] 6.5 编写组件测试，验证完整 autopilotSummary 和 null autopilotSummary 两种场景

- [ ] 7. 改造 OfficeTaskCockpit 中央区域
  - [ ] 7.1 在 OfficeTaskCockpit.tsx 中实现中央区域条件渲染：selectedTaskId 存在时显示 TaskDetailCardsView，否则显示 Scene3D
  - [ ] 7.2 使用 `display: none` 隐藏 Scene3D（而非卸载），保持 WebGL 上下文
  - [ ] 7.3 从 tasks-store 获取 autopilotSummary 并传递给 TaskDetailCardsView
  - [ ] 7.4 实现视图切换的 CSS transition 动画（200-300ms fade）
  - [ ] 7.5 确保 TaskDetailCardsView 在 spec 2 侧边栏布局内正确渲染，不与侧边栏重叠
  - [ ] 7.6 编写集成测试，验证选中/取消选中任务时的视图切换行为
  - [ ] 7.7 运行 `pnpm run build` 验证构建成功，运行 `node --run check` 验证不引入新的 TypeScript 错误
