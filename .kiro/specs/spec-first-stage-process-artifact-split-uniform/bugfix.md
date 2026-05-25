# Bugfix Requirements Document

## Introduction

SPEC-FIRST 蓝图驾驶舱页面（`AutopilotRoutePage`）的「执行流 / 产物流」双栏布局
在不同阶段呈现不一致：

- **输入阶段（`target_input` 活跃 / `intake_created` 等待）和澄清阶段（`clarification`
  活跃）**：用户已经看到执行流卡片（如「输入记录已创建」「澄清已提交，已回答 3/3」），
  但右侧产物流要么不出现，要么塌陷为空，导致用户误以为"还没产生任何产物"。只有在
  路线（`route`）阶段卡片下方才稳定出现完整的双栏；
- **澄清阶段提交后**：右侧产物流出现两张完全相同的「澄清会话」卡片（来自前端本地
  `buildPreflightArtifactEntries` 合成 + 后端 job.artifacts 中由
  `createId("blueprint-artifact")` 生成的同一逻辑会话），而 `buildPreflightArtifactEntries`
  的去重只比较 `artifact.id`，不识别"逻辑上同一会话"，因此重复产物没有被合并；
- **覆盖范围不全**：双栏目前只在 `intake_created` / `clarification` / `route`
  三个 sub-stage 的卡片底部装配，`fabric` 阶段（`spec_tree` / `execution` /
  `evaluation` / `delivery` 等）并没有统一表达，用户在不同阶段看到完全不同的
  右栏行为。

用户期望：所有 Project-First / SPEC-FIRST 阶段都展示统一的「左执行流 / 右产物流」
双栏；即使产物尚未生成，右栏也保持可见占位（如"产物生成中…"），不能塌陷或消失；
同时澄清阶段的产物去重必须按"逻辑产物"而不仅仅是"id 字面相等"。

## Bug Analysis

### Current Behavior (Defect)

当前缺陷的可观测表现，作为 bug condition C(X) 的取证基础：

1.1 WHEN 用户处于输入阶段（`sub` 为 `target_input` 或 `intake_created`）且 `intake`
尚未创建 THEN 该 sub-stage 卡片下不挂载 `<ProcessArtifactSplitPanel>`，右侧产物流不出现，
用户只看到表单/按钮，没有"执行流 / 产物流"双栏占位

1.2 WHEN 用户处于澄清阶段活跃态（`sub === "clarification"` 且 `clarificationSession`
已生成但用户尚未提交回答）且 `buildPreflightArtifactEntries({ sub: "clarification" })`
返回的 artifact 数组为空 THEN 右栏渲染 `EmptyLane`（"暂无产物"）而不是稳定的占位卡片，
用户感知为"产物消失"

1.3 WHEN 用户在澄清阶段提交回答后，后端 job 中已存在 `type === "clarification_session"`
的 artifact（id 由 `createId("blueprint-artifact")` 生成）且前端
`buildPreflightArtifactEntries` 同时合成一条本地 artifact（id 为
`clarification-session-${session.id}`） THEN 现有按 `seenIds.has(artifact.id)` 的
id 字面去重无法识别同一逻辑会话，右栏同时出现两张「澄清会话」卡片

1.4 WHEN 用户处于 `fabric` 阶段下任意 sub-stage（`spec_tree` / `execution` /
`evaluation` / `delivery` 等） THEN 该阶段下不存在与 preflight 三个 sub-stage 一致的
「执行流 / 产物流」双栏装配，行为与前序阶段不一致

1.5 WHEN 任意阶段的 `<ProcessArtifactSplitPanel>` 接收到 `artifactCards.length === 0`
THEN 右栏不渲染骨架/占位卡片，仅显示一行 `EmptyLane` 文案，与左栏的执行流卡片在视觉
密度上严重失衡，用户无法判断"是还没产出"还是"挂载失败"

1.6 WHEN 任意阶段的 `<ProcessArtifactSplitPanel>` 接收到 `executionCards.length === 0`
且 `fallbackExecutionEntries` 为空 THEN 左栏同样退化为单行 `EmptyLane`，无法保留双栏
结构，用户在窄宽断点下可能感觉左栏也"塌了"

### Expected Behavior (Correct)

修复后对同样的输入应满足的正确行为，作为 P(result) 的断言基础：

