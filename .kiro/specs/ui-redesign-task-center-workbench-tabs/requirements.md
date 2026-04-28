# Requirements Document

## Introduction

This follow-up spec covers the `/tasks` task center workbench. The user explicitly confirmed that `/tasks` must NOT show a `发起` tab. Launch stays on the home page right drawer and the home bottom composer. The task center should instead show the full task workbench context: task detail, team flow, Agent, memory, and history.

The original 8 UI redesign specs remain complete. This spec is a new IA follow-up wave.

## Requirements

### Requirement 1: Keep the Task Center Queue on `/tasks`

**User Story:** As a task center user, I want the task queue to remain in `/tasks`, so I can scan and select tasks in the dedicated task workspace.

#### Acceptance Criteria

1. WHEN `/tasks` renders on wide desktop THEN it SHALL keep `TasksQueueRail` as the left task list.
2. WHEN `/tasks` renders on narrower screens THEN it SHALL keep the existing stacked task queue behavior unless a responsive test requires a narrower adjustment.
3. WHEN a task is selected THEN the selection SHALL update the workbench tab content.
4. WHEN search filters the queue THEN the active task fallback behavior SHALL remain unchanged.
5. THE implementation SHALL NOT move task queue selection back to the home page.

### Requirement 2: Provide a Full Task Workbench Tab Set

**User Story:** As a user in the task center, I want the right/main task area to expose all task-related context tabs, so I do not need the home right drawer to inspect workflow, agent, memory, or history.

#### Acceptance Criteria

1. WHEN `/tasks` renders THEN it SHALL show a tab workbench with `任务`, `团队流`, `Agent`, `记忆`, and `历史`.
2. WHEN `/tasks` renders THEN it SHALL NOT show a `发起` tab.
3. WHEN `任务` is active THEN it SHALL show `TasksCockpitDetail` for the selected task.
4. WHEN `团队流` is active THEN it SHALL show workflow flow context using the existing `OfficeWorkflowFlowPanel`.
5. WHEN `Agent` is active THEN it SHALL show the existing `OfficeAgentInspectorPanel` or a clear empty state when agents are unavailable.
6. WHEN `记忆` is active THEN it SHALL show `OfficeMemoryReportsPanel`.
7. WHEN `历史` is active THEN it SHALL show `OfficeWorkflowHistoryPanel`.

### Requirement 3: Reuse Existing Drawer Content Instead of Forking Logic

**User Story:** As a maintainer, I want `/tasks` to reuse the home right drawer tab surfaces, so task context logic does not drift between pages.

#### Acceptance Criteria

1. THE implementation SHALL reuse existing office workflow/task context components where possible.
2. THE implementation SHALL NOT create a separate copy of workflow flow, memory reports, or history rendering logic.
3. THE implementation MAY introduce a shared `TaskWorkbenchTabs` or `OfficeContextTabs` component if it reduces duplication between home and `/tasks`.
4. THE shared component SHALL accept a flag or tab list that excludes `launch` on `/tasks`.
5. THE shared component SHALL preserve disabled-state behavior for unavailable workflow, agent, memory, and history data.

### Requirement 4: Keep `/tasks` Detail Width at 100%

**User Story:** As a user, I want the task detail content to fill the task center's available width, so it does not look like a narrow right drawer inside a wide page.

#### Acceptance Criteria

1. WHEN `TasksCockpitDetail` renders inside `/tasks` THEN its `RightInfoPanel` SHALL use `width: 100%` and `max-width: none`.
2. WHEN the same detail panel renders inside the home right drawer THEN the outer drawer SHALL control the visual width.
3. WHEN the task tab is active on `/tasks` THEN task detail content SHALL not be constrained to 360px.
4. Existing regression tests for `/tasks` full-width detail SHALL remain in the targeted suite.

### Requirement 5: Preserve Deep Links and Runtime Evidence

**User Story:** As a user opening a task deep link, I want the same task context and runtime evidence entry points to keep working.

#### Acceptance Criteria

1. WHEN `/tasks/:taskId` opens THEN the selected task SHALL be loaded into the `/tasks` workbench.
2. WHEN the user clicks "查看完整详情" THEN the existing full task detail dialog SHALL still open.
3. WHEN runtime evidence is present THEN it SHALL remain available through existing runtime-evidence surfaces.
4. THE implementation SHALL NOT change task runtime evidence data mapping.
5. THE implementation SHALL include tests for the absence of `launch` tab and presence of the five task workbench tabs.
