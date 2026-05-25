# Implementation Plan: spec-first-stage-process-artifact-split-uniform

## Overview

Convert the corrected design into 5 sequential, independently-shippable batches.
Batches 1–3 alone fully resolve the user-reported bugs (clarification dup +
empty-lane shrink + preflight inconsistency); batches 4–5 generalize the new
unified mount surface to the 7 real fabric sub-stages
(`agent_crew_fabric / spec_tree / effect_preview / prompt_package /
runtime_capability / engineering_handoff / artifact_memory`).

Each batch ends with a checkpoint. Within a batch tasks may run in parallel
where they don't write to the same file. Implementation language: **TypeScript**
(matches the existing React 19 + Vitest + fast-check toolchain referenced by
the design).

The total mount surface is **11 sub-stages** = 4 preflight + 7 fabric. The
design's `STAGE_ARTIFACT_TYPES` table only references artifact types that exist
in the live `BlueprintGenerationArtifactType` union in
`shared/blueprint/contracts.ts`.

## Tasks

### Batch 1 — Clarification dedup fix (smallest scope, highest user-visible value)

- [x] 1.1 Create shared types module
  - Create `client/src/pages/autopilot/right-rail/stage-split-descriptor/types.ts`
  - Export `AnyStageSub` as the union of the 11 real sub-stages: 4 preflight
    (`target_input | intake_created | clarification | route`) plus the 7
    fabric values from `AutopilotRailSubStage` in `right-rail/types.ts`
    (`agent_crew_fabric | spec_tree | effect_preview | prompt_package |
    runtime_capability | engineering_handoff | artifact_memory`)
  - Export `LogicalArtifactKey` (non-empty string brand)
  - Export `StageSplitDescriptor` and `StageSplitDescriptorInput` based on the
    corrected 11-sub-stage model in this implementation plan. If the
    older 8-stage wording from earlier design revisions surfaces, prefer
    THIS plan's contract (it is the latest source of truth)
  - No runtime code in this module — types only
  - _Requirements: 1.2, 1.4_

- [x] 1.2 Implement `mergeLogicalArtifacts` and `computeLogicalArtifactKey`
  - Create `client/src/pages/autopilot/right-rail/stage-split-descriptor/merge-logical-artifacts.ts`
  - `computeLogicalArtifactKey` covers the 7-row table from design.md
    Component 4. **Verified clarification fallback chain** (the local
    artifact stores `payload: clarificationSession` whose field is `id`,
    not `sessionId`; the server artifact stores `payload.sessionId`):
    ```
    clarification_session →
      "clar:" + (
        payload.sessionId ??
        payload.id ??                                   // local rich payload
        parseSessionFromArtifactId(artifact.id) ??      // "clarification-session-${id}"
        artifact.id
      )
    ```
    where `parseSessionFromArtifactId` strips the
    `clarification-session-` prefix when present. If none of those values
    yields a non-empty key, the row falls through to `id:${id}` (and
    missing/empty `id` returns a non-empty placeholder so unmergeable rows
    pass through unchanged). Other 6 rows (`route_set / route_selection /
    spec_tree / intake / github_source / project_context`) follow design.md
    Component 4 verbatim
  - `mergeLogicalArtifacts` is O(n) using a `Map<LogicalArtifactKey, …>` and
    a parallel insertion-order array so output preserves first-seen order
  - Payload precedence per design.md (local representative wins on key
    conflicts): `id / title / summary / type` from representative;
    `staleSince / invalidatedBy` from server when present, otherwise from
    representative; `createdAt` = earlier of the two; `payload =
    { ...(server.payload ?? {}), ...(representative.payload ?? {}) }` so
    server payload only fills missing keys and never overwrites local
  - **Caller-ordering contract** — `mergeLogicalArtifacts` itself does NOT
    infer which artifact came from local vs. server. It treats the
    first-seen artifact for any given `LogicalArtifactKey` as the
    representative. **All callers that expect local-rich payload precedence
    MUST pass local artifacts BEFORE job artifacts**, i.e.
    `mergeLogicalArtifacts([...localArtifacts, ...jobArtifacts])`. Document
    this contract in the function's JSDoc; lint-grade enforcement is not
    in scope for this batch but the JSDoc must call it out explicitly so
    Batch 4/5 fabric callers don't silently flip the order
  - Empty-array input returns `[]`; never throws
  - _Requirements: 2.3, 4.1, 4.2, 4.3, 4.4, 4.6_

- [x] 1.2a Pre-extract `buildPreflightArtifactEntries` and
  `buildPreflightExecutionFallbackEntries` (early move from Batch 3)
  - **Why early**: 1.3 lands `mergeLogicalArtifacts` inside
    `buildPreflightArtifactEntries`, and 1.7 tests the builder from a
    new test file under the `stage-split-descriptor/` module. Both
    require the function to live in its standalone module — keeping the
    extraction in Batch 3 would block the user-facing fix on a refactor.
    This task moves the original Batch 3.1 / 3.2 work earlier so Batch 1
    is independently shippable
  - Move the inline `buildPreflightArtifactEntries` (currently ~line 676 of
    `client/src/pages/autopilot/AutopilotRoutePage.tsx`) into
    `client/src/pages/autopilot/right-rail/stage-split-descriptor/build-preflight-artifact-entries.ts`
  - Move the inline `buildPreflightExecutionFallbackEntries` (currently
    ~line 594) into
    `client/src/pages/autopilot/right-rail/stage-split-descriptor/build-preflight-execution-fallback-entries.ts`
  - **Behavior bit-for-bit identical**: do not change function bodies,
    parameter shapes, or return-shape in this task. Only physical
    relocation + same-name re-exports. The `mergeLogicalArtifacts` call
    is added separately in 1.3
  - Update all 6 preflight callsites in `AutopilotRoutePage.tsx` to import
    the functions from the new modules (still 6 sites; same JSX shape)
  - The new modules MUST NOT import from `AutopilotRoutePage.tsx` — that
    avoids the `right-rail/` ↔ `AutopilotRoutePage.tsx` cyclic dependency
    described in design.md Component 0
  - **Note on Batch 3 follow-ups**: Batch 3.1 / 3.2 (which originally owned
    this extraction) become no-ops. Their wave entries are kept in the
    dependency graph but tagged as "covered by 1.2a" — Batch 3 then
    proceeds directly to 3.3 (the `target_input` branch addition)
  - _Requirements: 1.3_

