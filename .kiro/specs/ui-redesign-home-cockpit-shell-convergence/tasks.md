# Task List

## Tasks

- [ ] 1. Lock the home shell behavior with tests
  - [ ] 1.1 Update `client/src/components/office/OfficeTaskCockpit.test.tsx` so the mocked `TasksQueueRail` has a `data-testid="tasks-queue-rail"` marker.
  - [ ] 1.2 Add a test asserting `OfficeTaskCockpit` does not render `data-testid="tasks-queue-rail"` on the home cockpit.
  - [ ] 1.3 Add a test asserting `OfficeTaskCockpit` still renders exactly one `data-testid="unified-launch-composer"`.
  - [ ] 1.4 Add a test asserting the home right drawer exposes `launch`, `task`, `flow`, `agent`, `memory`, and `history` tab triggers.
  - [ ] 1.5 Add a test asserting `data-testid="office-scene-hud"` remains present.
  - [ ] 1.6 Run `npx vitest run --pool=forks --poolOptions.forks.singleFork client/src/components/office/OfficeTaskCockpit.test.tsx` and confirm the new drawer-removal test fails before implementation.

- [ ] 2. Remove the home left task queue drawer
  - [ ] 2.1 In `client/src/components/office/OfficeTaskCockpit.tsx`, remove the left `Splitter.Panel` that renders `TasksQueueRail`.
  - [ ] 2.2 Remove the `TasksQueueRail` import from `OfficeTaskCockpit.tsx` if it is no longer used.
  - [ ] 2.3 Adjust the remaining `Splitter.Panel` sizes so the center stage expands into the freed space.
  - [ ] 2.4 Ensure `selectedDetail`, `activeTaskId`, `filteredTasks`, and task selection logic are not removed if still used by the right drawer and launch flows.
  - [ ] 2.5 Run the `OfficeTaskCockpit.test.tsx` target and confirm the drawer-removal tests pass.

- [ ] 3. Move center autopilot guidance to the right drawer launch tab
  - [ ] 3.1 Identify the existing center autopilot/launch guidance inside `launcherFloatingStack`, `launcherDock`, and `launcherContextDock`.
  - [ ] 3.2 Keep the actual `UnifiedLaunchComposer` in the center-bottom composer.
  - [ ] 3.3 Move non-composer launch guidance into the right drawer `launch` tab content.
  - [ ] 3.4 Keep clarification as a separate overlay without duplicating the composer.
  - [ ] 3.5 Run `OfficeTaskCockpit.test.tsx` and confirm exactly one composer still renders.

- [ ] 4. Final home cockpit verification
  - [ ] 4.1 Run `npx vitest run --pool=forks --poolOptions.forks.singleFork client/src/components/office/OfficeTaskCockpit.test.tsx client/src/components/office/__tests__/OfficeTaskCockpit.cards-integration.test.tsx client/src/components/office/office-task-cockpit-utils.test.ts`.
  - [ ] 4.2 Manually inspect `http://localhost:3000/` on desktop after implementation and confirm there is no home left task queue drawer.
  - [ ] 4.3 Confirm the center scene is not covered by a large autopilot panel.
  - [ ] 4.4 Confirm the right drawer still has six tabs on home.
