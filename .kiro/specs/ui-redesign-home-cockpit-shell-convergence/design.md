# Design Document

## Overview

This design changes the home cockpit from a three-pane task-heavy workspace into a scene-first cockpit shell. The home page should keep the immersive 3D office scene and a compact bottom composer in the center. The task queue is removed from the home cockpit and remains available in `/tasks`. The right drawer keeps the full context tab set and receives the autopilot guidance that previously competed with the center scene.

The key design boundary is capability preservation. We are changing placement and visual hierarchy, not removing task, workflow, agent, memory, history, launch, or runtime evidence capabilities.

## Architecture

### Home Cockpit Layout

Current home cockpit:

```text
left task queue | center stage with launch/autopilot stack | right drawer tabs
```

Target home cockpit:

```text
center scene stage with compact bottom composer | right drawer tabs
```

The transparent global `AppSidebar` remains outside the cockpit. The home cockpit no longer creates its own left task queue drawer.

## Component Changes

### `client/src/components/office/OfficeTaskCockpit.tsx`

Responsibilities after this spec:

- Remove the left `Splitter.Panel` that contains `TasksQueueRail`.
- Keep the center `Splitter.Panel` as the scene stage.
- Keep the right `Splitter.Panel` as the full context drawer.
- Move center autopilot guidance into the right drawer `launch` tab.
- Keep a single visible `UnifiedLaunchComposer` in the center-bottom composer stack.

The right drawer should continue to use:

- `TasksCockpitDetail` for the `task` tab;
- `OfficeWorkflowFlowPanel` for `flow`;
- `OfficeAgentInspectorPanel` for `agent`;
- `OfficeMemoryReportsPanel` for `memory`;
- `OfficeWorkflowHistoryPanel` for `history`.

### `client/src/components/office/OfficeTaskCockpit.test.tsx`

Add or update static markup tests:

- home cockpit does not render the mocked `TasksQueueRail`;
- home cockpit still renders exactly one `UnifiedLaunchComposer`;
- right drawer exposes the six home tabs;
- launch guidance appears inside the right drawer `launch` tab;
- `office-scene-hud` remains in the center stage.

## Data Flow

No store contracts change.

```text
useTasksStore
  -> selectedDetail / tasks / activeTaskId
  -> center HUD summary
  -> right drawer task/workflow tabs

UnifiedLaunchComposer
  -> existing launch flow
  -> pendingLaunch state
  -> right drawer launch/flow tab transitions
```

## Responsive Behavior

Desktop and wide desktop:

- no home left task queue drawer;
- center stage uses freed width;
- right drawer remains visible and bounded.

Tablet and mobile:

- existing responsive fallbacks remain valid;
- no new mobile-only task queue is introduced by this spec;
- `/tasks` remains the deep task workspace.

## Error Handling

Existing error handling remains in place:

- `TasksCockpitDetail` handles no selected task;
- workflow panels handle missing workflow context;
- launch composer handles launch and clarification state;
- runtime evidence surfaces keep their existing fallbacks.

## Testing Strategy

Use targeted Vitest with the known Windows-safe command shape:

```powershell
npx vitest run --pool=forks --poolOptions.forks.singleFork client/src/components/office/OfficeTaskCockpit.test.tsx
```

Then include this test in the UI targeted suite before updating the progress SVG.

## Non-Goals

- Do not rewrite `tasks-store`.
- Do not remove `/tasks`.
- Do not remove right drawer tabs.
- Do not implement `/tasks` tab workbench in this spec; that is covered by `ui-redesign-task-center-workbench-tabs`.