- [x] 1.3 Land `mergeLogicalArtifacts` inside the extracted
  `buildPreflightArtifactEntries`
  - **Prerequisite**: 1.2a (extract) must complete before this task. After
    1.2a, `buildPreflightArtifactEntries` lives in
    `client/src/pages/autopilot/right-rail/stage-split-descriptor/build-preflight-artifact-entries.ts`
  - **Verified callsite shape**: the existing 6 callsites only pass
    `artifacts={buildPreflightArtifactEntries({...})}`; they do NOT have
    access to `localArtifacts` directly. The function itself already
    concatenates `[...localArtifacts, ...jobArtifacts]` near the bottom of
    its body
  - In the extracted module, change the final `return [...localArtifacts,
    ...jobArtifacts]` to `return mergeLogicalArtifacts([...localArtifacts,
    ...jobArtifacts])`. **Argument order is binding** — `localArtifacts`
    MUST come first so the local representative wins on payload conflicts
    per the contract documented in 1.2
  - **Keep the existing `seenIds`-based id-literal filter for now** (Batch 1
    minimal-change). This means same-id duplicates don't reach
    `mergeLogicalArtifacts`, but cross-id same-`logicalKey` duplicates
    (the actual clarification bug) are now collapsed. Batch 3.1 revisits
    this and lifts literal-id dedup into `mergeLogicalArtifacts` itself
    so backend stale fields can merge into local representatives that
    happen to share an id
  - This is the minimal landing for the clarification dup bug and avoids
    duplicating filter logic across 6 JSX callsites
  - _Requirements: 2.3, 3.1, 3.3, 4.5_

- [x] 1.4 Write unit tests for `computeLogicalArtifactKey` edge cases
  - Test file: `client/src/pages/autopilot/right-rail/stage-split-descriptor/__tests__/compute-logical-artifact-key.test.ts`
  - **Clarification fallback chain** (covers the verified asymmetry between
    local and server payload shapes):
    - (a) `payload.sessionId === "S-1"` (server-shape) → key is `clar:S-1`
    - (b) `payload.sessionId` missing but `payload.id === "S-1"`
      (local-shape: `payload: clarificationSession`) → key is `clar:S-1`
      (uses `payload.id` so local artifact and server artifact for the same
      session collide)
    - (c) Both `payload.sessionId` and `payload.id` missing but
      `artifact.id === "clarification-session-S-1"` → key is `clar:S-1`
      (parsed from artifact id prefix)
    - (d) All three missing → falls back to `id:${id}`
  - Other coverage: missing/empty `id` returns a non-empty placeholder key
    (so unmergeable rows still pass through); unknown `type` falls back
    to `id:${id}`; stable across calls (no `Date.now()` / random)
  - _Requirements: 4.3, 4.4_

- [x] 1.5 Write unit test for `mergeLogicalArtifacts` representative id and key conflict
  - Test file: `client/src/pages/autopilot/right-rail/stage-split-descriptor/__tests__/merge-logical-artifacts.unit.test.ts`
  - Case A: input `[localArtifact, serverArtifact]` (in that order, both
    `type === "clarification_session"` with the same `payload.sessionId`)
    → `output.length === 1` AND `output[0].id ===
    \`clarification-session-${sessionId}\``
  - Case B: payload key conflict — local has
    `payload: { sessionId, questions, answers }`, server has
    `payload: { sessionId, summary }` → merged payload contains
    `questions, answers, summary` and `sessionId` equals the local value
    (local wins on the conflicting key)
  - Case C: empty input array → `[]`, no throw
  - _Requirements: 2.3, 4.1, 4.2, 4.6_

- [x]* 1.6 Write property-based test for `mergeLogicalArtifacts`
  - Test file: `client/src/pages/autopilot/right-rail/stage-split-descriptor/__tests__/merge-logical-artifacts.pbt.test.ts`
  - **Property 3 (idempotence):** for any generated artifact array `xs`,
    `mergeLogicalArtifacts(mergeLogicalArtifacts(xs))` deep-equals
    `mergeLogicalArtifacts(xs)`
  - **Property 4 (same-key collapse):** force every input to
    `type === "clarification_session"` with the same fixed
    `payload.sessionId` and assert ONLY `output.length === 1`. Do NOT assert
    a literal representative `id` here — the PBT must remain agnostic of
    which input wins because fast-check shrinkers can produce inputs in
    either order
  - _Property: P3, P4_
  - _Requirements: 2.3, 4.1, 4.2_

- [x] 1.7 Write builder-level integration test for clarification dedup
  - Test file: `client/src/pages/autopilot/right-rail/stage-split-descriptor/__tests__/build-preflight-artifact-entries.clarification-dedup.test.ts`
  - **Required (not optional)** — this is the user-facing fix for the
    duplicate-clarification-card bug. Test against the builder, not the
    full page, so it does not depend on router / store / API mocks
  - Build a `clarificationSession` with id `S-123` plus a `latestJob` whose
    `artifacts` includes one `type: "clarification_session"` entry with
    `payload.sessionId === "S-123"` AND a synthetic backend id (e.g.
    `blueprint-artifact-9f2c`)
  - Call `buildPreflightArtifactEntries({ sub: "clarification",
    clarificationSession, /* other inputs nullish */, job: latestJob })`
  - Assert:
    - `output.filter(a => a.type === "clarification_session").length === 1`
    - `output[0].id === "clarification-session-S-123"` (local rep wins)
    - `output[0].payload.questions` and `output[0].payload.answers` are
      preserved from the local rich payload (not erased by sparse server
      payload)
  - _Property: P8_
  - _Requirements: 2.3_

