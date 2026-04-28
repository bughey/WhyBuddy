# Requirements Document

## Introduction

This follow-up spec covers the home cockpit information-architecture adjustment after the original 8 UI redesign specs and the first-screen parity repair pass. The original UI redesign baseline remains complete. This spec changes the home page cockpit shell so the 3D office scene and the bottom composer become the primary center experience, while task queue and deep task work move out of the home center.

The user-facing goals are:

- remove the home cockpit left task queue drawer;
- keep Scene3D as the main visual surface;
- keep only a compact composer in the center-bottom area;
- move the current center autopilot/launch guidance into the right drawer;
- preserve the right drawer tabs and existing task/workflow capabilities.

## Requirements

### Requirement 1: Remove the Home Left Task Queue Drawer

**User Story:** As a desktop user, I want the home page to stop showing a task queue drawer on the left side of the cockpit, so the office scene is not visually squeezed by two task panels.

#### Acceptance Criteria

1. WHEN the home cockpit renders on desktop THEN it SHALL NOT render the `TasksQueueRail` as a left `Splitter.Panel`.
2. WHEN a task is selected THEN task selection SHALL remain available through `/tasks` and right drawer task context, not through a home left drawer.
3. WHEN the home cockpit removes the left drawer THEN it SHALL NOT remove the underlying task store selection, refresh, or deep-link behavior.
4. WHEN the home page uses the transparent `AppSidebar` rail THEN the cockpit content SHALL continue to sit behind it without adding a second task queue rail.
5. IF a previous UI test expects a home left task drawer THEN that expectation SHALL be replaced with a test asserting the drawer is absent on home.

### Requirement 2: Keep the Center Scene as the Primary Surface

**User Story:** As a user opening the office home page, I want the 3D office scene to remain the main surface, so I can orient around the office rather than seeing task panels dominate the page.

#### Acceptance Criteria

1. WHEN the home cockpit renders THEN the center `Splitter.Panel` SHALL remain the largest content region.
2. WHEN the left task drawer is removed THEN the center stage SHALL expand into the freed horizontal space.
3. WHEN the center stage renders THEN `office-scene-hud` SHALL remain visible.
4. WHEN a mission is selected THEN the compact scene HUD MAY show mission focus, but it SHALL NOT become a full task-detail panel.
5. WHEN the viewport is wide desktop THEN the center scene SHALL not be covered by a large autopilot card.

### Requirement 3: Move Autopilot Guidance Into the Right Drawer

**User Story:** As a user, I want autopilot guidance and launch explanation to live in the right drawer, so the center of the screen stays focused on the scene and composer.

#### Acceptance Criteria

1. WHEN the user opens the home cockpit right drawer `发起` tab THEN it SHALL contain the autopilot launch guidance that previously occupied the center.
2. WHEN the right drawer `发起` tab is visible THEN it SHALL preserve access to launch guidance, pending-launch status, and clarification hints.
3. WHEN the center composer is visible THEN it SHALL remain the single command input surface.
4. WHEN clarification is active THEN the clarification panel MAY appear as a separate overlay, but it SHALL NOT recreate a second large center autopilot panel.
5. WHEN telemetry support, logs, artifacts, or runtime evidence are available THEN they SHALL remain available through existing auxiliary surfaces and not be deleted.

### Requirement 4: Preserve the Right Drawer Tab Set on Home

**User Story:** As a user, I want the home right drawer to keep the full cockpit context tabs, so moving content around does not remove capabilities.

#### Acceptance Criteria

1. WHEN the home cockpit renders THEN the right drawer SHALL expose `发起`, `任务`, `团队流`, `Agent`, `记忆`, and `历史` tabs.
2. WHEN a tab is unavailable because its data is missing THEN the tab MAY be disabled, but it SHALL remain part of the expected tab set.
3. WHEN the `任务` tab is active THEN it SHALL show the selected task summary/detail context.
4. WHEN the `团队流`, `Agent`, `记忆`, or `历史` tab is active THEN it SHALL reuse the existing `OfficeWorkflowContextPanels` and `OfficeAgentInspectorPanel` surfaces.
5. WHEN the right drawer width changes THEN its content SHALL remain readable without forcing center-stage cards back into the scene.

### Requirement 5: Preserve Existing Contracts

**User Story:** As a developer, I want this shell change to preserve the current stores, task contracts, and backend behavior, so visual cleanup does not create a migration.

#### Acceptance Criteria

1. THE implementation SHALL NOT change `tasks-store` data contracts.
2. THE implementation SHALL NOT change backend task, workflow, runtime, or socket APIs.
3. THE implementation SHALL NOT remove `/tasks` or `/tasks/:taskId` navigation.
4. THE implementation SHALL preserve the existing launch submission path through `UnifiedLaunchComposer`.
5. THE implementation SHALL add or update tests for home shell absence of the left drawer, center composer uniqueness, and right drawer tab availability.
