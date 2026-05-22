import { describe, expect, it, vi } from "vitest";

import { recoverWorkflowsOnStartup } from "../startup/workflow-recovery.js";

describe("recoverWorkflowsOnStartup", () => {
  it("does not rematerialize terminal workflows during server startup", () => {
    const updateWorkflow = vi.fn();
    const materializeWorkflowMemories = vi.fn();

    recoverWorkflowsOnStartup({
      workflows: [
        {
          id: "wf-completed",
          status: "completed",
          current_stage: "finalize",
          results: { existing: true },
        },
        {
          id: "wf-failed",
          status: "failed",
          current_stage: "execute",
          results: { last_error: "already failed" },
        },
        {
          id: "wf-completed-errors",
          status: "completed_with_errors",
          current_stage: "report",
          results: { warnings: 1 },
        },
      ],
      updateWorkflow,
      materializeWorkflowMemories,
    });

    expect(updateWorkflow).not.toHaveBeenCalled();
    expect(materializeWorkflowMemories).not.toHaveBeenCalled();
  });

  it("marks interrupted running workflows failed and materializes only those recovered workflows", () => {
    const updateWorkflow = vi.fn();
    const materializeWorkflowMemories = vi.fn();

    recoverWorkflowsOnStartup({
      workflows: [
        {
          id: "wf-running",
          status: "running",
          current_stage: "execute",
          results: { progress: 0.5 },
        },
        {
          id: "wf-completed",
          status: "completed",
          current_stage: "finalize",
          results: { existing: true },
        },
      ],
      updateWorkflow,
      materializeWorkflowMemories,
    });

    expect(updateWorkflow).toHaveBeenCalledTimes(1);
    expect(updateWorkflow).toHaveBeenCalledWith(
      "wf-running",
      expect.objectContaining({
        status: "failed",
        results: {
          progress: 0.5,
          last_error: "Server restarted before the workflow completed.",
          failed_stage: "execute",
        },
      }),
    );
    expect(materializeWorkflowMemories).toHaveBeenCalledTimes(1);
    expect(materializeWorkflowMemories).toHaveBeenCalledWith("wf-running");
  });
});
