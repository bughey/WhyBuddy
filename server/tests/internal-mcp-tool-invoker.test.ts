import { describe, expect, it, vi } from "vitest";

import { InternalMcpToolInvoker } from "../tool/api/internal-mcp-tool-invoker.js";

describe("InternalMcpToolInvoker", () => {
  it("reads recent memory entries from the internal memory MCP server", async () => {
    const invoker = new InternalMcpToolInvoker({
      memoryRepo: {
        getRecentEntries(agentId, workflowId, limit = 5) {
          return [
            {
              timestamp: "2026-04-22T10:00:00.000Z",
              workflowId: workflowId ?? null,
              stage: "dialogue",
              type: "llm_response",
              preview: "最近记忆摘要",
              content: "最近记忆摘要",
              metadata: { limit, agentId },
            },
          ];
        },
        searchMemories() {
          return [];
        },
      },
    });

    const result = await invoker.invoke({
      serverId: "workspace.memory",
      toolName: "recent_memory",
      arguments: { limit: 3 },
      input: "读取最近记忆",
      context: [],
      agentId: "agent-memory",
      workflowId: "wf-memory-1",
      resource: "mcp://workspace.memory/recent_memory?limit=3",
    });

    expect(result).toMatchObject({
      ok: true,
      serverId: "internal.memory",
      toolName: "recent_memory",
      agentId: "agent-memory",
      workflowId: "wf-memory-1",
      count: 1,
    });
  });

  it("returns workflow messages through the workflow_messages MCP tool", async () => {
    const invoker = new InternalMcpToolInvoker({
      workflowRepo: {
        getWorkflow(id: string) {
          return {
            id,
            directive: "test workflow",
            status: "running",
            current_stage: "execution",
            departments_involved: [],
            started_at: null,
            completed_at: null,
            results: {},
            created_at: "2026-04-22T00:00:00.000Z",
          };
        },
        getMessagesByWorkflow() {
          return [
            {
              id: 1,
              workflow_id: "wf-msg-1",
              from_agent: "agent-a",
              to_agent: "agent-b",
              stage: "dialogue",
              content: "hello",
              metadata: null,
              created_at: "2026-04-22T01:00:00.000Z",
            },
          ];
        },
        getSkills() {
          return [];
        },
      },
    });

    const result = await invoker.invoke({
      serverId: "internal.memory",
      toolName: "workflow_messages",
      arguments: { limit: 10 },
      input: "拉取 workflow 消息",
      context: [],
      workflowId: "wf-msg-1",
      resource: "mcp://internal.memory/workflow_messages?workflowId=wf-msg-1",
    });

    expect(result).toMatchObject({
      ok: true,
      serverId: "internal.memory",
      toolName: "workflow_messages",
      workflowId: "wf-msg-1",
      count: 1,
    });
  });

  it("returns the workflow organization snapshot through the registry MCP server", async () => {
    const invoker = new InternalMcpToolInvoker({
      workflowRepo: {
        getWorkflow(id: string) {
          return {
            id,
            directive: "design system",
            status: "running",
            current_stage: "planning",
            departments_involved: ["design"],
            started_at: null,
            completed_at: null,
            created_at: "2026-04-22T00:00:00.000Z",
            results: {
              organization: {
                kind: "workflow_organization",
                workflowId: id,
                source: "generated",
                taskProfile: "engineering",
                generatedAt: "2026-04-22T00:00:00.000Z",
                rootNodeId: "root",
                rootAgentId: "ceo",
                departments: [],
                nodes: [
                  {
                    id: "root",
                    agentId: "ceo",
                    parentId: null,
                    departmentId: "exec",
                    departmentLabel: "Executive",
                    name: "Mission Control",
                    title: "CEO",
                    role: "ceo",
                    responsibility: "coordinate",
                    responsibilities: [],
                    goals: [],
                    summaryFocus: [],
                    skills: [],
                    mcp: [],
                    model: {
                      model: "mock-model",
                      temperature: 0.4,
                      maxTokens: 1000,
                    },
                    execution: {
                      mode: "orchestrate",
                      strategy: "parallel",
                      maxConcurrency: 3,
                    },
                  },
                ],
              },
            },
          };
        },
        getMessagesByWorkflow() {
          return [];
        },
        getSkills() {
          return [];
        },
      },
    });

    const result = await invoker.invoke({
      serverId: "internal.registry",
      toolName: "organization_snapshot",
      arguments: {},
      input: "读取组织快照",
      context: [],
      workflowId: "wf-org-1",
      resource: "mcp://internal.registry/organization_snapshot?workflowId=wf-org-1",
    });

    expect(result).toMatchObject({
      ok: true,
      serverId: "internal.registry",
      toolName: "organization_snapshot",
      workflowId: "wf-org-1",
      available: true,
    });
  });

  it("lists report files from the internal workspace MCP server", async () => {
    const listReportFiles = vi.fn(() => [
      {
        name: "report.json",
        relativePath: "workspace/agent-reports/report.json",
        sizeBytes: 128,
        modifiedAt: "2026-04-22T10:10:00.000Z",
      },
    ]);

    const invoker = new InternalMcpToolInvoker({
      workspaceRepo: {
        readFile() {
          return null;
        },
        writeFile() {
          return "workspace/agent-reports/report.json";
        },
        listReportFiles,
      },
    });

    const result = await invoker.invoke({
      serverId: "workspace.files",
      toolName: "list_reports",
      arguments: {},
      input: "列出报告文件",
      context: [],
      agentId: "agent-reports",
      resource: "mcp://workspace.files/list_reports",
    });

    expect(listReportFiles).toHaveBeenCalledWith("agent-reports");
    expect(result).toMatchObject({
      ok: true,
      serverId: "internal.workspace",
      toolName: "list_reports",
      count: 1,
    });
  });

  it("normalizes workspace alias server ids before invoking report downloads", async () => {
    const invoker = new InternalMcpToolInvoker({
      reportRepo: {
        readFinalWorkflowReport() {
          return null;
        },
        getFinalWorkflowReportFilePath() {
          return null;
        },
        getDepartmentReportFilePath() {
          return null;
        },
        listHeartbeatReports() {
          return [];
        },
      },
    });

    const result = await invoker.invoke({
      serverId: "workspace.reports",
      toolName: "download_report",
      arguments: {
        format: "json",
        scope: "final",
      },
      input: "下载最终报告",
      context: [],
      workflowId: "wf-report-1",
      resource: "mcp://workspace.reports/download_report?scope=final&format=json",
    });

    expect(result).toMatchObject({
      ok: true,
      serverId: "internal.reports",
      toolName: "download_report",
      scope: "final",
      workflowId: "wf-report-1",
      available: false,
      filePath: null,
      content: null,
    });
  });
});
