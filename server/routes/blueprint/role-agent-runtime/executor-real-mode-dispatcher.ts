import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type {
  DispatchExecutionPlanOptions,
  DispatchExecutionPlanResult,
} from "../../../core/executor-client.js";
import type { BlueprintLogger } from "../context.js";
import type {
  AgentJobInput,
  AgentJobOutput,
} from "../../../../shared/blueprint/agent-job.js";
import type { AgentTraceEntry } from "../../../../shared/blueprint/agent-state.js";
import type {
  ExecutionPlan,
  ExecutionPlanArtifact,
} from "../../../../shared/executor/contracts.js";
import { EXECUTOR_CONTRACT_VERSION } from "../../../../shared/executor/contracts.js";
import type { ExecutorJobDetail } from "../../../../shared/executor/api.js";
import type { RealModeDispatcher } from "./delegator.js";

export interface ExecutorRoleAgentClient {
  dispatchPlan(
    plan: ExecutionPlan,
    dispatch?: DispatchExecutionPlanOptions,
  ): Promise<DispatchExecutionPlanResult>;
  getJob(jobId: string): Promise<ExecutorJobDetail>;
}

export interface CreateExecutorRoleAgentDispatcherOptions {
  executorClient: ExecutorRoleAgentClient;
  logger: BlueprintLogger;
  now: () => Date;
  pollIntervalMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  cwd?: string;
  image?: string;
}

type TerminalStatus = "completed" | "failed" | "cancelled";

const TERMINAL_STATUSES = new Set<string>(["completed", "failed", "cancelled"]);
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_IMAGE = "node:20-slim";
const OUTPUT_ARTIFACT_NAME = "agent-output.json";
const DEFAULT_CONTAINER_CALLBACK_HOST = "host.docker.internal";

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeJobId(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 48) || "job";
}

function resolveContainerCallbackUrl(callbackUrl: string | undefined): string | undefined {
  if (!callbackUrl) {
    return callbackUrl;
  }

  try {
    const url = new URL(callbackUrl);
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "::1") {
      return callbackUrl;
    }

    url.hostname =
      process.env.BLUEPRINT_ROLE_AGENT_CONTAINER_CALLBACK_HOST?.trim() ||
      DEFAULT_CONTAINER_CALLBACK_HOST;
    return url.toString();
  } catch {
    return callbackUrl;
  }
}

function buildRunnerInput(input: AgentJobInput): Record<string, unknown> {
  const request =
    input.context.request &&
    typeof input.context.request === "object" &&
    !Array.isArray(input.context.request)
      ? (input.context.request as Record<string, unknown>)
      : {};

  return {
    jobId: input.jobId,
    roleId: input.roleId,
    stageId: input.stageId,
    goal: input.goal,
    routeSetId:
      typeof input.context.routeSetId === "string"
        ? input.context.routeSetId
        : undefined,
    primaryRouteId:
      typeof input.context.primaryRouteId === "string"
        ? input.context.primaryRouteId
        : undefined,
    targetText:
      typeof request.targetText === "string"
        ? request.targetText.slice(0, 2_000)
        : input.goal.slice(0, 2_000),
    githubUrls: Array.isArray(request.githubUrls)
      ? request.githubUrls.filter((item): item is string => typeof item === "string").slice(0, 8)
      : [],
    budget: input.budget,
    callbackUrl: resolveContainerCallbackUrl(input.callbackUrl),
    callbackSecret: input.callbackSecret,
  };
}

