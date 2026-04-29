# Design Document

## Overview

The home center composer remains a compact command bar inspired by the provided reference image, but the surrounding central control area now uses an Ant Design vertical `Splitter`. The upper Splitter panel contains the launch guidance and Support / Logs / Artifacts / Runtime tabs that were previously rendered as a separate bottom panel. The lower Splitter panel contains the compact composer input.

## Component Strategy

The implementation should preserve the existing `UnifiedLaunchComposer` submission path. Prefer styling and composition changes around the current composer over replacing the business logic.

Primary files:

- `client/src/components/office/OfficeTaskCockpit.tsx`
- `client/src/components/launch/UnifiedLaunchComposer.tsx`
- `client/src/components/launch/LaunchPanelShell.tsx`
- related launch component tests

## Target Visual Structure

```text
rounded translucent center control
  Ant Design Splitter vertical
    upper panel
      launch guidance
      Support / Logs / Artifacts / Runtime tabs
    lower panel
      compact composer
        input row
          leading spark/icon
          text input / placeholder
          send icon button
        compact controls
          add files | runtime meta | submit
```

The container should use restrained glass styling already present in the project: translucent white, subtle border, blur, and low visual weight. The Splitter handle should be visible enough to indicate resizing without competing with the composer.

## Data and Interaction

No launch contract changes are planned. The composer remains the submit surface, while the lower Support tab derives destination preview and route planning from the current launch draft.

```text
UnifiedLaunchComposer
  -> attachments
  -> current runtime mode/context
  -> launch/create task flow
  -> existing task/workflow stores

OfficeTaskCockpit central control upper panel
  -> useNLCommandStore.draftText
  -> buildLaunchDestinationPreview
  -> buildLaunchRoutePlan
  -> LaunchDestinationPreviewCard + RoutePlanningOverlay
```

Clarification remains separate:

```text
currentDialog exists -> temporary clarification panel above composer
currentDialog absent -> composer-only center
```

## Responsive Behavior

Desktop:

- compact composer controls remain readable;
- destination preview and route planning stay in the Support tab inside the upper Splitter panel rather than expanding inside the composer;
- composer max width remains bounded so it does not become a full-width dashboard card.
- the control panel has a bounded max height so it does not cover the scene or push the composer off-screen.

Tablet/mobile:

- actions can wrap or compact;
- no text overlap;
- send button remains visible.
- the Splitter still stacks support/runtime content above the composer.

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
- central control uses a vertical Splitter and renders the control panel above the composer;
- destination preview and route planning are absent from the composer surface;
- destination preview and route planning render in the Support tab when draft text exists;
- clarification panel only appears when current dialog exists.

## Non-Goals

- Do not change the launch API.
- Do not remove attachments.
- Do not remove create-task access.
- Do not move task center workbench tabs; that is covered by `ui-redesign-task-center-workbench-tabs`.
