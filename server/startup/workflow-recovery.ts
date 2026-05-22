type StartupWorkflowStatus =
  | "pending"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "force_terminated";

interface StartupWorkflowRecord {
  id: string;
  status: StartupWorkflowStatus;
  current_stage: string | null;
  results: Record<string, unknown> | null;
}

interface WorkflowRecoveryDeps {
  workflows: StartupWorkflowRecord[];
  updateWorkflow: (
    id: string,
    updates: {
      status: "failed";
      results: Record<string, unknown>;
    },
  ) => void;
  materializeWorkflowMemories: (workflowId: string) => void;
}

const RESTART_FAILURE_MESSAGE = "Server restarted before the workflow completed.";

function asRecord(value: Record<string, unknown> | null): Record<string, unknown> {
  return value && typeof value === "object" ? value : {};
}

export function recoverWorkflowsOnStartup({
  workflows,
  updateWorkflow,
  materializeWorkflowMemories,
}: WorkflowRecoveryDeps): void {
  for (const workflow of workflows) {
    if (workflow.status !== "running") {
      continue;
    }

    updateWorkflow(workflow.id, {
      status: "failed",
      results: {
        ...asRecord(workflow.results),
        last_error: RESTART_FAILURE_MESSAGE,
        failed_stage: workflow.current_stage || null,
      },
    });
    materializeWorkflowMemories(workflow.id);
  }
}
