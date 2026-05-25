# Requirements Document

## Introduction

SPEC-FIRST 蓝图驾驶舱页面（`AutopilotRoutePage`）当前在不同 sub-stage 下手工
装配 `<ProcessArtifactSplitPanel>`，导致三类用户可见的不一致：(1) 部分
sub-stage（preflight 的 `target_input` 活跃态 / `intake_created` 等待态，以及
fabric 全部 7 个 sub-stage `agent_crew_fabric / spec_tree / effect_preview /
prompt_package / runtime_capability / engineering_handoff / artifact_memory`）
根本没挂载双栏，用户看到表单或单栏卡片，误以为"产物消失"或"挂载失败"；
(2) `clarification` 阶段提交回答后右栏出现两张同一逻辑会话的「澄清会话」
卡片，因为去重只比较 `artifact.id` 字面值；(3) 任一栏为空时整块退化为单行
`EmptyLane`，与"已有产物"的视觉密度差距过大。

本特性把"执行流 / 产物流"双栏从"按 sub-stage 分散装配"重构为**统一描述符 +
单一渲染入口**：每个 sub-stage 输出一份 `StageSplitDescriptor`（执行流过滤器、
产物类型白名单、本地合成 artifact、fallback 文案），由所有挂载点共享同一份
装配逻辑；同时把 `<ProcessArtifactSplitPanel>` 升级为"双栏始终保留结构 +
空态降级为占位卡片"的稳定容器，并在产物侧引入 `logicalArtifactKey` 维度的
去重以消除澄清会话双卡片问题。

本特性严格遵守现有兼容边界：保留 `BlueprintGenerationArtifact` 字段语义、
不引入第二套 mission/runtime 真相源、不改变 GitHub Pages 静态预览数据流、
不影响 `WorkbenchExecutionPanel` 中独立挂载的双栏外观。

## Glossary

- **Autopilot_Route_Page**: 蓝图驾驶舱页面 `AutopilotRoutePage`，是 SPEC-FIRST
  下的主操作壳，按 sub-stage 卡片渲染 preflight 与 fabric 两个阶段的视图。
- **Sub_Stage**: 单个 sub-stage 标识，取值范围为 `target_input | intake_created
  | clarification | route`（preflight）与 `agent_crew_fabric | spec_tree |
  effect_preview | prompt_package | runtime_capability | engineering_handoff |
  artifact_memory`（fabric），共 11 个。
- **Stage_Split_Descriptor**: 由 `useStageSplitDescriptor` hook 输出的结构体，
  包含 `sub`、`artifactTypes`、`stageFilter`、`artifacts`、
  `fallbackExecutionEntries`、`shouldMount`，是所有双栏挂载点的唯一描述符。
- **Stage_Split_Mount**: 新增装配组件 `<StageSplitMount>`，消费
  `Stage_Split_Descriptor` 并渲染 `<ProcessArtifactSplitPanel>`，是
  Autopilot_Route_Page 双栏的唯一渲染入口。
- **Process_Artifact_Split_Panel**: 现有组件 `<ProcessArtifactSplitPanel>`，
  本特性内升级为始终保留双栏结构 + 空态占位的稳定容器。
- **Execution_Lane**: 双栏中的左栏，渲染 reasoning 卡片或 fallback 执行流文案。
- **Artifact_Lane**: 双栏中的右栏，渲染 `BlueprintGenerationArtifact` 卡片。
- **Execution_Placeholder_Card**: 左栏空态时渲染的稳定占位卡片。
- **Artifact_Placeholder_Card**: 右栏空态时渲染的稳定占位卡片。
- **Logical_Artifact_Key**: 由 `computeLogicalArtifactKey` 计算的非空字符串，
  把同一逻辑产物（同 `type` + 同业务 id 如 `payload.sessionId`）映射到同一
  键，跨多次渲染稳定不变。
- **Merge_Logical_Artifacts**: 工具函数 `mergeLogicalArtifacts`，按
  Logical_Artifact_Key 合并 artifact 列表，保留首条出现的 representative。
