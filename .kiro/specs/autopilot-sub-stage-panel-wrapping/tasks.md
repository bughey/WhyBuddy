# 任务：autopilot 子阶段面板内容化包裹

## 前置依赖

- Spec 1 / 2 / 3 / 4 全部已合入 main
- `AutopilotRightRail.tsx` 已使用 SubStageCard 卡片流式布局
- `render-sub-stage-panel.tsx` 已存在

## 可改的 6 个面板改造

- [ ] 1. 改造 `panels/AgentCrewFabricPanel.tsx`
  - 根节点 chrome 剥离（移除 rounded-[20px] / bg-white / px-4 py-4）
  - 删除头部 Layers3 icon + "智能体团队" eyebrow + h3 + subtitle + Badge 计数
  - 内部嵌套卡片 rounded 全改直角 + 彩色换灰
  - 清理不再使用的 import（Layers3 / Badge 等）

- [ ] 2. 改造 `panels/EffectPreviewPanel.tsx`
  - 根节点 chrome 剥离
  - 删除头部 eyebrow
  - 内部嵌套卡片 + RuntimeProjectionCard rounded 改直角

- [ ] 3. 改造 `panels/PromptPackagePanel.tsx`
  - 根节点 chrome 剥离
  - 删除头部 PackageCheck icon + 标题
  - chips / 内容预览 改直角

- [ ] 4. 改造 `panels/RuntimeCapabilityPanel.tsx`
  - 根节点 chrome 剥离
  - 删除头部 ListChecks / Sparkles / Terminal icon + 标题
  - SummaryTile + Agent 角色行改直角 + 去彩色

- [ ] 5. 改造 `panels/EngineeringHandoffPanel.tsx`
  - 根节点 chrome 剥离
  - 删除头部 FileCheck2 / CheckCircle2 icon + 标题
  - 落地计划 / 运行状态 / 平台选择器改直角

- [ ] 6. 改造 `panels/ArtifactMemoryPanel.tsx`
  - 根节点 chrome 剥离
  - 删除头部 GitBranch / Layers3 / PlayCircle eyebrow
  - Summary tile / RouteMetric / feedback 列表改直角

## SpecTree / SpecDocuments 适配层

- [ ] 7. 在 `render-sub-stage-panel.tsx` 中为 SpecTree 加 adapter wrapper
  - 返回 `<div className="autopilot-panel-adapter" data-panel-adapter="spec-tree"><SpecTreePanel .../></div>`

- [ ] 8. 在 `render-sub-stage-panel.tsx` 中为 SpecDocuments 加 adapter wrapper
  - 返回 `<div className="autopilot-panel-adapter" data-panel-adapter="spec-documents"><SpecDocumentsPanel .../></div>`

- [ ] 9. 在 `client/src/index.css` 中添加 adapter CSS override
  - 放在 `.mirofish-rail` scope 现有规则末尾
  - 覆盖 autopilot-panel-adapter 内部的 rounded / bg / border 为直角 + 白底 + 灰边

## 测试

- [ ] 10. 更新 `shim-identity.test.ts`
  - 检查是否有 assertion 依赖 `rounded-[20px]` 等字面量
  - 若有，放宽为仅断言 data-testid 存在

- [ ] 11. 新增 `panel-chrome-strip.test.ts`
  - 对 6 个可改面板各写 2 个 case：
    - 断言 markup 不含 `rounded-[20px]`
    - 断言 markup 不含 counter badge 文案（如 "N 角色 / M 事件"）
  - 至少 12 个 case

## 验收

- [ ] 12. 执行验证
  - `npx vitest run client/src/pages/autopilot` 全部通过
  - `node --run check` TS error 数 = 107
  - 人工目视：
    - 6 个可改面板展开后无自带标题 / icon / 彩色 chrome
    - SpecTree / SpecDocuments 在 adapter 包裹下视觉统一
    - 整屏没有卡片套卡片的嵌套圆角

- [ ] 13. 提交
  - commit message: `refactor(autopilot): strip panel chrome and add adapter for locked panels`
  - stage 内容：
    - 6 个 `panels/*.tsx` 可改面板
    - `render-sub-stage-panel.tsx`
    - `client/src/index.css`（adapter CSS）
    - `panels/__tests__/panel-chrome-strip.test.ts`
  - 禁止 stage `.kiro/blueprint-assets/jobs.json`
