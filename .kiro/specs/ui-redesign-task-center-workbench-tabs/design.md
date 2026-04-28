# Design Document

## Overview

The `/tasks` page becomes the dedicated task workbench. It keeps the task queue and adds a full task-context tab set in the main area. The page does not show `发起`; launch remains on home. This keeps `/tasks` focused on viewing, following up, and inspecting existing missions.

## Architecture

Target wide desktop layout:

```text
task queue rail | task focus header + workbench tabs
```

Workbench tabs:

```text
任务 | 团队流 | Agent | 记忆 | 历史
```

No `发起` tab is rendered on `/tasks`.

## Component Strategy

### Preferred Shared Component

Create a shared component if implementation duplication becomes significant:

```text
client/src/components/office/OfficeContextTabs.tsx
```

Potential props:

```ts
type OfficeContextTabKey = "launch" | "task" | "flow" | "agent" | "memory" | "history";

interface OfficeContextTabsProps {
  tabs: OfficeContextTabKey[];
  activeTab: OfficeContextTabKey;
  onActiveTabChange: (tab: OfficeContextTabKey) => void;
  availability: Record<Exclude<OfficeContextTabKey, "launch" | "task">, boolean>;
  childrenByTab: Record<OfficeContextTabKey, React.ReactNode>;
}
```

If extracting this component is too large for the first pass, the `/tasks` page may compose the same tab primitives directly while reusing existing tab content components.

### `client/src/pages/tasks/TasksPage.tsx`

Responsibilities after this spec:

- Keep `TasksQueueRail`.
- Replace the plain `TasksCockpitDetail` main body with tabbed workbench content.
- Omit `launch` entirely.
- Reuse `TasksCockpitDetail`, `OfficeWorkflowFlowPanel`, `OfficeAgentInspectorPanel`, `OfficeMemoryReportsPanel`, and `OfficeWorkflowHistoryPanel`.
- Keep `taskOverviewPanel` as the page header.

### Data Sources

`TasksPage` already has:

- task list and details from `useTasksStore`;
- selected task id and selected detail;
- decision note and operator action handlers.

It may need additional data already used by home:

- `useWorkflowStore` for workflows, current workflow, and agents;
- `resolveWorkflowForSelectedTask` and `buildOfficeCockpitAvailability` from office utilities.

## Data Flow

```text
useTasksStore -> activeTaskId -> selectedDetail -> task tab
useWorkflowStore -> activeWorkflow / agents -> flow, agent, memory, history tabs
tab state -> active content
```

When a workflow history item points to a mission id, selecting it should keep the same behavior as home: select the task and return to task or flow context as appropriate.

## Testing Strategy

Add or update tests under `client/src/pages/tasks` or component-level tests:

- wide `/tasks` workbench shows five tab triggers;
- `/tasks` markup does not contain a `launch`/`发起` tab trigger;
- task tab renders `TasksCockpitDetail`;
- flow/memory/history panels are wired or show valid empty states;
- task detail remains full width.

Use:

```powershell
npx vitest run --pool=forks --poolOptions.forks.singleFork client/src/pages/tasks client/src/components/tasks/__tests__/TasksCockpitDetail.test.tsx
```

## Non-Goals

- Do not add launch to `/tasks`.
- Do not remove the task queue from `/tasks`.
- Do not change task store APIs.
- Do not implement home shell changes in this spec.