- **Workbench_Execution_Panel**: SPEC 文档工作台中独立挂载的双栏组件
  `<WorkbenchExecutionPanel>`，本特性不修改其外观与生命周期。
- **GitHub_Pages_Static_Preview**: `IS_GITHUB_PAGES === true` 下的静态预览
  路径，由 `github-pages-blueprint-demo` 提供 demo 数据。

## Requirements

### Requirement 1: 所有 sub-stage 通过统一描述符装配双栏

**User Story:** 作为 SPEC-FIRST 蓝图驾驶舱页面的用户，我希望所有 preflight
与 fabric 的 sub-stage 都通过同一份描述符装配「执行流 / 产物流」双栏，使我在
任意阶段都能看到一致的双栏结构。

#### Acceptance Criteria

1. WHEN 任一 Sub_Stage 处于 active 状态，THE Autopilot_Route_Page SHALL 通过
   `useStageSplitDescriptor` 输出 `shouldMount === true` 的
   Stage_Split_Descriptor，并据此挂载 Stage_Split_Mount 渲染
   Process_Artifact_Split_Panel，其中 Process_Artifact_Split_Panel 必须同时
   呈现「执行流」左栏与「产物流」右栏两个区域。
2. THE Autopilot_Route_Page SHALL 对 `target_input`、`intake_created`、
   `clarification`、`route`、`agent_crew_fabric`、`spec_tree`、`effect_preview`、
   `prompt_package`、`runtime_capability`、`engineering_handoff`、
   `artifact_memory` 共 11 个 Sub_Stage 均通过同一份 `useStageSplitDescriptor`
   hook 计算 Stage_Split_Descriptor，且不得在任一 Sub_Stage 分支内调用其它
   hook 或本地函数生成 Stage_Split_Descriptor。
3. THE Autopilot_Route_Page SHALL 通过单一渲染入口 Stage_Split_Mount 装配双栏，
   不再在任何 Sub_Stage 分支内手工拼装 `<ProcessArtifactSplitPanel>` 的
   props，且 Process_Artifact_Split_Panel 在整个页面组件树中只允许由
   Stage_Split_Mount 实例化。
4. WHEN 计算 Stage_Split_Descriptor 时，THE useStageSplitDescriptor SHALL 按表
   `STAGE_ARTIFACT_TYPES` 输出该 Sub_Stage 的 `artifactTypes` 白名单，且
   `descriptor.artifacts` 中每个元素的 `type` 字段必须严格属于该白名单（即
   包含于 `STAGE_ARTIFACT_TYPES[subStage]` 集合中）。
5. IF `descriptor.artifacts` 中存在任一元素的 `type` 字段不在
   `STAGE_ARTIFACT_TYPES[subStage]` 白名单内，THEN THE useStageSplitDescriptor
   SHALL 将该元素从 `descriptor.artifacts` 中过滤剔除，并保留其余合法元素，
   且不得抛出阻塞渲染的异常。
6. WHEN Sub_Stage 为 fabric 的 `agent_crew_fabric`、`spec_tree`、
   `effect_preview`、`prompt_package`、`runtime_capability`、
   `engineering_handoff`、`artifact_memory` 之一，THE Autopilot_Route_Page
   SHALL 在该 Sub_Stage 的 active 与 completed 两种视图下均通过
   Stage_Split_Mount 挂载 Process_Artifact_Split_Panel，且其结构（双栏存在性、
   栏位顺序、`shouldMount === true` 行为）与 preflight Sub_Stage 在 active 与
   completed 视图下保持一致。

### Requirement 2: 双栏结构稳定且空态使用占位卡片

**User Story:** 作为 SPEC-FIRST 蓝图驾驶舱页面的用户，我希望即使产物或
执行流尚未生成，左右双栏也始终可见且使用占位卡片占位，让我准确判断"产物
正在生成"而不是"产物消失"。

#### Acceptance Criteria

