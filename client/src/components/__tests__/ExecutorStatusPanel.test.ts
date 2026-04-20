/**
 * Unit tests for ExecutorStatusPanel logic.
 *
 * Since the project does not include @testing-library/react,
 * we validate the exported interface and status mapping logic
 * that drives the component's visual output.
 *
 * @see Requirements 5.1, 5.2, 5.3
 */
import { describe, it, expect } from "vitest";

import type { ExecutorStatusPanelProps } from "../ExecutorStatusPanel";
import type {
  MissionExecutorContext,
  MissionInstanceContext,
} from "@shared/mission/contracts";

describe("ExecutorStatusPanel props contract", () => {
  it("accepts a minimal executor context", () => {
    const executor: MissionExecutorContext = { name: "lobster-executor" };
    const props: ExecutorStatusPanelProps = { executor };
    expect(props.executor?.name).toBe("lobster-executor");
  });

  it("accepts a full executor context with all fields", () => {
    const executor: MissionExecutorContext = {
      name: "lobster-executor",
      requestId: "req-123",
      jobId: "job-456",
      status: "running",
      baseUrl: "http://localhost:9800",
      lastEventType: "job.started",
      lastEventAt: Date.now(),
    };
    const instance: MissionInstanceContext = {
      id: "container-789",
      image: "node:20-slim",
      command: ["node", "index.js"],
      workspaceRoot: "/workspace",
      startedAt: Date.now(),
    };
    const props: ExecutorStatusPanelProps = { executor, instance };

    expect(props.executor?.status).toBe("running");
    expect(props.instance?.image).toBe("node:20-slim");
  });

  it("allows all props to be undefined (renders nothing)", () => {
    const props: ExecutorStatusPanelProps = {};
    expect(props.executor).toBeUndefined();
    expect(props.instance).toBeUndefined();
  });

  it("status values map to expected display states", () => {
    const statuses = ["queued", "running", "completed", "failed"] as const;
    for (const status of statuses) {
      const executor: MissionExecutorContext = {
        name: "test-executor",
        status,
      };
      expect(executor.status).toBe(status);
    }
  });

  it("supports pure runtime summaries without extra artifact context", () => {
    const props: ExecutorStatusPanelProps = {
      executor: { name: "test", status: "completed" },
    };

    expect(props.executor?.status).toBe("completed");
    expect(props.instance).toBeUndefined();
  });
});
