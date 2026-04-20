import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MissionTaskDetail } from "@/lib/tasks-store";

import { TasksCockpitDetail } from "../TasksCockpitDetail";

function makeDetail(
  overrides?: Partial<MissionTaskDetail>
): MissionTaskDetail {
  return {
    id: "mission-1",
    title: "Runtime dock handoff",
    kind: "analysis",
    sourceText: "Keep runtime evidence in the shared dock.",
    status: "running",
    operatorState: "active",
    workflowStatus: "running",
    progress: 61,
    currentStageKey: "execute",
    currentStageLabel: "Execute",
    summary: "Runtime evidence should stay in the shared launcher dock.",
    waitingFor: null,
    blocker: null,
    attempt: 1,
    latestOperatorAction: null,
    createdAt: Date.now() - 300_000,
    updatedAt: Date.now() - 30_000,
    startedAt: Date.now() - 240_000,
    completedAt: null,
    departmentLabels: ["Platform"],
    taskCount: 2,
    completedTaskCount: 1,
    messageCount: 0,
    activeAgentCount: 1,
    attachmentCount: 0,
    issueCount: 0,
    hasWarnings: false,
    lastSignal: "Executor is still working through the active stage.",
    workflow: {
      id: "workflow-1",
      directive: "Keep runtime evidence in the shared dock.",
      status: "running",
      current_stage: "execute",
      departments_involved: ["Platform"],
      started_at: new Date(Date.now() - 240_000).toISOString(),
      completed_at: null,
      results: null,
      created_at: new Date(Date.now() - 300_000).toISOString(),
    },
    tasks: [],
    messages: [],
    report: null,
    organization: null,
    stages: [],
    agents: [],
    timeline: [],
    artifacts: [],
    failureReasons: [],
    decisionPresets: [],
    decisionPrompt: null,
    decisionPlaceholder: null,
    decisionAllowsFreeText: false,
    decision: null,
    instanceInfo: [],
    logSummary: [],
    runtimeChannels: {
      socket: {
        status: "connected",
        label: "Socket connected",
        detail: "Mission socket is connected.",
      },
      callback: {
        status: "idle",
        label: "Callback idle",
        detail: "No callback has been recorded yet.",
      },
    },
    decisionHistory: [],
    operatorActions: [],
    missionArtifacts: [],
    ...overrides,
  };
}

describe("TasksCockpitDetail runtime evidence handoff", () => {
  it("keeps the cockpit detail copy aligned with deferred runtime evidence", () => {
    const markup = renderToStaticMarkup(
      <TasksCockpitDetail
        detail={makeDetail()}
        decisionNote=""
        onDecisionNoteChange={() => {}}
        onLaunchDecision={() => {}}
        onSubmitOperatorAction={() => Promise.resolve()}
      />
    );

    expect(markup).toContain("深层工作区");
    expect(markup).toContain("运行证据统一回到底部折叠区");
    expect(markup).toContain("完整详情工作区");
  });
});
