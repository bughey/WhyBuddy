import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { AgentJobInput, AgentJobOutput } from "../../../../shared/blueprint/agent-job.js";
import type { ExecutionPlan } from "../../../../shared/executor/contracts.js";
import type { BlueprintLogger } from "../context.js";
import { createExecutorRoleAgentDispatcher } from "./executor-real-mode-dispatcher.js";

function buildLogger(): BlueprintLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function buildAgentInput(overrides: Partial<AgentJobInput> = {}): AgentJobInput {
  return {
    jobId: "blueprint-job-real-1",
    roleId: "planner",
    stageId: "route_generation",
    goal: "Generate a route set",
    systemPrompt: "You are a planner",
    tools: [],
    budget: {
      maxIterations: 5,
      maxTokens: 20_000,
      timeoutMs: 30_000,
      toolTimeoutMs: 5_000,
      allowParallelTools: false,
    },
    context: {
      routeSetId: "routeset-1",
      primaryRouteId: "routeset-1:primary",
      request: {
        targetText: "Build an autopilot runtime architecture",
        githubUrls: ["https://github.com/example/repo"],
      },
    },
    callbackUrl: "http://127.0.0.1:3999/api/blueprint/agent/progress",
    callbackSecret: "test-secret",
    ...overrides,
  };
}

function buildOutput(overrides: Partial<AgentJobOutput> = {}): AgentJobOutput {
  return {
    jobId: "blueprint-job-real-1",
    roleId: "planner",
    status: "completed",
    output: {
      routes: [
        {
          title: "Primary runtime path",
          summary: "Use the real executor-backed role agent path.",
          kind: "primary",
        },
        {
          title: "Conservative fallback path",
          summary: "Keep the host-side lite runtime as a fallback.",
          kind: "alternative",
        },
      ],
    },
    iterations: 1,
    totalTokens: 0,
    durationMs: 250,
    trace: [],
    ...overrides,
  };
}

describe("createExecutorRoleAgentDispatcher", () => {
  it("dispatches an executor plan, waits for completion, and returns agent-output.json", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "role-agent-real-"));
    const artifactPath = join(tempRoot, "agent-output.json");
    writeFileSync(artifactPath, `${JSON.stringify(buildOutput())}\n`, "utf-8");

    const dispatchPlan = vi.fn(async (plan: ExecutionPlan, dispatch: { jobId?: string }) => ({
      request: {
        executor: "lobster",
        jobId: dispatch.jobId ?? "executor-role-agent-job",
      },
      response: {
        ok: true,
        accepted: true,
        requestId: "request-1",
        missionId: plan.missionId,
        jobId: dispatch.jobId ?? "executor-role-agent-job",
        receivedAt: "2026-05-22T00:00:00.000Z",
      },
    }));
    const getJob = vi
      .fn()
      .mockResolvedValueOnce({
        jobId: "executor-role-agent-job",
        status: "running",
        artifacts: [],
      })
      .mockResolvedValueOnce({
        jobId: "executor-role-agent-job",
        status: "completed",
        artifacts: [
          {
            kind: "report",
            name: "agent-output.json",
            path: artifactPath,
            previewType: "json",
          },
        ],
      });

    const dispatcher = createExecutorRoleAgentDispatcher({
      executorClient: { dispatchPlan, getJob },
      logger: buildLogger(),
      now: () => new Date("2026-05-22T00:00:00.000Z"),
      sleep: async () => undefined,
      pollIntervalMs: 1,
      timeoutMs: 1_000,
    });

    const result = await dispatcher(buildAgentInput());

    expect(result).toEqual(buildOutput());
    expect(dispatchPlan).toHaveBeenCalledTimes(1);
    const [plan, dispatch] = dispatchPlan.mock.calls[0]!;
    expect(plan.missionId).toBe("blueprint-job-real-1");
    expect(plan.jobs[0]?.payload?.source).toBe("role-agent-runtime");
    expect(plan.jobs[0]?.payload?.command).toEqual(expect.arrayContaining(["node", "-e"]));
    const runnerEnv = plan.jobs[0]?.payload?.env as Record<string, string>;
    const runnerInput = JSON.parse(runnerEnv.AGENT_JOB_INPUT) as Record<string, unknown>;
    expect(runnerInput.callbackUrl).toBe(
      "http://host.docker.internal:3999/api/blueprint/agent/progress",
    );
    expect(dispatch.jobId).toMatch(/^role-agent-blueprint-job-real-1-/);
    expect(getJob).toHaveBeenCalledTimes(2);
  });

  it("rejects completed executor jobs that do not expose agent-output.json", async () => {
    const dispatchPlan = vi.fn(async () => ({
      request: { executor: "lobster", jobId: "executor-role-agent-job" },
      response: {
        ok: true,
        accepted: true,
        requestId: "request-1",
        missionId: "blueprint-job-real-1",
        jobId: "executor-role-agent-job",
        receivedAt: "2026-05-22T00:00:00.000Z",
      },
    }));
    const getJob = vi.fn(async () => ({
      jobId: "executor-role-agent-job",
      status: "completed",
      artifacts: [{ kind: "report", name: "result.json", path: "result.json" }],
    }));
    const dispatcher = createExecutorRoleAgentDispatcher({
      executorClient: { dispatchPlan, getJob },
      logger: buildLogger(),
      now: () => new Date("2026-05-22T00:00:00.000Z"),
      sleep: async () => undefined,
      pollIntervalMs: 1,
      timeoutMs: 1_000,
    });

    await expect(dispatcher(buildAgentInput())).rejects.toThrow(
      /agent-output\.json/,
    );
  });
});
