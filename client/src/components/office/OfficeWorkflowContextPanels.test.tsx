import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const workflowStoreState = {
  stages: [
    { id: "direction", order: 1, label: "方向下发" },
    { id: "planning", order: 2, label: "任务规划" },
    { id: "execution", order: 3, label: "执行" },
    { id: "review", order: 4, label: "评审" },
  ],
  tasks: [
    {
      id: 1,
      workflow_id: "wf-graph",
      worker_id: "agent-worker",
      manager_id: "agent-manager",
      department: "市场部",
      description: "整理投放计划",
      deliverable: null,
      deliverable_v2: null,
      deliverable_v3: null,
      score_accuracy: null,
      score_completeness: null,
      score_actionability: null,
      score_format: null,
      total_score: null,
      manager_feedback: null,
      meta_audit_feedback: null,
      version: 1,
      status: "running",
    },
  ],
  currentWorkflowGraphInstance: {
    kind: "graph_instance_snapshot",
    version: 1,
    instanceId: "graph-wf-graph",
    workflowId: "wf-graph",
    missionId: "mission-graph",
    sessionId: "session-graph",
    directive: "推进增长实验",
    status: "EXECUTING",
    workflowStatus: "running",
    missionStatus: "running",
    currentStage: "execution",
    createdAt: "2026-04-15T00:00:00.000Z",
    startedAt: "2026-04-15T00:00:01.000Z",
    completedAt: null,
    links: {
      workflowId: "wf-graph",
      missionId: "mission-graph",
      sessionId: "session-graph",
    },
    nodeRuns: [
      {
        nodeId: "node-ceo",
        title: "CEO 协调",
        departmentLabel: "指挥中枢",
        role: "ceo",
        stageKey: "direction",
        status: "EXECUTED",
        outputPreview: "已完成整体方向下发",
      },
      {
        nodeId: "node-marketing",
        title: "市场分析",
        departmentLabel: "市场部",
        role: "manager",
        stageKey: "execution",
        status: "EXECUTING",
        outputPreview: "正在整理竞品投放样本",
      },
      {
        nodeId: "node-review",
        title: "人工确认",
        departmentLabel: "运营部",
        role: "worker",
        stageKey: "review",
        status: "WAITING_INPUT",
        error: "等待确认预算上限",
      },
    ],
    edgeTransitions: [
      {
        edgeId: "node-ceo->node-marketing",
        fromNodeId: "node-ceo",
        toNodeId: "node-marketing",
        kind: "parent_child",
        status: "executed",
      },
    ],
    telemetry: {
      messageCount: 6,
      taskCount: 2,
      errorCount: 1,
      waitingFor: "等待预算审批",
    },
  },
  downloadWorkflowReport: vi.fn(async () => {}),
  downloadDepartmentReport: vi.fn(async () => {}),
};

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    locale: "zh-CN",
    copy: {},
    setLocale: () => {},
    toggleLocale: () => {},
  }),
}));

vi.mock("@/lib/store", () => ({
  useAppStore: () => null,
}));

vi.mock("@/lib/workflow-store", () => ({
  useWorkflowStore: (selector: (state: typeof workflowStoreState) => unknown) =>
    selector(workflowStoreState),
}));

import { OfficeWorkflowFlowPanel } from "./OfficeWorkflowContextPanels";

beforeEach(() => {
  workflowStoreState.downloadWorkflowReport.mockClear();
  workflowStoreState.downloadDepartmentReport.mockClear();
});

describe("OfficeWorkflowFlowPanel", () => {
  it("renders graph instance runtime summary and node runs", () => {
    const markup = renderToStaticMarkup(
      <OfficeWorkflowFlowPanel
        workflow={{
          id: "wf-graph",
          missionId: "mission-graph",
          directive: "推进增长实验",
          status: "running",
          current_stage: "execution",
          departments_involved: ["市场部"],
          started_at: "2026-04-15T00:00:01.000Z",
          completed_at: null,
          results: {
            organization: {
              departments: ["市场部"],
              taskProfile: "growth",
              nodes: [
                {
                  id: "node-marketing",
                  agentId: "agent-manager",
                  departmentLabel: "市场部",
                  name: "营销经理",
                  title: "增长负责人",
                  responsibility: "负责增长实验拆解",
                },
              ],
              reasoning: "组织已建立",
            },
          },
          created_at: "2026-04-15T00:00:00.000Z",
        }}
        missionDetail={
          {
            id: "mission-graph",
            title: "推进增长实验",
            taskCount: 2,
          } as any
        }
        onOpenTask={() => {}}
      />
    );

    expect(markup).toContain("运行图实例");
    expect(markup).toContain("节点总数");
    expect(markup).toContain("等待预算审批");
    expect(markup).toContain("市场分析");
    expect(markup).toContain("执行中");
    expect(markup).toContain("人工确认");
    expect(markup).toContain("等待确认预算上限");
  });
});
