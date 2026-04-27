# 需求文档：状态指示器卡片

## 简介

本规格是 UI 改造项目（共 8 个 spec）的第 7 个，依赖 spec 2（`ui-redesign-sidebar-navigation`）的左侧垂直导航栏布局。目标是在侧边栏底部或左下角新增 Autopilot Control / Mission Control 状态指示器卡片，匹配参考设计中左下角的运行状态面板。

当前状态：
- 不存在独立的运行状态指示器组件
- `tasks-store` 已具备 `autopilotSummary`（含 driveState、fleet 等字段）
- `tasks-store` 已具备 `selectedDetail`（含 status、progress 等字段）
- 参考设计显示左下角有两个小卡片："Autopilot Control — 智能任务自主执行" 和 "Mission Control — 高级模式"

## 需求

### 需求 1：Autopilot Control 状态卡片

**用户故事：** 作为用户，我希望在侧边栏底部看到当前自动驾驶控制状态，以便我能快速了解系统是否在自主执行任务。

#### 验收标准

1. THE Status_Indicator SHALL 在侧边栏底部（User_Info_Block 上方）渲染一个 Autopilot Control 状态卡片
2. THE Status_Indicator SHALL 展示当前驾驶状态（来自 `autopilotSummary.driveState`），如 running / planning / waiting / blocked / delivered
3. THE Status_Indicator SHALL 使用绿色脉冲圆点表示 running 状态，琥珀色表示 waiting/planning，红色表示 blocked，灰色表示 idle/delivered
4. THE Status_Indicator SHALL 在侧边栏折叠模式下仅显示状态圆点图标，hover 显示 Tooltip
5. THE Status_Indicator SHALL 消费 spec 1 的 `--sidebar-*` 设计令牌

### 需求 2：Mission Control 状态卡片

**用户故事：** 作为用户，我希望看到当前运行模式（Frontend / Advanced）的指示，以便我能了解系统的执行能力级别。

#### 验收标准

1. THE Status_Indicator SHALL 在 Autopilot Control 卡片下方渲染一个 Mission Control 状态卡片
2. THE Status_Indicator SHALL 展示当前运行模式（来自 `useAppStore` 的 `runtimeMode`）：frontend 或 advanced
3. THE Status_Indicator SHALL 使用不同的图标区分两种模式
4. THE Status_Indicator SHALL 在侧边栏折叠模式下仅显示模式图标

### 需求 3：数据降级

**用户故事：** 作为用户，我希望在没有选中任务时状态指示器仍能展示有意义的信息。

#### 验收标准

1. WHEN 没有选中任务时，THE Autopilot Control 卡片 SHALL 展示"待命中"或"空闲"状态
2. WHEN `autopilotSummary` 不可用时，THE Status_Indicator SHALL 从 `selectedDetail.status` 派生简化状态
3. THE Status_Indicator SHALL 不因数据缺失而崩溃或展示空白
