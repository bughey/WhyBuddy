# Task List

## Tasks

- [ ] 1. Lock composer-only center expectations with tests
  - [ ] 1.1 Update `OfficeTaskCockpit.test.tsx` to assert exactly one `UnifiedLaunchComposer`.
  - [ ] 1.2 Add an assertion that the default center does not render a large autopilot guidance panel.
  - [ ] 1.3 Add or update launch tests so key composer actions remain visible.
  - [ ] 1.4 Run the targeted tests and confirm the large-panel absence assertion fails before implementation if the panel is still present.

- [ ] 2. Simplify the center composer stack
  - [ ] 2.1 In `OfficeTaskCockpit.tsx`, keep the composer in the center-bottom launcher stage.
  - [ ] 2.2 Remove default center rendering of non-composer autopilot guidance.
  - [ ] 2.3 Keep temporary clarification rendering above the composer only when `currentDialog` exists.
  - [ ] 2.4 Keep pending-launch status compact and avoid a large default panel.

- [ ] 3. Tune composer visual treatment
  - [ ] 3.1 Adjust the composer container to match the compact rounded reference shape.
  - [ ] 3.2 Ensure the send button is visually clear on the right side.
  - [ ] 3.3 Keep secondary actions compact and readable.
  - [ ] 3.4 Ensure action labels do not overlap at desktop and tablet widths.

- [ ] 4. Preserve launch functionality
  - [ ] 4.1 Verify attachment controls still work through existing callbacks.
  - [ ] 4.2 Verify create-task access remains present.
  - [ ] 4.3 Verify advanced/more actions remain present.
  - [ ] 4.4 Verify launch submission uses existing `UnifiedLaunchComposer` behavior.

- [ ] 5. Verify composer-only center
  - [ ] 5.1 Run `npx vitest run --pool=forks --poolOptions.forks.singleFork client/src/components/office/OfficeTaskCockpit.test.tsx client/src/components/launch/__tests__/LaunchPanelShell.test.tsx client/src/components/launch/__tests__/LaunchPanelIntegration.test.tsx`.
  - [ ] 5.2 Manually inspect home desktop and confirm the center shows only the compact composer over the scene.
  - [ ] 5.3 Update the UI progress SVG after implementation.