function buildContainerRunnerScript(): string {
  return String.raw`
const { createHmac } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const startedAt = Date.now();
const input = JSON.parse(process.env.AGENT_JOB_INPUT || "{}");
const artifactDir = process.env.AGENT_ARTIFACT_DIR || "/workspace/artifacts";
const budget = input.budget || {};

function remaining(iteration) {
  return {
    iterations: Math.max(0, Number(budget.maxIterations || 0) - iteration),
    tokens: Math.max(0, Number(budget.maxTokens || 0)),
    timeMs: Math.max(0, Number(budget.timeoutMs || 0) - (Date.now() - startedAt)),
  };
}

function sign(secret, timestamp, body) {
  return createHmac("sha256", secret).update(timestamp + "." + body).digest("hex");
}

async function emit(type, phase, iteration, extra) {
  if (!input.callbackUrl || !input.callbackSecret || typeof fetch !== "function") return;
  const event = {
    type,
    jobId: String(input.jobId || ""),
    roleId: String(input.roleId || ""),
    stageId: String(input.stageId || ""),
    iteration,
    timestamp: new Date().toISOString(),
    phase,
    tokensUsed: 0,
    budgetRemaining: remaining(iteration),
    ...(extra || {}),
  };
  const body = JSON.stringify(event);
  const timestamp = new Date().toISOString();
  const signature = sign(String(input.callbackSecret), timestamp, body);
  try {
    await fetch(String(input.callbackUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Timestamp": timestamp,
        "X-Agent-Signature": signature,
        "X-Agent-EventType": type,
      },
      body,
    });
  } catch (_) {
  }
}

function routeOutput() {
  const target = String(input.targetText || input.goal || "the requested blueprint runtime").replace(/\s+/g, " ").trim();
  const routeSetId = String(input.routeSetId || "agent-routeset");
  const primaryRouteId = String(input.primaryRouteId || routeSetId + ":primary");
  return {
    routes: [
      {
        title: "Primary runtime path",
        summary: "Drive " + target.slice(0, 220) + " through the executor-backed role agent path and preserve live callback evidence.",
        kind: "primary",
        complexity: "medium",
        riskLevel: "medium",
        costLevel: "medium",
      },
      {
        title: "Conservative fallback path",
        summary: "Keep the host-side lite agent and LLM fallback available when the executor path cannot produce a valid artifact.",
        kind: "alternative",
        complexity: "low",
        riskLevel: "low",
        costLevel: "low",
      },
    ],
  };
}

(async () => {
  await emit("agent.started", "idle", 0);
  await emit("agent.thinking", "thinking", 1, { thought: "Planning route set inside executor-dispatched runner." });
  const output = routeOutput();
  const durationMs = Date.now() - startedAt;
  const trace = [
    {
      iteration: 1,
      phase: "thinking",
      timestamp: new Date().toISOString(),
      thought: "Executor-dispatched role runner produced a schema-valid route proposal.",
      tokensUsed: 0,
    },
  ];
  const agentOutput = {
    jobId: String(input.jobId || ""),
    roleId: String(input.roleId || ""),
    status: "completed",
    output,
    iterations: 1,
    totalTokens: 0,
    durationMs,
    trace,
  };
  await emit("agent.completed", "completed", 1, { output });
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(join(artifactDir, "agent-output.json"), JSON.stringify(agentOutput, null, 2) + "\n", "utf-8");
})().catch((error) => {
  const durationMs = Date.now() - startedAt;
  const agentOutput = {
    jobId: String(input.jobId || ""),
    roleId: String(input.roleId || ""),
    status: "failed",
    output: null,
    iterations: 1,
    totalTokens: 0,
    durationMs,
    trace: [],
    error: error && error.message ? error.message : String(error),
  };
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(join(artifactDir, "agent-output.json"), JSON.stringify(agentOutput, null, 2) + "\n", "utf-8");
  process.exitCode = 1;
});
`.trim();
}

function buildExecutionPlan(
  input: AgentJobInput,
  executorJobId: string,
  image: string,
): ExecutionPlan {
  return {
    version: EXECUTOR_CONTRACT_VERSION,
    missionId: input.jobId,
    summary: `Run role agent ${input.roleId} for ${input.stageId}`,
    objective: input.goal,
    requestedBy: "brain",
    mode: "managed",
    steps: [
      {
        key: "role_agent.dispatch",
        label: "Dispatch role agent",
        description: "Run the role agent worker in the executor sandbox.",
      },
    ],
    jobs: [
      {
        id: executorJobId,
        key: "role_agent.run",
        label: "Run role agent",
        description: `Executor-backed role agent for ${input.roleId}/${input.stageId}`,
        kind: "execute",
        timeoutMs: Math.max(1_000, input.budget.timeoutMs || DEFAULT_TIMEOUT_MS),
        payload: {
          source: "role-agent-runtime",
          image,
          command: ["node", "-e", buildContainerRunnerScript()],
          env: {
            AGENT_JOB_INPUT: JSON.stringify(buildRunnerInput(input)),
            AGENT_ARTIFACT_DIR: "/workspace/artifacts",
          },
          requiredCapabilities: ["runtime.docker", "node", "artifact.json"],
        },
      },
    ],
    metadata: {
      source: "role-agent-runtime",
      agentJobId: input.jobId,
      roleId: input.roleId,
      stageId: input.stageId,
    },
  };
}

function isTerminalStatus(status: string): status is TerminalStatus {
  return TERMINAL_STATUSES.has(status);
}

