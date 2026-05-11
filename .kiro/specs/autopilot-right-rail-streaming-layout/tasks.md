# 任务：autopilot 右栏 MiroFish 式流式卡片布局

## 前置依赖

- Spec 1 `autopilot-cockpit-shell-cleanup` 已合入 main
- Spec 2 `autopilot-sub-stage-card-primitive` 已合入 main，且 `SubStageCard` 支持 `anchorAttr` / `ariaCurrentStep` 两个 prop
- Spec 3 `autopilot-sub-stage-metrics-extractor` 已合入 main

## 任务清单

- [ ] 1. 抽离 `renderSubStagePanel` 到独立文件
  - 新建 `client/src/pages/autopilot/right-rail/render-sub-stage-panel.tsx`
  - 把现有 `AutopilotRightRail.tsx` 中的 `renderSubStagePanel` 函数完整搬迁
  - 导出函数签名

- [ ] 2. 补 Spec 2 的根节点属性通道（如果 Spec 2 已合入但未支持 anchorAttr）
  - 定位 `primitives/sub-stage-card.tsx`
  - 在 props interface 新增 `anchorAttr?: { name: string; value: string }` 与 `ariaCurrentStep?: boolean`
  - 根节点 `<article>` 按 design.md 规定的顺序 spread 这两个属性
  - 新增一个单元测试覆盖 anchorAttr + ariaCurrentStep 一起传入时的 attribute 顺序

- [ ] 3. 重写 `AutopilotRightRail.tsx` 主入口
  - 删除 `CompletedSubStageRow` / `readSubStageMetric` / `isSubStageDataReady` 内部组件与函数
  - 删除 `Fabric eyebrow` 块、「后续 N 步」提示
  - 删除 `LIVE / PENDING` header 提示条
  - 用新的 `FabricCardStream` 内部组件重写 fabric 分支
  - import `SubStageCard` / `MetricsRow` / `StatusCapsule` / `deriveSubStageSummary` / `renderSubStagePanel`

- [ ] 4. 实现 `FabricCardStream` 内部组件
  - 计算 `completed = RAIL_SUB_STAGE_ORDER.slice(0, activeIndex)`
  - 局部 state: `expanded: Partial<Record<AutopilotRailSubStage, boolean>>`
  - 容器外层 `bg-[#FAFAFA] px-5 py-5 space-y-4`
  - 渲染 `completed.map(sub => <CompletedCard>)` + `activeSubStage ? <ActiveCard> : null`

- [ ] 5. 实现 `CompletedCard` 内部组件
  - 调用 `deriveSubStageSummary(sub, props, locale)`
  - 渲染 `<SubStageCard status="completed" expanded={expanded[sub]} onToggleExpanded={() => toggle(sub)}>`
  - body: `<MetricsRow>` + `expanded ? renderSubStagePanel() : null`

- [ ] 6. 实现 `ActiveCard` 内部组件
  - 调用 `deriveSubStageSummary`
  - 渲染 `<SubStageCard status={dataReady ? "active" : "pending"} anchorAttr={{name:"data-sub-stage-placeholder", value:sub}} ariaCurrentStep>`
  - body: `<MetricsRow>` + (dataReady ? `renderSubStagePanel()` : `<PendingInlineState>`)

- [ ] 7. 实现 `PendingInlineState` 内部 helper
  - 按 design.md 的代码块实现
  - 虚线边框 + mono 小字 + 双语文案

- [ ] 8. 更新 `fabric-dispatch.property.test.tsx`
  - 确保 assertions 仍然通过
  - 若有断言依赖 `<section>` 标签，改为 `<article>` 或改为通过 data-* 属性定位
  - 若 aria-current 顺序检查失败，定位是 Spec 2 的 spread 顺序问题，回到 Task 2 修复

- [ ] 9. 新增 `autopilot-right-rail-cards.test.tsx`
  - case 1：activeSubStage="spec_tree" + 数据就绪，断言 completed + active 两种 status 都存在
  - case 2：activeSubStage="spec_tree" + specTree=null，断言 status="pending" + 「AWAITING UPSTREAM DATA」
  - case 3：activeSubStage="agent_crew_fabric"，断言未来 7 个子阶段不渲染
  - case 4：点击 completed toggle 后 expanded 切换，renderSubStagePanel 展开（用 testing-library 模拟）

- [ ] 10. 执行验证
  - `npx vitest run client/src/pages/autopilot` 全过
  - `node --run check` TS error 数 = 107
  - 人工目视：fabric 阶段看到 MiroFish 式卡片流，活跃卡橙边，完成卡灰边

- [ ] 11. 提交
  - commit message: `feat(autopilot): rewrite right rail as MiroFish streaming card layout`
  - stage 内容：
    - `client/src/pages/autopilot/right-rail/AutopilotRightRail.tsx`
    - `client/src/pages/autopilot/right-rail/render-sub-stage-panel.tsx`（新增）
    - `client/src/pages/autopilot/right-rail/primitives/sub-stage-card.tsx`（如有 Task 2 改动）
    - `__tests__/autopilot-right-rail-cards.test.tsx`（新增）
  - 禁止 stage `.kiro/blueprint-assets/jobs.json`