- [x]* 1.7a Write full-page DOM integration test for clarification dedup
  - **Optional** — broad page render is implementation-cost-heavy because
    `AutopilotRoutePage` requires router / store / API mocks; the
    builder-level test in 1.7 is the required gate
  - Test file: `client/src/pages/autopilot/__tests__/AutopilotRoutePage.clarification-dedup.test.tsx`
  - Render `<AutopilotRoutePage />` with both a local `clarificationSession`
    (id `S-123`) AND a server-pushed `latestJob.artifacts` entry of
    `type: "clarification_session"` with `payload.sessionId: "S-123"`
  - Assert exactly 1 clarification card is rendered in the DOM
  - _Property: P8_
  - _Requirements: 2.3_

- [x] 1.8 Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Batch 2 — ProcessArtifactSplitPanel placeholder upgrade (lane stability)

- [x] 2.1 Add new opt-in props to `ProcessArtifactSplitPanel`
  - Edit `client/src/pages/autopilot/right-rail/ProcessArtifactSplitPanel.tsx`
  - Add `showEmptyPlaceholder?: boolean` (default `true`),
    `emptyExecutionLabel?: string`, `emptyArtifactLabel?: string` to the
    public props
  - Backward compatible: existing 6 preflight callsites continue to work
    unchanged with the new `true` default; passing `false` falls back to the
    historical `<EmptyLane>` single-line behavior
  - Both lane containers (`data-testid="autopilot-process-execution-lane"`,
    `data-testid="autopilot-process-artifact-lane"`) MUST always be in the
    DOM, regardless of `showEmptyPlaceholder`
  - _Requirements: 2.5, 2.6, 2.7_

- [x] 2.2 Implement `<ExecutionPlaceholderCard>` and `<ArtifactPlaceholderCard>`
  - Add both placeholder components in the same file as 2.1 (or a private
    sibling; the design requires them to be co-located with the panel)
  - Visual: rounded + border + padding matching real card density;
    skeleton-tone (`bg-slate-50`, `text-slate-400`, `border-slate-200`)
  - Accessibility: `aria-busy="true"`
  - **Stable testids (binding contract)** — React component names do NOT
    appear in `renderToStaticMarkup` output, so tests must select on
    DOM-level attributes:
    - `<ExecutionPlaceholderCard>` MUST render an outer element with
      `data-testid="autopilot-process-execution-placeholder"`
    - `<ArtifactPlaceholderCard>` MUST render an outer element with
      `data-testid="autopilot-process-artifact-placeholder"`
    - These testids are part of the public contract for 2.4 and any
      downstream regression
  - Default labels driven by locale (`zh-CN` / `en-US`), overridable via the
    `emptyExecutionLabel` / `emptyArtifactLabel` props from 2.1
  - When `showEmptyPlaceholder !== false` and a lane has zero cards, render
    exactly one placeholder of the matching kind in that lane
  - _Requirements: 2.1, 2.2, 2.5, 2.6_

- [x] 2.3 Write lane stability test
  - Extend `client/src/pages/autopilot/right-rail/__tests__/ProcessArtifactSplitPanel.test.tsx`
  - Render the panel under all 4 input combinations
    (`artifacts ∈ {empty, non-empty} × reasoningEntries ∈ {empty, non-empty}`)
    and assert both `data-testid` lane containers are present in every case
  - Existing tests in this file MUST keep passing unchanged (regression
    guard)
  - _Property: P1_
  - _Requirements: 2.5, 2.6_

