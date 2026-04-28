# Design Document

## Overview

The home center composer becomes a compact command bar inspired by the provided reference image. It should feel like a lightweight command input floating over the scene, not like a full task card or autopilot dashboard. The right drawer takes over explanatory and contextual content.

## Component Strategy

The implementation should preserve the existing `UnifiedLaunchComposer` submission path. Prefer styling and composition changes around the current composer over replacing the business logic.

Primary files:

- `client/src/components/office/OfficeTaskCockpit.tsx`
- `client/src/components/launch/UnifiedLaunchComposer.tsx`
- `client/src/components/launch/LaunchPanelShell.tsx`
- related launch component tests

## Target Visual Structure

```text
rounded translucent composer
  input row
    leading spark/icon
    text input / placeholder
    send icon button
  action row
    add file | cite data | generate report | create task | more
```

The container should use restrained glass styling already present in the project: translucent white, subtle border, blur, and low visual weight.

## Data and Interaction

No launch contract changes are planned.

```text
UnifiedLaunchComposer
  -> attachments
  -> current runtime mode/context
  -> launch/create task flow
  -> existing task/workflow stores
```

Clarification remains separate:

```text
currentDialog exists -> temporary clarification panel above composer
currentDialog absent -> composer-only center
```

## Responsive Behavior

Desktop:

- action buttons remain in one row when possible;
- composer max width remains bounded so it does not become a full-width dashboard card.

Tablet/mobile:

- actions can wrap or compact;
- no text overlap;
- send button remains visible.

## Testing Strategy

Use targeted tests for launch and home:

```powershell
npx vitest run --pool=forks --poolOptions.forks.singleFork client/src/components/office/OfficeTaskCockpit.test.tsx client/src/components/launch/__tests__/LaunchPanelShell.test.tsx client/src/components/launch/__tests__/LaunchPanelIntegration.test.tsx
```

Expected test coverage:

- one composer rendered;
- composer is bare/dense where appropriate;
- action controls are visible;
- large center autopilot guidance is absent by default;
- clarification panel only appears when current dialog exists.

## Non-Goals

- Do not change the launch API.
- Do not remove attachments.
- Do not remove create-task access.
- Do not move task center workbench tabs; that is covered by `ui-redesign-task-center-workbench-tabs`.
