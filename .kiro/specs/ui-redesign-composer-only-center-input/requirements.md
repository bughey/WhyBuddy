# Requirements Document

## Introduction

This follow-up spec covers the home center composer-only input treatment. The user provided a reference image showing a compact rounded composer with a single input row, send button, and action buttons below. The center of the home cockpit should no longer show a large autopilot card. It should keep only the composer surface and let the office scene remain visible.

This spec is separate from the home shell spec because the composer visual and interaction details need their own focused acceptance criteria.

## Requirements

### Requirement 1: Center Shows Only the Composer Surface

**User Story:** As a user on the home page, I want the center bottom area to show only the command input composer, so the office scene remains visible and uncluttered.

#### Acceptance Criteria

1. WHEN the home cockpit renders THEN the center-bottom surface SHALL show one compact composer.
2. WHEN the composer renders THEN it SHALL NOT be accompanied by a large autopilot guidance card in the center.
3. WHEN launch guidance is needed THEN it SHALL be available through the home right drawer `发起` tab.
4. WHEN runtime support context is expanded THEN it SHALL not permanently occupy the center as a large default panel.
5. THE composer SHALL remain usable with keyboard input and send action.

### Requirement 2: Match the Reference Composer Structure

**User Story:** As a user, I want the composer to look like the reference compact input bar, so the main action is visually clear.

#### Acceptance Criteria

1. THE composer surface SHALL use a rounded translucent container with restrained shadow and blur.
2. THE main input row SHALL include a placeholder-style prompt and a send icon/button on the right.
3. THE secondary action row SHALL include controls equivalent to add file, cite data, generate report, create new task, and more.
4. THE action buttons SHALL stay in one compact row on desktop where width allows.
5. WHEN text is long or viewport narrows THEN controls SHALL wrap or compact without overlapping.

### Requirement 3: Preserve Launch Composer Functionality

**User Story:** As a user, I want the simplified composer to keep the same launch capabilities, so visual cleanup does not reduce what I can submit.

#### Acceptance Criteria

1. THE implementation SHALL continue to use `UnifiedLaunchComposer` or its existing launch submission path.
2. THE composer SHALL keep attachment support.
3. THE composer SHALL keep data citation or equivalent context-reference support where currently available.
4. THE composer SHALL keep create-task access.
5. THE composer SHALL keep advanced/more actions where currently available.
6. THE implementation SHALL NOT create a second competing launch input.

### Requirement 4: Clarification and Pending Launch Behavior

**User Story:** As a user, I want clarification and pending-launch state to remain available without covering the center by default.

#### Acceptance Criteria

1. WHEN clarification is active THEN a clarification surface MAY appear above the composer.
2. WHEN clarification appears THEN it SHALL be temporary and clearly tied to the current command.
3. WHEN clarification is not active THEN no clarification panel SHALL occupy center space.
4. WHEN pending launch exists THEN status MAY be shown compactly in the composer or right drawer.
5. WHEN pending launch resolves THEN focus MAY return to task context without opening a left queue drawer.

### Requirement 5: Test and Visual Verification

**User Story:** As a developer, I want automated and visual checks for the composer-only center, so future layout work does not reintroduce large center panels.

#### Acceptance Criteria

1. THE implementation SHALL include a test asserting exactly one launch composer is rendered.
2. THE implementation SHALL include a test asserting the large center autopilot panel visual role is absent by default.
3. THE implementation SHALL include a test or smoke assertion for the composer action controls.
4. THE implementation SHALL include desktop screenshot review after code changes.
5. THE progress SVG SHALL be updated after this spec is implemented.