- [x] 2.4 Write empty-placeholder semantics test
  - Same test file as 2.3
  - Select on the placeholder testids defined in 2.2:
    `[data-testid="autopilot-process-execution-placeholder"]` and
    `[data-testid="autopilot-process-artifact-placeholder"]`. Do NOT
    assert on React component names — they don't appear in static markup
  - Case A: empty inputs + `showEmptyPlaceholder` defaulted/`true` →
    `getAllByTestId("autopilot-process-execution-placeholder")` returns
    exactly 1 node, same for the artifact placeholder testid
  - Case B: empty inputs + `showEmptyPlaceholder={false}` → no nodes
    matching either placeholder testid, but BOTH lane testids
    (`autopilot-process-execution-lane`,
    `autopilot-process-artifact-lane`) remain present in the DOM
    (validates Requirement 2.7's stable structure under all branches)
  - _Property: P2_
  - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7_

- [x] 2.5 Write `WorkbenchExecutionPanel` non-regression test (new baseline)
  - Test file: `client/src/pages/autopilot/right-rail/streaming-doc/workbench/__tests__/WorkbenchExecutionPanel.regression.test.tsx`
  - Per design.md and Requirement 3.4–3.5 (and P9), the public props of
    `WorkbenchExecutionPanel` do NOT add a `showEmptyPlaceholder` switch;
    the new placeholder cards become the visual baseline for empty data
  - Case A (non-empty data): render with non-empty `reasoning` AND non-empty
    `artifacts`; assert structural equivalence to the historical baseline
    (lane testids, ordered card list, className tokens) — i.e. NO
    regression
  - Case B (empty data, NEW BASELINE): render with empty `reasoning` AND
    empty `artifacts`; assert that the new placeholder cards appear
    (`<ExecutionPlaceholderCard>` + `<ArtifactPlaceholderCard>`). Do NOT
    compare against the historical empty baseline — the new placeholders ARE
    the new baseline
  - _Property: P9_
  - _Requirements: 3.4, 3.5_

- [x] 2.6 Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Batch 3 — Preflight descriptor unification

- [x] 3.1 ~~Extract `buildPreflightArtifactEntries` into its own module~~
  **Covered by 1.2a — no-op in Batch 3.** The extraction was pulled forward
  to Batch 1 because 1.3 and 1.7 both depend on the extracted module.
  Mark this task complete by checking that:
  - `client/src/pages/autopilot/right-rail/stage-split-descriptor/build-preflight-artifact-entries.ts`
    exists
  - `AutopilotRoutePage.tsx` imports `buildPreflightArtifactEntries` from
    that path (no inline definition remains)
  - `right-rail/` does not import from `AutopilotRoutePage.tsx`
  - _Requirements: 1.3 (already satisfied by 1.2a)_

- [x] 3.2 ~~Extract `buildPreflightExecutionFallbackEntries` into its own module~~
  **Covered by 1.2a — no-op in Batch 3.** The extraction was pulled forward
  to Batch 1 alongside `buildPreflightArtifactEntries`.
  Mark this task complete by checking that:
  - `client/src/pages/autopilot/right-rail/stage-split-descriptor/build-preflight-execution-fallback-entries.ts`
    exists
  - `AutopilotRoutePage.tsx` imports
    `buildPreflightExecutionFallbackEntries` from that path
  - _Requirements: 1.3 (already satisfied by 1.2a)_

- [x] 3.3 Add `target_input` branch to the extracted preflight builder
  - In the file from 3.1, add a `sub === "target_input"` branch that returns
    `[]` (no local artifacts before intake exists)
  - Existing 3 preflight branches keep behavior unchanged (regression
    guard)
  - _Requirements: 1.1, 1.2, 2.1_

- [x] 3.4 Create preflight-only `STAGE_ARTIFACT_TYPES` table (with hard
  fabric stub guard)
  - Create `client/src/pages/autopilot/right-rail/stage-split-descriptor/stage-artifact-types.ts`
  - Export `STAGE_ARTIFACT_TYPES: Record<AnyStageSub, readonly
    BlueprintGenerationArtifactType[]>` populated for the 4 preflight subs
    only, using the exact values from design.md Data Model 2:
    `target_input: []`, `intake_created: ["intake", "github_source",
    "project_context", "sandbox_derivation_job"]`, `clarification:
    ["clarification_session"]`, `route: ["route_set", "route_selection",
    "spec_tree"]`
  - **Fabric subs are temporary stubs** — each fabric sub maps to `[]` so
    the `Record<AnyStageSub, ...>` type still type-checks. Add this exact
    comment block above the fabric entries:
    ```ts
    // ⚠️ Batch 4 stub: these empty arrays exist ONLY so this file
    // type-checks before Batch 4 lands. They MUST NOT be used to drive
    // any UI mount: deriveStageSplitDescriptor (3.5) returns
    // shouldMount: false for fabric subs until Batch 4 (4.4) replaces
    // both this table and the fabric guard simultaneously. Do not
    // schedule Batch 5 mount tasks against a sub whose entry here is
    // still []; that would route fabric job artifacts through an empty
    // whitelist and surface as "no artifacts" in the Artifact_Lane.
    ```
  - _Requirements: 1.4, 4.5_

- [x] 3.5 Implement pure `deriveStageSplitDescriptor`
  - Create `client/src/pages/autopilot/right-rail/stage-split-descriptor/derive-stage-split-descriptor.ts`
  - Pure function `deriveStageSplitDescriptor(input: StageSplitDescriptorInput):
    StageSplitDescriptor` matching the algorithm in design.md "Algorithmic
    Pseudocode"
  - For preflight subs, call `buildPreflightArtifactEntries` and
    `buildPreflightExecutionFallbackEntries` (imported from the modules
    extracted in 1.2a)
  - For fabric subs, return a deterministic guard descriptor:
    `{ ...descriptor, shouldMount: false, artifacts: [],
    fallbackExecutionEntries: [] }` with a `// TODO Batch 4` source
    comment that points at the fabric routing change in 4.4. **No
    `console.warn` / no logging / no side effects** — this function is
    a pure function and stays test-stable. Batch 4 (4.4) replaces the
    guard with the real fabric routing
  - Whitelist filter via `STAGE_ARTIFACT_TYPES[sub]` and call
    `mergeLogicalArtifacts([...local, ...allowedJobArtifacts])` (local
    first — see the caller-ordering contract in 1.2)
  - `route` returns `stageFilter = ["route_generation", "route_selection",
    "spec_tree"]`; other preflight subs return `sub` itself. (Batch 4
    introduces `STAGE_FILTER_BY_SUB` (4.1a) and replaces this inline
    branch — Batch 3's inline form is acceptable as a stepping stone)
  - `shouldMount = isActive || isCompleted || sub === "route"` for preflight;
    fabric returns `false` until Batch 4
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 2.3, 3.2, 4.5_

- [x] 3.6 Implement `useStageSplitDescriptor`
  - Create `client/src/pages/autopilot/right-rail/stage-split-descriptor/use-stage-split-descriptor.ts`
  - Thin `useMemo` wrapper around `deriveStageSplitDescriptor(input)`; the
    `useMemo` deps array references the input fields by `Object.is` identity
    so unchanged `latestJob.artifacts` references skip recomputation
  - Add a docblock that mirrors the design.md "Performance Considerations"
    Rules-of-Hooks risk: callers MUST use either pattern (a) — flatly call
    the hook once per sub at top level, in fixed order — or pattern (b) —
    call `useMemo` once with `deriveStageSplitDescriptor` invoked per sub
    inside. The hook MUST NOT be called inside conditionals, loops, or
    `case` branches
  - _Requirements: 1.1, 1.2_

- [x] 3.7 Implement `<StageSplitMount>`
  - Create `client/src/pages/autopilot/right-rail/StageSplitMount.tsx`
  - Props: `{ descriptor, job, locale, variant: "active" | "completed" }`
  - Returns `null` when `descriptor.shouldMount === false`
  - Otherwise renders `<ProcessArtifactSplitPanel>` with
    `artifacts={descriptor.artifacts}`, `stageFilter={descriptor.stageFilter}`,
    `artifactTypes={descriptor.artifactTypes}`,
    `fallbackExecutionEntries={descriptor.fallbackExecutionEntries}`,
    `locale`, `job`
  - Adds `data-testid={\`autopilot-stage-split-mount-${descriptor.sub}-${variant}\`}`
    to the outer container for regression visibility
  - No new network calls, no new state
  - _Requirements: 1.3_

- [x] 3.8 Migrate the 4 preflight sub-stage callsites to `<StageSplitMount>`
  - In `AutopilotRoutePage.tsx`, replace each `<ProcessArtifactSplitPanel
    artifacts={buildPreflightArtifactEntries(...)} ... />` invocation
    (currently 6 callsites: 3 preflight subs × {active, completed}) with
    `<StageSplitMount descriptor={...} job={latestJob} locale={locale}
    variant={...} />`
  - Add the `target_input` active-state mount (currently absent — this is
    the new mount that satisfies 2.1)
  - Hooks are called at top level only. Pick one of the design.md compliant
    patterns: either 4 explicit top-level `useStageSplitDescriptor` calls in
    fixed order, OR a single top-level `useMemo` that builds an object
    keyed by `AnyStageSub` and invokes `deriveStageSplitDescriptor` per sub.
    Do NOT call the hook inside `.map()`, `&&` short-circuits, or `case`
    branches
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_

- [x] 3.9 Update `StoreObservabilityHud.test.tsx` source-level regex
  - Edit `client/src/pages/autopilot/right-rail/__tests__/StoreObservabilityHud.test.tsx`
  - Replace the literal-count regex `source.match(/<ProcessArtifactSplitPanel\b/g)`
    `>= 6` assertion with presence assertions:
    (a) the source imports `useStageSplitDescriptor` from
    `./stage-split-descriptor/use-stage-split-descriptor` (or equivalent path);
    (b) the source contains at least one `<StageSplitMount\b` occurrence.
    Do NOT invent a literal count like "≥ 14 `<StageSplitMount>`" — after
    unification it is acceptable for the source to contain the component
    once inside a single `Object.entries(descriptors).map(...)` rendering
  - Replace the legacy 3 `expect(source).toMatch(...)` assertions
    (`isActive && sub === "intake_created"` etc.) with assertions that the
    descriptor object literal/computation references each preflight sub
    name and that `STAGE_ARTIFACT_TYPES.<sub>` (or the new module's export)
    is referenced. Drop assertions that hard-code
    `<ProcessArtifactSplitPanel>` JSX shape
  - _Requirements: 1.3, 3.1_

- [ ]* 3.10 Write whitelist-filtering property test
  - Test file: `client/src/pages/autopilot/right-rail/stage-split-descriptor/__tests__/derive-stage-split-descriptor.pbt.test.ts`
  - **Property 6 (whitelist):** for any preflight `sub` and any generated
    `job.artifacts`, every entry in `deriveStageSplitDescriptor(input).artifacts`
    has its `type` member of `STAGE_ARTIFACT_TYPES[sub]`. Foreign types are
    silently dropped, no throw
  - _Property: P6_
  - _Requirements: 1.4, 1.5, 4.5_

- [ ]* 3.11 Write `shouldMount` property test for preflight
  - Same test file as 3.10
  - **Property 7 (active mounts):** for every preflight `sub` and any input
    where `isActive === true`, `deriveStageSplitDescriptor(input).shouldMount
    === true`
  - _Property: P7_
  - _Requirements: 1.1, 2.1, 2.2_

- [ ]* 3.12 Write integration test for the migrated preflight surface
  - Test file: `client/src/pages/autopilot/__tests__/AutopilotRoutePage.uniform-mount.preflight.test.tsx`
  - Case A: `target_input` active state renders the two-column layout —
    both lane testids present, right lane shows exactly one
    `<ArtifactPlaceholderCard>`
  - Case B: clarification submission still produces exactly 1
    clarification card in the rendered DOM after the migration (regression
    of 1.7 against the new mount path)
  - _Requirements: 1.3, 2.1, 2.3_

- [x] 3.13 Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Batch 4 — Real fabric mapping table (data only, no UI mounts)

- [x] 4.1 Extend `STAGE_ARTIFACT_TYPES` with the 7 real fabric sub-stages
  - Edit `client/src/pages/autopilot/right-rail/stage-split-descriptor/stage-artifact-types.ts`
  - Replace the Batch-3 stub entries with the corrected live-contract
    mapping (do NOT consult earlier design.md revisions whose fabric table
    was based on the wrong sub-stage list):
    - `agent_crew_fabric: ["agent_crew", "role_timeline"]`
    - `spec_tree: ["spec_tree", "spec_tree_version", "spec_document_version", "requirements", "design", "tasks"]`
    - `effect_preview: ["preview", "effect_preview"]`
    - `prompt_package: ["prompt_pack"]`
    - `runtime_capability: ["capability_registry", "capability_invocation", "capability_evidence"]`
    - `engineering_handoff: ["engineering_plan", "engineering_run"]`
    - `artifact_memory: ["replay", "feedback"]`
  - **Note on `capability_registry` placement** — the server's
    `dependency-graph.ts` maps `capability_registry → runtime_capability`,
    so the registry belongs in the `runtime_capability` whitelist (not
    `agent_crew_fabric`). If the same artifact type legitimately appears
    in both stages in production data, the cross-stage handling is the
    `stageFilter` (per the new `STAGE_FILTER_BY_SUB` table, see 4.1a),
    not type-level multi-membership
  - Verify each value compiles against
    `BlueprintGenerationArtifactType` from `shared/blueprint/contracts.ts`
    (no type assertion or `as const` widening tricks)
  - Remove the stub-warning comment block introduced in 3.4 once the real
    values land
  - _Requirements: 1.4, 4.5_

- [x] 4.1a Create `STAGE_FILTER_BY_SUB` mapping (sub-stage → reasoning stageId)
  - Create `client/src/pages/autopilot/right-rail/stage-split-descriptor/stage-filter-by-sub.ts`
  - **Verified mismatch**: the server emits reasoning events with
    `stageId === "prompt_packaging"` (see `shared/blueprint/contracts.ts`
    `BlueprintGenerationStage` and `server/routes/blueprint.ts`), while the
    fabric sub-stage is named `prompt_package`. If
    `deriveStageSplitDescriptor` returns the sub literal as `stageFilter`
    for fabric, the prompt-package execution lane will silently fail to
    match server reasoning events. Same risk applies to any other
    sub-stage where the rail name and the server stage name diverge
  - Export `STAGE_FILTER_BY_SUB: Record<AnyStageSub, string | readonly
    string[]>` with this concrete mapping:
    ```ts
    target_input:        "target_input",
    intake_created:      "intake_created",
    clarification:       "clarification",
    route:               ["route_generation", "route_selection", "spec_tree"],
    agent_crew_fabric:   "agent_crew_fabric",
    spec_tree:           "spec_tree",
    effect_preview:      "effect_preview",
    prompt_package:      "prompt_packaging",          // ← server stageId
    runtime_capability:  "runtime_capability",
    engineering_handoff: "engineering_handoff",
    artifact_memory:     "artifact_memory",
    ```
  - Update `deriveStageSplitDescriptor` (3.5 + 4.4) to read `stageFilter`
    from this table instead of inlining `sub === "route" ? [...] : sub`
  - _Requirements: 1.6, 3.2_

- [x]* 4.1b Write unit tests for `STAGE_FILTER_BY_SUB`
  - Verify every `AnyStageSub` key is present (compile-time `Record` plus
    a runtime check against `RAIL_SUB_STAGE_ORDER` + the 4 preflight
    names)
  - Verify `prompt_package` maps to `"prompt_packaging"` (not
    `"prompt_package"`) and `route` maps to the 3-stage array
  - _Requirements: 1.6, 3.2_

- [x] 4.2 Implement `buildFabricArtifactEntries` (local-derived only;
  does NOT read `job.artifacts`)
  - Create `client/src/pages/autopilot/right-rail/stage-split-descriptor/build-fabric-artifact-entries.ts`
  - **Scope decision (avoids double-counting)**: the descriptor pipeline
    already filters and merges `job.artifacts` once via the upstream
    whitelist + `mergeLogicalArtifacts` step in `deriveStageSplitDescriptor`
    (see 4.4). If this builder also reads `job.artifacts`, the same rows
    enter the merge twice and rely on logical-key dedup to compress them —
    that works for keyed types but is brittle for any new fabric type
    without a logical key. Therefore this builder is **local-derived only**
  - Initial implementation: `({ sub, job }) => []` for all 7 fabric subs.
    `job` is accepted in the signature for forward compatibility (so a
    future fabric sub that needs derived-from-job artifacts can populate
    them without a signature change), but the body returns `[]`
  - Signature exactly per design.md "Key Functions with Formal
    Specifications": `({ sub, job }: { sub: FabricSub; job:
    BlueprintGenerationJob | null }) => BlueprintGenerationArtifact[]`
  - Never throws on a `null` truth source
  - _Requirements: 1.4, 1.5, 4.5_

- [x] 4.3 Implement `buildFabricExecutionFallbackEntries`
  - Create `client/src/pages/autopilot/right-rail/stage-split-descriptor/build-fabric-execution-fallback-entries.ts`
  - Signature: `({ sub, locale, job }) =>
    ProcessArtifactFallbackExecutionEntry[]`
  - Returns a single info-toned fallback entry per fabric sub when `job` is
    non-null but no artifacts are present yet
  - Returns `[]` when `job === null`
  - Locale strings follow the design.md examples (e.g. `spec_tree` →
    `"正在派生 SPEC 资产树…"` / `"Deriving SPEC asset tree…"`)
  - **`stageId` is binding** — read it from `STAGE_FILTER_BY_SUB[sub]`
    (see 4.1a). For fabric subs the value is a plain string and is used
    as-is; if a future fabric sub is mapped to an array, take the first
    element (current fabric mappings are all string-valued). **Critical
    case**: `prompt_package`'s fallback entry MUST set
    `stageId: "prompt_packaging"` (the server-side stageId), NOT
    `stageId: "prompt_package"` — otherwise the fallback gets filtered
    out by `ProcessArtifactSplitPanel` because the panel filters
    reasoning/fallback entries by the descriptor's `stageFilter`. The
    same rule applies to any other sub whose `STAGE_FILTER_BY_SUB` value
    differs from the literal sub name
  - _Requirements: 1.4, 1.6, 3.2_

- [x] 4.4 Route fabric subs through `deriveStageSplitDescriptor`
  - Edit `client/src/pages/autopilot/right-rail/stage-split-descriptor/derive-stage-split-descriptor.ts`
  - Replace the Batch-3 fabric guard (`shouldMount: false` + warn) with
    real routing. **Single-source rule**: `job.artifacts` is filtered and
    merged exactly once, here in the descriptor — the fabric builder does
    not read it (see 4.2):
    ```ts
    const local = buildFabricArtifactEntries({ sub, job });   // []
    const allowedTypes = new Set(STAGE_ARTIFACT_TYPES[sub]);
    const jobArtifacts = (job?.artifacts ?? [])
      .filter(a => allowedTypes.has(a.type));
    const merged = mergeLogicalArtifacts([...local, ...jobArtifacts]);
    ```
  - Also read `stageFilter` from the new `STAGE_FILTER_BY_SUB` table
    (see 4.1a) instead of inlining the `route` special case — both
    preflight and fabric branches go through the same lookup
  - Run `buildFabricExecutionFallbackEntries` for the fallback entries
  - `shouldMount = isActive || isCompleted` for fabric (no special override
    is needed — `route` is preflight)
  - Remove the `// TODO Batch 4` source comment introduced by the 3.5
    guard descriptor (3.5 does not introduce a `console.warn`, so nothing
    to remove there)
  - _Requirements: 1.1, 1.2, 1.6, 3.2_

- [ ]* 4.5 Write fabric builder + descriptor whitelist tests
  - Test file: `client/src/pages/autopilot/right-rail/stage-split-descriptor/__tests__/build-fabric-artifact-entries.test.ts`
  - **Builder-level (matches the 4.2 `[]`-only contract)**: for each of
    the 7 fabric subs:
    - `job === null` → `buildFabricArtifactEntries({ sub, job })` returns
      `[]` and does not throw
    - `job` non-null with artifacts → `buildFabricArtifactEntries({ sub,
      job })` STILL returns `[]` (this builder is local-derived only;
      `job.artifacts` filtering happens in `deriveStageSplitDescriptor`,
      see 4.4). Asserting "builder returns job artifacts" would
      contradict the 4.2 scope decision and create a double-read
    - `buildFabricExecutionFallbackEntries({ sub, locale: "zh-CN", job })`
      and `("en-US", …)` both return non-empty entries when `job`
      non-null and `[]` when `job === null`. For `prompt_package`,
      assert `entries[0].stageId === "prompt_packaging"`
  - **Descriptor-level (where `job.artifacts` actually flows)**: in a
    second test file
    `client/src/pages/autopilot/right-rail/stage-split-descriptor/__tests__/derive-stage-split-descriptor.fabric.test.ts`,
    for each fabric sub:
    - `job` with an artifact whose `type` IS in
      `STAGE_ARTIFACT_TYPES[sub]` → that artifact appears in
      `deriveStageSplitDescriptor(input).artifacts`
    - `job` with an artifact whose `type` is NOT in the whitelist →
      that artifact is silently dropped (no throw, not in output)
  - _Requirements: 1.4, 1.5, 4.5_

- [x] 4.6 Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Batch 5 — Fabric mount rollout (incremental, one sub-stage at a time)

- [x] 5.1 Mount `<StageSplitMount>` for `spec_tree`
  - In `AutopilotRoutePage.tsx`, add the `<StageSplitMount>` for the
    `spec_tree` fabric sub-stage, both `active` and `completed` cards
  - **Mount placement (binding for all of 5.1–5.4)**: place
    `<StageSplitMount>` BELOW the existing sub-stage primary panel content,
    INSIDE the same sub-stage card body. Do NOT:
    - nest it inside another `<ProcessArtifactSplitPanel>` (would
      double-wrap two two-column layouts)
    - replace the existing fabric panel routing (`SpecTreePanel`,
      `EffectPreviewPanel`, etc. continue to render their canonical
      content)
    - lift it into a sibling card that competes with the existing panel
      for vertical space (would inflate the page)
    - change `AutopilotRightRail`'s panel selection contract — this
      feature only adds a process-artifact split below each fabric panel,
      it does not refactor right-rail routing
  - Hooks at top level only — extend the descriptor map from 3.8 to include
    `spec_tree` so the call pattern remains compliant with Rules of Hooks
  - Run focused vitest for `client/src/pages/autopilot/**` and
    `client/src/pages/autopilot/right-rail/**` before moving on
  - _Requirements: 1.1, 1.6_

- [x] 5.2 Mount `<StageSplitMount>` for `effect_preview` and `prompt_package`
  - Same approach as 5.1, adding two more fabric subs to the descriptor
    map and rendering their `active`/`completed` mounts
  - Run focused vitest before moving on
  - _Requirements: 1.1, 1.6_

- [x] 5.3 Mount `<StageSplitMount>` for `runtime_capability`,
  `engineering_handoff`, and `artifact_memory`
  - Same approach as 5.1, adding the remaining three fabric subs
  - Run focused vitest before moving on
  - _Requirements: 1.1, 1.6_

- [x] 5.4 Mount `<StageSplitMount>` for `agent_crew_fabric`
  - Last fabric sub-stage to migrate. After this task all 11 sub-stages are
    served by the unified mount surface
  - Run focused vitest before moving on
  - _Requirements: 1.1, 1.6_

- [ ]* 5.5 Write full structural integration test for all 11 sub-stages
  - Test file: `client/src/pages/autopilot/__tests__/AutopilotRoutePage.uniform-mount.all-stages.test.tsx`
  - Render `<AutopilotRoutePage />` under representative store states. The
    assertion is **structural**, NOT a literal mount count: for every
    sub-stage that the page chooses to render (active OR completed), the
    rendered DOM contains both
    `data-testid="autopilot-process-execution-lane"` and
    `data-testid="autopilot-process-artifact-lane"`. Do NOT assert
    "≥ 22 `<StageSplitMount>` instances" or any other rigid mount count
  - Also asserts `descriptor.artifacts` contains no entry whose `type` is
    outside the relevant `STAGE_ARTIFACT_TYPES[sub]` whitelist
  - _Property: P1, P6_
  - _Requirements: 1.1, 1.4, 2.5, 2.6_

- [x] 5.6 Verify and append cross-references to `design.md`
  - Run the repo's verified typecheck command: `node --run check`
    (equivalent to `pnpm typecheck`, which is just an alias — both invoke
    `tsc --noEmit`). Confirm no new TypeScript errors above the
    repository baseline
  - Run focused vitest: `pnpm exec vitest run client/src/pages/autopilot`
    (covers both `client/src/pages/autopilot/**` and
    `client/src/pages/autopilot/right-rail/**`). Confirm all pass
  - Append a new section "Implementation Cross-References" at the bottom of
    `.kiro/specs/spec-first-stage-process-artifact-split-uniform/design.md`
    mapping each new component to its final file path:
    - `mergeLogicalArtifacts` →
      `client/src/pages/autopilot/right-rail/stage-split-descriptor/merge-logical-artifacts.ts`
    - `STAGE_ARTIFACT_TYPES` →
      `client/src/pages/autopilot/right-rail/stage-split-descriptor/stage-artifact-types.ts`
    - `STAGE_FILTER_BY_SUB` →
      `client/src/pages/autopilot/right-rail/stage-split-descriptor/stage-filter-by-sub.ts`
    - `deriveStageSplitDescriptor` →
      `client/src/pages/autopilot/right-rail/stage-split-descriptor/derive-stage-split-descriptor.ts`
    - `useStageSplitDescriptor` →
      `client/src/pages/autopilot/right-rail/stage-split-descriptor/use-stage-split-descriptor.ts`
    - `StageSplitMount` →
      `client/src/pages/autopilot/right-rail/StageSplitMount.tsx`
    - `buildPreflightArtifactEntries` →
      `client/src/pages/autopilot/right-rail/stage-split-descriptor/build-preflight-artifact-entries.ts`
    - `buildPreflightExecutionFallbackEntries` →
      `client/src/pages/autopilot/right-rail/stage-split-descriptor/build-preflight-execution-fallback-entries.ts`
    - `buildFabricArtifactEntries` →
      `client/src/pages/autopilot/right-rail/stage-split-descriptor/build-fabric-artifact-entries.ts`
    - `buildFabricExecutionFallbackEntries` →
      `client/src/pages/autopilot/right-rail/stage-split-descriptor/build-fabric-execution-fallback-entries.ts`
  - _Requirements: 1.3, 1.6_

- [x] 5.7 Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- **Independent shipping.** The 5-batch layout means each batch can ship
  independently if priorities change. Batches 1–3 alone resolve every
  user-reported bug:
  - Batch 1 fixes the duplicate clarification card.
  - Batch 2 makes empty lanes render as stable placeholder cards instead of
    shrinking to a single `<EmptyLane>` row.
  - Batch 3 unifies the 4 preflight sub-stages onto the new mount surface
    (and adds the previously-missing `target_input` active mount).
  - Batches 4–5 generalize the surface to the 7 real fabric sub-stages but
    are not required to ship the bug fixes.
- **Rules of Hooks risk.** `useStageSplitDescriptor` can be misused. Two
  compliant call patterns are documented in the hook's docblock (see 3.6)
  and the `AutopilotRoutePage` migration (3.8 / 5.1–5.4):
  1. Call the hook flatly at the top of the component, once per sub, in a
     fixed order.
  2. Call a single `useMemo` at the top and invoke the pure
     `deriveStageSplitDescriptor` per sub inside it.
  Calling the hook inside `.map()`, `case` branches, or `&&`
  short-circuits will break React's hook ordering and is forbidden.
- **Test marking.** Implementation tasks, type-check / lint / build
  validation, the `StoreObservabilityHud` regex update (3.9), the merge
  unit test (1.5), the builder-level clarification dedup integration test
  (1.7), the `STAGE_FILTER_BY_SUB` table itself (4.1a), and the Workbench
  non-regression test (2.5) are all required (no `*`) — each one
  directly guards a user-facing fix or a contract that, if broken,
  reintroduces a bug from this spec. PBT, whitelist property tests,
  full-page DOM integration tests (1.7a, 3.12, 5.5), and ancillary unit
  tests are marked `*` because they expand coverage but are not strict
  prerequisites for the user-visible fix.
- **PBT vs unit split.** `1.6` is the property test for `mergeLogicalArtifacts`
  and asserts only `output.length === 1` for forced-same-key inputs. A
  separate unit test (`1.5` Case A) asserts the representative `id` value.
  Splitting these two responsibilities keeps the PBT shrinker-stable and
  the unit test crisp.
- **Builder-level vs page-level integration tests.** Required integration
  tests (1.7) target the builder/descriptor layer — they don't depend on
  router / store / API mocks and can run quickly. Page-level
  `renderToStaticMarkup(<AutopilotRoutePage />)` tests (1.7a, 3.12, 5.5)
  remain optional because the page wires up many surrounding pieces; they
  add structural-presence coverage but are not on the critical path for
  shipping the user-visible fix.
- **Stable lane testids.** Both
  `data-testid="autopilot-process-execution-lane"` and
  `data-testid="autopilot-process-artifact-lane"` MUST remain in the DOM
  across every render branch (Requirement 2.7), including when
  `showEmptyPlaceholder={false}` suppresses the placeholder cards.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.2a"] },
    { "id": 3, "tasks": ["1.3", "1.4", "1.5", "1.6", "1.7"] },
    { "id": 4, "tasks": ["1.7a"] },
    { "id": 5, "tasks": ["2.1"] },
    { "id": 6, "tasks": ["2.2"] },
    { "id": 7, "tasks": ["2.3", "2.4", "2.5"] },
    { "id": 8, "tasks": ["3.3", "3.4"] },
    { "id": 9, "tasks": ["3.5", "3.7"] },
    { "id": 10, "tasks": ["3.6", "3.10", "3.11"] },
    { "id": 11, "tasks": ["3.8"] },
    { "id": 12, "tasks": ["3.9", "3.12"] },
    { "id": 13, "tasks": ["4.1", "4.1a"] },
    { "id": 14, "tasks": ["4.1b", "4.2", "4.3"] },
    { "id": 15, "tasks": ["4.4"] },
    { "id": 16, "tasks": ["4.5"] },
    { "id": 17, "tasks": ["5.1"] },
    { "id": 18, "tasks": ["5.2"] },
    { "id": 19, "tasks": ["5.3"] },
    { "id": 20, "tasks": ["5.4"] },
    { "id": 21, "tasks": ["5.5"] },
    { "id": 22, "tasks": ["5.6"] }
  ]
}
```