1. WHEN Sub_Stage 为 `target_input` 或 `intake_created` 且 `intake` 为
   `null`，THE Autopilot_Route_Page SHALL 在该 Sub_Stage 卡片下挂载
   Process_Artifact_Split_Panel，使 Execution_Lane 与 Artifact_Lane 同时
   出现在 DOM 中，且 Artifact_Lane 渲染恰好一个 Artifact_Placeholder_Card。
2. WHEN Sub_Stage 为 `clarification` 且 active 状态下尚无任何
   `clarification_session` 类型的 artifact，THE Process_Artifact_Split_Panel
   SHALL 渲染左右双栏，使 `data-testid="autopilot-process-execution-lane"`
   与 `data-testid="autopilot-process-artifact-lane"` 两个容器同时出现于
   DOM，且 Artifact_Lane 渲染恰好一个 Artifact_Placeholder_Card。
3. WHEN 后端 `BlueprintGenerationJob.artifacts` 与前端
   `buildPreflightArtifactEntries` 各产生一条对应同一 `clarificationSession.id`
   的 `clarification_session` artifact，THE Merge_Logical_Artifacts SHALL 按
   Logical_Artifact_Key 合并为且仅为一条，且 representative 的 `id` 字段为
   `clarification-session-${sessionId}` 形式，其中 `${sessionId}` 与原
   `clarificationSession.id` 字面相等。
4. WHEN Sub_Stage 处于 fabric 的 `agent_crew_fabric`、`spec_tree`、
   `effect_preview`、`prompt_package`、`runtime_capability`、
   `engineering_handoff`、`artifact_memory` 之一，THE
   Process_Artifact_Split_Panel SHALL 使用与该 Sub_Stage 对应的
   `STAGE_ARTIFACT_TYPES` 白名单与 `stageFilter` 渲染双栏，且 Artifact_Lane
   中不出现 `type` 不在该白名单内的 artifact 卡片。
5. WHEN Process_Artifact_Split_Panel 接收到 `artifactCards.length === 0` 且
   `showEmptyPlaceholder !== false`，THE Process_Artifact_Split_Panel SHALL
   在 Artifact_Lane 渲染恰好一个 Artifact_Placeholder_Card，并保留
   `data-testid="autopilot-process-artifact-lane"` 容器在 DOM 中。
6. WHEN Process_Artifact_Split_Panel 接收到 `executionCards.length === 0` 且
   `showEmptyPlaceholder !== false`，THE Process_Artifact_Split_Panel SHALL
   在 Execution_Lane 渲染恰好一个 Execution_Placeholder_Card，并保留
   `data-testid="autopilot-process-execution-lane"` 容器在 DOM 中。
7. IF 调用方显式传入 `showEmptyPlaceholder === false` 且任一栏的卡片数为
   零，THEN THE Process_Artifact_Split_Panel SHALL 既不渲染对应的
   Artifact_Placeholder_Card 或 Execution_Placeholder_Card，也不卸载该栏的
   `data-testid` 容器，使双栏 DOM 结构在所有渲染分支下保持稳定。

### Requirement 3: 保留既有渲染行为与兼容边界

**User Story:** 作为 SPEC-FIRST 蓝图驾驶舱页面的用户与维护者，我希望本次
重构不改变已有产物的展示顺序、阶段过滤语义、独立 workbench 双栏与 GitHub
Pages 静态预览的现状，避免引入回归。

#### Acceptance Criteria

1. WHEN 任一 Sub_Stage 的 artifact 列表已包含至少一条产物且 reasoning 流
   非空，THE Process_Artifact_Split_Panel SHALL 按重构前的顺序、样式与 stale
   badge 渲染产物卡片，保持卡片相对顺序、可见样式 token 与 stale badge 触发
   条件与重构前完全一致，不引入新的重排、过滤或样式差异。
2. WHEN Sub_Stage 取值为 `route`，THE useStageSplitDescriptor SHALL 输出
   `stageFilter` 数组严格等价于
   `["route_generation", "route_selection", "spec_tree"]`，元素顺序、数量与
   字符串值均一致，覆盖路线生成、路线选择与 spec 树派生三段执行流事件，且
   不包含其他事件类型。
