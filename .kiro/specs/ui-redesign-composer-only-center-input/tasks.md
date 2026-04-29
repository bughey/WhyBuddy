# Task List

## Tasks

- [ ] 1. Lock composer-only center expectations with tests
  - [x] 1.1 Update `OfficeTaskCockpit.test.tsx` to assert exactly one `UnifiedLaunchComposer`.
  - [x] 1.2 Add an assertion that the default center does not render a large autopilot guidance panel.
  - [x] 1.3 Add or update launch tests so key composer actions remain visible.
  - [ ] 1.4 Run the targeted tests and confirm the large-panel absence assertion fails before implementation if the panel is still present.

- [x] 2. Simplify the center composer stack
  - [x] 2.1 In `OfficeTaskCockpit.tsx`, keep the composer in the center-bottom launcher stage.
  - [x] 2.2 Remove default center rendering of non-composer autopilot guidance.
  - [x] 2.3 Keep temporary clarification rendering above the composer only when `currentDialog` exists.
  - [x] 2.4 Keep pending-launch status compact and avoid a large default panel.

- [x] 3. Tune composer visual treatment
  - [x] 3.1 Adjust the composer container to match the compact rounded reference shape.
  - [x] 3.2 Ensure the send button is visually clear on the right side.
  - [x] 3.3 Keep secondary actions compact and readable.
  - [x] 3.4 Ensure action labels do not overlap at desktop and tablet widths.

- [x] 4. Preserve launch functionality
  - [x] 4.1 Verify attachment controls still work through existing callbacks.
  - [x] 4.2 Verify create-task access remains present.
  - [x] 4.3 Verify advanced/more actions remain present.
  - [x] 4.4 Verify launch submission uses existing `UnifiedLaunchComposer` behavior.

- [ ] 5. Verify composer-only center
  - [x] 5.1 Run `npx vitest run --pool=forks --poolOptions.forks.singleFork client/src/components/office/OfficeTaskCockpit.test.tsx client/src/components/launch/__tests__/LaunchPanelShell.test.tsx client/src/components/launch/__tests__/LaunchPanelIntegration.test.tsx`.
  - [ ] 5.2 Manually inspect home desktop and confirm the center shows only the compact composer over the scene.
  - [ ] 5.3 Update the UI progress SVG after implementation.