async function waitForTerminalJob(
  opts: CreateExecutorRoleAgentDispatcherOptions,
  jobId: string,
): Promise<ExecutorJobDetail> {
  const timeoutMs = Math.max(1, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const pollIntervalMs = Math.max(1, opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
  const wait = opts.sleep ?? sleep;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const detail = await opts.executorClient.getJob(jobId);
    if (isTerminalStatus(detail.status)) {
      if (detail.status === "completed") {
        return detail;
      }
      throw new Error(
        `executor role agent job ${jobId} ended with status=${detail.status}: ${detail.errorMessage ?? detail.message}`,
      );
    }
    if (Date.now() >= deadline) {
      throw new Error(`executor role agent job ${jobId} timed out after ${timeoutMs}ms`);
    }
    await wait(pollIntervalMs);
  }
}

function findAgentOutputArtifact(
  detail: Pick<ExecutorJobDetail, "artifacts">,
): ExecutionPlanArtifact | undefined {
  return detail.artifacts.find(artifact => artifact.name === OUTPUT_ARTIFACT_NAME);
}

function resolveArtifactPath(
  artifact: ExecutionPlanArtifact,
  cwd: string,
): string {
  if (!artifact.path) {
    throw new Error(`${OUTPUT_ARTIFACT_NAME} artifact is missing a path`);
  }
  return path.isAbsolute(artifact.path)
    ? artifact.path
    : path.resolve(cwd, artifact.path);
}

function readAgentOutput(
  artifact: ExecutionPlanArtifact,
  cwd: string,
  expected: Pick<AgentJobInput, "jobId" | "roleId">,
): AgentJobOutput {
  const artifactPath = resolveArtifactPath(artifact, cwd);
  if (!existsSync(artifactPath)) {
    throw new Error(`${OUTPUT_ARTIFACT_NAME} does not exist at ${artifactPath}`);
  }

  const raw = readFileSync(artifactPath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isAgentJobOutput(parsed, expected)) {
    throw new Error(`${OUTPUT_ARTIFACT_NAME} is not a valid AgentJobOutput`);
  }
  return parsed;
}

function isAgentJobOutput(
  value: unknown,
  expected: Pick<AgentJobInput, "jobId" | "roleId">,
): value is AgentJobOutput {
  if (!value || typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const status = record.status;
  return (
    record.jobId === expected.jobId &&
    record.roleId === expected.roleId &&
    (status === "completed" || status === "failed" || status === "aborted") &&
    "output" in record &&
    typeof record.iterations === "number" &&
    typeof record.totalTokens === "number" &&
    typeof record.durationMs === "number" &&
    Array.isArray(record.trace) &&
    record.trace.every(isTraceEntry) &&
    (record.error === undefined || typeof record.error === "string")
  );
}

function isTraceEntry(value: unknown): value is AgentTraceEntry {
  if (!value || typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.iteration === "number" &&
    typeof record.phase === "string" &&
    typeof record.timestamp === "string" &&
    typeof record.tokensUsed === "number"
  );
}

export function createExecutorRoleAgentDispatcher(
  opts: CreateExecutorRoleAgentDispatcherOptions,
): RealModeDispatcher {
  const cwd = opts.cwd ?? process.cwd();
  const image = opts.image ?? process.env.BLUEPRINT_ROLE_AGENT_RUNTIME_IMAGE ?? DEFAULT_IMAGE;

  return async function dispatchToExecutor(input: AgentJobInput): Promise<AgentJobOutput> {
    const executorJobId = `role-agent-${sanitizeJobId(input.jobId)}-${randomUUID().slice(0, 8)}`;
    const plan = buildExecutionPlan(input, executorJobId, image);

    opts.logger.debug("[role-agent.real] dispatching executor job", {
      agentJobId: input.jobId,
      executorJobId,
      roleId: input.roleId,
      stageId: input.stageId,
    });

    const dispatched = await opts.executorClient.dispatchPlan(plan, {
      jobId: executorJobId,
      requestId: `role-agent:${input.jobId}:${executorJobId}`,
      idempotencyKey: `role-agent:${input.jobId}:${executorJobId}`,
    });
    const jobId = dispatched.response.jobId || executorJobId;
    const detail = await waitForTerminalJob(opts, jobId);
    const artifact = findAgentOutputArtifact(detail);
    if (!artifact) {
      throw new Error(`executor role agent job ${jobId} completed without ${OUTPUT_ARTIFACT_NAME}`);
    }

    return readAgentOutput(artifact, cwd, input);
  };
}