3. WHEN 输入 artifact 列表中存在多条 Logical_Artifact_Key 互异的 artifact，
   THE Merge_Logical_Artifacts SHALL 保留全部条目无丢失，且输出顺序与各
   Logical_Artifact_Key 在输入列表中首次出现的相对顺序一致。
4. WHEN 本特性落地后渲染 Workbench_Execution_Panel，THE
   Workbench_Execution_Panel SHALL 保持与重构前一致的外观与生命周期，唯一
   允许的可观察差异为：仅当 reasoning 流与 artifact 列表均为空时新增
   Execution_Placeholder_Card 与 Artifact_Placeholder_Card 节点。
5. IF 调用方显式传入 `showEmptyPlaceholder={false}`，THEN THE
   Workbench_Execution_Panel SHALL 不渲染 Execution_Placeholder_Card 与
   Artifact_Placeholder_Card，且其余渲染输出与重构前完全一致。
6. WHILE 处于 GitHub_Pages_Static_Preview，THE Autopilot_Route_Page SHALL
   继续通过 `github-pages-blueprint-demo` 数据源驱动双栏渲染至少一条演示
   卡片，且不出现重构前不存在的新增空白态或缺失卡片。

### Requirement 4: 逻辑产物去重的稳定性与降级

**User Story:** 作为 SPEC-FIRST 蓝图驾驶舱页面的用户，我希望逻辑产物去重在
重复合并、字段缺失等场景下都行为稳定，不会因数据抖动出现卡片闪烁或崩溃。

#### Acceptance Criteria

1. THE Merge_Logical_Artifacts SHALL 是幂等函数：对任意输入数组 X，
   `Merge_Logical_Artifacts(Merge_Logical_Artifacts(X))` 的输出长度、元素
   顺序与每个元素的 `id`、`type`、`payload`、`staleSince`、`invalidatedBy`
   字段值，应与 `Merge_Logical_Artifacts(X)` 完全相等（深度相等比较）。
2. WHEN 输入两条 artifact a 与 b 满足
   `computeLogicalArtifactKey(a) === computeLogicalArtifactKey(b)` 且 b 在
   输入数组中位于 a 之后，THE Merge_Logical_Artifacts SHALL 输出长度比输入
   减少 1 的列表，并以 a 的位置作为 representative，将 b 的 `staleSince`、
   `invalidatedBy`、`payload` 字段合并进 representative（b 中非空字段覆盖 a
   中对应字段，b 中缺失或为 `null`/`undefined` 的字段保留 a 的原值）。
3. IF 输入 artifact 的 `type` 等于 `clarification_session` 且
   `payload.sessionId` 为 `undefined`、`null` 或空字符串，THEN THE
   computeLogicalArtifactKey SHALL 返回字符串 `id:${artifact.id}`，使两条
   `type` 为 `clarification_session` 的 artifact 仅在 `artifact.id` 字面
   相等时被判为重复。
4. IF 输入 artifact 的 `id` 字段为 `undefined`、`null` 或空字符串，THEN THE
   computeLogicalArtifactKey SHALL 返回非空字符串占位键，使该 artifact 不与
   任何其他 artifact 合并（即每条无 id 的 artifact 在 Merge_Logical_Artifacts
   输出中独占一行）。
5. IF 后端在某 Sub_Stage 推送了 `type` 不在 `STAGE_ARTIFACT_TYPES[sub]` 白
   名单内的 artifact，THEN THE useStageSplitDescriptor SHALL 在白名单过滤
   步骤静默丢弃该 artifact，不抛出异常、不写入运行期日志、且不影响同批次
   其他白名单内 artifact 的正常输出。
6. WHEN Merge_Logical_Artifacts 接收到长度为 0 的输入数组，THE
   Merge_Logical_Artifacts SHALL 返回长度为 0 的数组，不抛出异常。