2.1 WHEN 用户处于输入阶段（`sub` 为 `target_input` 或 `intake_created`）且 `intake`
尚未创建 THEN 系统 SHALL 在该 sub-stage 卡片下挂载 `<ProcessArtifactSplitPanel>`，
右侧产物流以稳定占位卡片（如"产物生成中…"或骨架）呈现，左右双栏始终可见

2.2 WHEN 用户处于澄清阶段活跃态（`sub === "clarification"`）且产物尚未生成
THEN 系统 SHALL 渲染双栏布局，右栏显示稳定占位卡片，不退化为单行空文案，左侧继续显示
当前澄清进度的执行流（含 fallback 文案）

2.3 WHEN 用户在澄清阶段提交回答后，后端 job 与前端本地各产生一条对应同一
`clarificationSession.id` 的 `clarification_session` artifact THEN 系统 SHALL 按
"逻辑产物"维度去重（识别同 `type` + 同 `payload.sessionId`），右栏只显示一张「澄清会话」
卡片，且 `payload.sessionId` 与当前 `clarificationSession.id` 保持一致

2.4 WHEN 用户处于 `fabric` 阶段下任意 sub-stage（`spec_tree` / `execution` /
`evaluation` / `delivery` 等） THEN 系统 SHALL 在该阶段视图下挂载与 preflight 三个
sub-stage 行为一致的「执行流 / 产物流」双栏，遵循同一份 `PREFLIGHT_ARTIFACT_TYPES`
风格的白名单或其等价物，并继承同样的 stage filter 语义

2.5 WHEN `<ProcessArtifactSplitPanel>` 接收到 `artifactCards.length === 0`
THEN 系统 SHALL 在右栏渲染稳定的占位卡片（骨架或"产物生成中…"），保持与左栏视觉密度
对齐；当 artifacts 真正到达时占位被替换而不是叠加

2.6 WHEN `<ProcessArtifactSplitPanel>` 接收到 `executionCards.length === 0`
且 `fallbackExecutionEntries` 为空 THEN 系统 SHALL 在左栏同样渲染稳定占位（与右栏
对称），双栏结构在所有窗口宽度下不塌陷

### Unchanged Behavior (Regression Prevention)

修复不应改变的行为（¬C(X) 上必须保持等价）：

3.1 WHEN 任意阶段的 artifact 列表已包含至少一条产物且与执行流事件均完整 THEN 系统
SHALL CONTINUE TO 按现有顺序、样式与 stale badge 渲染产物卡片，不引入新的 reorder /
filter 行为

3.2 WHEN 用户处于 `route` 阶段且 `routeSet` / `selection` / `specTree` 已就绪
THEN 系统 SHALL CONTINUE TO 让 `stageFilter=["route_generation","route_selection","spec_tree"]`
合并三段执行流事件，不会因为本次修复被收窄为单 stage

3.3 WHEN 后端 job artifact 的 id 与前端本地合成 artifact 的 id 在字面上不同但属于不同
逻辑产物（例如不同 `clarification_session.id` 或 `route_set.id`） THEN 系统 SHALL
CONTINUE TO 同时显示两张卡片，新增的"逻辑去重"只针对同一逻辑产物，不影响合法多产物

3.4 WHEN `WorkbenchExecutionPanel` 在 SPEC 文档工作台中独立挂载
`<ProcessArtifactSplitPanel>` THEN 系统 SHALL CONTINUE TO 保留其现有外观与生命周期，
本次修复对"右侧 workbench"已有的双栏不产生回归

3.5 WHEN `<ProcessArtifactSplitPanel>` 接收到非空 reasoning 事件流（来自
`useBlueprintRealtimeStore` 或显式 `reasoningEntries`） THEN 系统 SHALL CONTINUE TO
优先渲染 reasoning 卡片，仅在 reasoning 为空时退回 fallback 执行流文案

3.6 WHEN GitHub Pages 静态预览（`IS_GITHUB_PAGES`）下没有真实 job 数据 THEN 系统 SHALL
CONTINUE TO 通过现有 `github-pages-blueprint-demo` 数据让双栏能渲染演示卡片，本次修复
不应让静态预览出现新的空白态

3.7 WHEN 用户在历史 / completed 卡片视图下查看已完成阶段 THEN 系统 SHALL CONTINUE TO
保留既有"完成态卡片"的内联编辑与 stale 标识入口，新的占位卡片仅出现在"应有产物但当前
为空"的运行态区域，不污染历史快照
