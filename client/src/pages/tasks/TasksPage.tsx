import {
  startTransition,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { OfficeAgentInspectorPanel } from "@/components/office/OfficeAgentInspectorPanel";
import {
  buildOfficeCockpitAvailability,
  resolveWorkflowForSelectedTask,
} from "@/components/office/office-task-cockpit-utils";
import {
  OfficeMemoryReportsPanel,
  OfficeWorkflowFlowPanel,
  OfficeWorkflowHistoryPanel,
} from "@/components/office/OfficeWorkflowContextPanels";
import { TasksCockpitDetail } from "@/components/tasks/TasksCockpitDetail";
import { TasksQueueRail } from "@/components/tasks/TasksQueueRail";
import {
  compactText,
  missionOperatorStateLabel,
  missionOperatorStateTone,
  missionStatusLabel,
  missionStatusTone,
} from "@/components/tasks/task-helpers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewportTier, useViewportWidth } from "@/hooks/useViewportTier";
import { useI18n } from "@/i18n";
import { useTasksStore } from "@/lib/tasks-store";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/workflow-store";
import type { MissionOperatorActionType } from "@shared/mission/contracts";

function t(locale: string, zh: string, en: string) {
  return locale === "zh-CN" ? zh : en;
}

type TasksWorkbenchTab = "task" | "flow" | "agent" | "memory" | "history";

const taskWorkbenchTriggerClassName =
  "min-h-[36px] rounded-[14px] border border-transparent px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-stone-600 transition data-[state=active]:border-sky-100 data-[state=active]:bg-sky-50 data-[state=active]:text-stone-950 data-[state=active]:shadow-[0_12px_24px_rgba(2,132,199,0.12)]";

function isTasksWorkbenchTab(value: string): value is TasksWorkbenchTab {
  return (
    value === "task" ||
    value === "flow" ||
    value === "agent" ||
    value === "memory" ||
    value === "history"
  );
}

function TasksWorkbenchContextShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-white/55 bg-white/46 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-md">
      <div className="shrink-0 px-1 pb-3">
        <div className="text-sm font-semibold text-stone-900">{title}</div>
        <p className="mt-1 text-xs leading-5 text-stone-500">{description}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

function TasksWorkbenchEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full items-center justify-center rounded-[18px] border border-dashed border-stone-300/80 bg-white/62 px-6 py-8 text-center">
      <div className="max-w-md">
        <div className="text-base font-semibold text-stone-900">{title}</div>
        <p className="mt-2 text-sm leading-6 text-stone-500">{description}</p>
      </div>
    </div>
  );
}

export default function TasksPage({
  initialTaskId = null,
  className,
}: {
  initialTaskId?: string | null;
  className?: string;
}) {
  const { locale, copy } = useI18n();
  const { isMobile } = useViewportTier();
  const width = useViewportWidth();
  const ensureReady = useTasksStore(state => state.ensureReady);
  const refresh = useTasksStore(state => state.refresh);
  const selectTask = useTasksStore(state => state.selectTask);
  const submitOperatorAction = useTasksStore(
    state => state.submitOperatorAction
  );
  const setDecisionNote = useTasksStore(state => state.setDecisionNote);
  const launchDecision = useTasksStore(state => state.launchDecision);
  const tasks = useTasksStore(state => state.tasks);
  const detailsById = useTasksStore(state => state.detailsById);
  const selectedTaskId = useTasksStore(state => state.selectedTaskId);
  const loading = useTasksStore(state => state.loading);
  const ready = useTasksStore(state => state.ready);
  const error = useTasksStore(state => state.error);
  const decisionNotes = useTasksStore(state => state.decisionNotes);
  const operatorActionLoadingByMissionId = useTasksStore(
    state => state.operatorActionLoadingByMissionId
  );
  const workflows = useWorkflowStore(state => state.workflows);
  const agents = useWorkflowStore(state => state.agents);
  const currentWorkflow = useWorkflowStore(state => state.currentWorkflow);
  const currentWorkflowId = useWorkflowStore(state => state.currentWorkflowId);
  const fetchAgents = useWorkflowStore(state => state.fetchAgents);
  const fetchStages = useWorkflowStore(state => state.fetchStages);
  const fetchWorkflows = useWorkflowStore(state => state.fetchWorkflows);
  const setCurrentWorkflow = useWorkflowStore(
    state => state.setCurrentWorkflow
  );

  const [search, setSearch] = useState("");
  const [launchingPresetId, setLaunchingPresetId] = useState<string | null>(
    null
  );
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<TasksWorkbenchTab>("task");

  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const isWideDesktop = width >= 1280;
  const isLockedCockpit = width >= 1440 && !isMobile;

  useEffect(() => {
    void ensureReady();
  }, [ensureReady]);

  useEffect(() => {
    void fetchAgents();
    void fetchStages();
    void fetchWorkflows();
  }, [fetchAgents, fetchStages, fetchWorkflows]);

  useEffect(() => {
    if (initialTaskId) {
      startTransition(() => {
        selectTask(initialTaskId);
      });
    }
  }, [initialTaskId, selectTask]);

  useEffect(() => {
    if (!highlightedTaskId || typeof window === "undefined") {
      return;
    }

    const timer = window.setTimeout(() => {
      setHighlightedTaskId(current =>
        current === highlightedTaskId ? null : current
      );
    }, 2400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [highlightedTaskId]);

  const filteredTasks = useMemo(() => {
    if (!deferredSearch) return tasks;
    return tasks.filter(task => {
      const searchable = [
        task.title,
        task.sourceText,
        task.summary,
        task.currentStageLabel,
        task.waitingFor,
        ...task.departmentLabels,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(deferredSearch);
    });
  }, [deferredSearch, tasks]);

  const activeTaskId =
    (selectedTaskId && detailsById[selectedTaskId] ? selectedTaskId : null) ||
    filteredTasks[0]?.id ||
    null;
  const selectedDetail = activeTaskId
    ? detailsById[activeTaskId] || null
    : null;
  const selectedTaskSummary =
    tasks.find(task => task.id === activeTaskId) || null;
  const decisionNote = activeTaskId ? decisionNotes[activeTaskId] || "" : "";
  const activeWorkflow = useMemo(
    () =>
      resolveWorkflowForSelectedTask({
        taskId: activeTaskId,
        workflows,
        currentWorkflow,
      }),
    [activeTaskId, currentWorkflow, workflows]
  );
  const availability = useMemo(
    () =>
      buildOfficeCockpitAvailability({
        detail: selectedDetail,
        workflow: activeWorkflow,
        agents,
        workflows,
      }),
    [activeWorkflow, agents, selectedDetail, workflows]
  );

  useEffect(() => {
    const workflowForTask = resolveWorkflowForSelectedTask({
      taskId: activeTaskId,
      workflows,
      currentWorkflow,
    });

    if (workflowForTask && workflowForTask.id !== currentWorkflowId) {
      setCurrentWorkflow(workflowForTask.id);
      return;
    }

    if (!workflowForTask && activeTaskId && currentWorkflowId) {
      setCurrentWorkflow(null);
    }
  }, [
    activeTaskId,
    currentWorkflow,
    currentWorkflowId,
    setCurrentWorkflow,
    workflows,
  ]);

  async function handleLaunchDecision(presetId: string) {
    if (!activeTaskId) return;
    setLaunchingPresetId(presetId);
    try {
      await launchDecision(activeTaskId, presetId);
    } finally {
      setLaunchingPresetId(null);
    }
  }

  async function handleSubmitOperatorAction(payload: {
    action: MissionOperatorActionType;
    reason?: string;
  }) {
    if (!activeTaskId) return;
    try {
      await submitOperatorAction(activeTaskId, {
        action: payload.action,
        reason: payload.reason,
      });
      toast.success(
        copy.tasks.listPage.actionSuccess(
          copy.tasks.statuses.action[
            payload.action === "mark-blocked" ? "markBlocked" : payload.action
          ]
        )
      );
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : copy.tasks.listPage.actionError;
      toast.error(message);
      throw submitError;
    }
  }

  const refreshCurrent = () =>
    void refresh({ preferredTaskId: activeTaskId || null });
  const focusTitle =
    selectedDetail?.title ||
    selectedTaskSummary?.title ||
    t(locale, "等待选择任务", "Pick a task to inspect");
  const focusSummary =
    compactText(
      selectedDetail?.summary ||
        selectedTaskSummary?.summary ||
        selectedTaskSummary?.sourceText ||
        t(
          locale,
          "任务页现在只负责展示队列、任务详情和执行轨迹；发起与补充信息入口统一保留在办公室首页。",
          "Tasks is now display-only for queue, details, and execution history. Launch and clarification live on the office home page."
        ),
      220
    ) ||
    t(
      locale,
      "任务页现在只负责展示队列、任务详情和执行轨迹；发起与补充信息入口统一保留在办公室首页。",
      "Tasks is now display-only for queue, details, and execution history. Launch and clarification live on the office home page."
    );
  const queueSummary = t(
    locale,
    `可见 ${filteredTasks.length} / 共 ${tasks.length} 条`,
    `${filteredTasks.length} visible / ${tasks.length} total`
  );
  const displayOnlyHint = t(
    locale,
    "此页只做查看与跟进，不再承担发起或补问入口。",
    "This page is now read-only for viewing and follow-up, without launch or clarification entry."
  );
  const taskOverviewPanel = (
    <section className="workspace-panel workspace-panel-strong rounded-[28px] border border-stone-200/70 px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="workspace-eyebrow">
            {t(locale, "任务焦点总览", "Task Focus Overview")}
          </div>
          <div className="mt-2 text-xl font-semibold tracking-tight text-stone-900">
            {focusTitle}
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">
            {focusSummary}
          </p>
        </div>

        <div className="shrink-0 rounded-full border border-stone-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-stone-600">
          {queueSummary}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className={cn(
            "workspace-status px-3 py-1 text-xs font-semibold",
            selectedDetail
              ? missionStatusTone(selectedDetail.status)
              : "workspace-tone-neutral"
          )}
        >
          {selectedDetail
            ? missionStatusLabel(selectedDetail.status, locale)
            : t(locale, "待选择", "No selection")}
        </span>
        <span
          className={cn(
            "workspace-status px-3 py-1 text-xs font-semibold",
            selectedDetail
              ? missionOperatorStateTone(selectedDetail.operatorState)
              : "workspace-tone-neutral"
          )}
        >
          {selectedDetail
            ? missionOperatorStateLabel(selectedDetail.operatorState, locale)
            : t(locale, "只读展示", "Display only")}
        </span>
        <span className="workspace-status workspace-tone-warning px-3 py-1 text-xs font-semibold">
          {displayOnlyHint}
        </span>
      </div>
    </section>
  );
  const taskDetailPanel = (
    <TasksCockpitDetail
      detail={selectedDetail}
      decisionNote={decisionNote}
      onDecisionNoteChange={value => {
        if (!activeTaskId) return;
        setDecisionNote(activeTaskId, value);
      }}
      onLaunchDecision={handleLaunchDecision}
      launchingPresetId={launchingPresetId}
      onSubmitOperatorAction={handleSubmitOperatorAction}
      operatorActionLoading={
        activeTaskId
          ? (operatorActionLoadingByMissionId[activeTaskId] ?? {})
          : {}
      }
      onDecisionSubmitted={refreshCurrent}
      className="h-full min-h-0"
    />
  );
  const taskWorkbenchPanel = (
    <Tabs
      value={activeTab}
      onValueChange={value => {
        if (isTasksWorkbenchTab(value)) {
          setActiveTab(value);
        }
      }}
      className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-stone-200/70 bg-white/38 p-2 shadow-[0_18px_42px_rgba(99,73,45,0.08)] backdrop-blur-md"
    >
      <TabsList className="grid h-auto w-full grid-cols-5 gap-1 rounded-[18px] bg-white/82 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
        <TabsTrigger className={taskWorkbenchTriggerClassName} value="task">
          {t(locale, "任务", "Task")}
        </TabsTrigger>
        <TabsTrigger className={taskWorkbenchTriggerClassName} value="flow">
          {t(locale, "团队流", "Flow")}
        </TabsTrigger>
        <TabsTrigger className={taskWorkbenchTriggerClassName} value="agent">
          Agent
        </TabsTrigger>
        <TabsTrigger className={taskWorkbenchTriggerClassName} value="memory">
          {t(locale, "记忆", "Memory")}
        </TabsTrigger>
        <TabsTrigger className={taskWorkbenchTriggerClassName} value="history">
          {t(locale, "历史", "History")}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="task"
        className="mt-2 h-full min-h-0 flex-1 overflow-hidden"
      >
        {taskDetailPanel}
      </TabsContent>

      <TabsContent
        value="flow"
        className="mt-2 h-full min-h-0 flex-1 overflow-hidden"
      >
        <TasksWorkbenchContextShell
          title={t(locale, "团队流", "Flow")}
          description={t(
            locale,
            "围绕当前任务展示 workflow 阶段、组织结构、输入附件和工作包。",
            "Inspect workflow stages, organization context, input attachments, and work packages around the selected task."
          )}
        >
          <OfficeWorkflowFlowPanel
            workflow={activeWorkflow}
            missionDetail={selectedDetail}
            onOpenTask={taskId => {
              setActiveTab("task");
              startTransition(() => {
                selectTask(taskId);
              });
            }}
          />
        </TasksWorkbenchContextShell>
      </TabsContent>

      <TabsContent
        value="agent"
        className="mt-2 h-full min-h-0 flex-1 overflow-hidden"
      >
        <TasksWorkbenchContextShell
          title="Agent"
          description={t(
            locale,
            "查看办公室 Agent、团队站位和 heartbeat 状态，任务页不再提供发起入口。",
            "Inspect office agents, team placement, and heartbeat state without adding a launch entry to the tasks page."
          )}
        >
          {availability.agent ? (
            <OfficeAgentInspectorPanel className="h-full" embedded />
          ) : (
            <TasksWorkbenchEmptyState
              title={t(
                locale,
                "还没有可查看的 Agent",
                "No agent is available yet"
              )}
              description={t(
                locale,
                "等待团队或场景 Agent 建立后，这里会显示 Agent 详情与状态。",
                "After team or scene agents are available, this tab will show agent details and status."
              )}
            />
          )}
        </TasksWorkbenchContextShell>
      </TabsContent>

      <TabsContent
        value="memory"
        className="mt-2 h-full min-h-0 flex-1 overflow-hidden"
      >
        <TasksWorkbenchContextShell
          title={t(locale, "记忆与报告", "Memory and reports")}
          description={t(
            locale,
            "复用办公室上下文面板查看最近记忆、搜索结果和 heartbeat 报告。",
            "Reuse the office context panel for recent memory, search results, and heartbeat reports."
          )}
        >
          <OfficeMemoryReportsPanel workflow={activeWorkflow} />
        </TasksWorkbenchContextShell>
      </TabsContent>

      <TabsContent
        value="history"
        className="mt-2 h-full min-h-0 flex-1 overflow-hidden"
      >
        <TasksWorkbenchContextShell
          title={t(locale, "历史", "History")}
          description={t(
            locale,
            "保留 workflow 连续性，选择有 mission 的历史项时同步任务队列焦点。",
            "Keep workflow continuity visible and sync the task queue focus when a history item has a mission."
          )}
        >
          <OfficeWorkflowHistoryPanel
            workflow={activeWorkflow}
            activeWorkflowId={activeWorkflow?.id || null}
            onSelectWorkflow={workflowId => {
              setCurrentWorkflow(workflowId);
              const matched = workflows.find(
                workflow => workflow.id === workflowId
              );
              if (matched?.missionId) {
                startTransition(() => {
                  selectTask(matched.missionId!);
                });
              }
              setActiveTab("flow");
            }}
          />
        </TasksWorkbenchContextShell>
      </TabsContent>
    </Tabs>
  );

  return (
    <div
      className={cn(
        "workspace-page text-stone-900",
        isMobile
          ? "min-h-screen pb-28 pt-[calc(env(safe-area-inset-top)+96px)]"
          : isLockedCockpit
            ? "h-screen overflow-hidden"
            : "min-h-screen pb-32 pt-3",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1720px] flex-col px-3 md:px-4",
          isLockedCockpit ? "h-full py-4" : "min-h-screen py-3"
        )}
      >
        {isWideDesktop ? (
          <div
            className={cn(
              "grid min-h-0 flex-1 gap-3 xl:grid-cols-[296px_minmax(0,1fr)]",
              isLockedCockpit && "overflow-hidden"
            )}
          >
            <TasksQueueRail
              tasks={filteredTasks}
              totalCount={tasks.length}
              activeTaskId={activeTaskId}
              highlightedTaskId={highlightedTaskId}
              loading={loading}
              ready={ready}
              error={error}
              search={search}
              onSearchChange={setSearch}
              onSelectTask={taskId => {
                startTransition(() => {
                  selectTask(taskId);
                });
              }}
              onRefresh={refreshCurrent}
              className={cn(
                isLockedCockpit ? "h-full min-h-0" : "min-h-[640px]"
              )}
            />

            <div className="min-w-0 flex min-h-0 flex-col gap-3">
              <div className={cn(isLockedCockpit && "shrink-0")}>
                {taskOverviewPanel}
              </div>

              {taskWorkbenchPanel}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {taskOverviewPanel}

            <TasksQueueRail
              tasks={filteredTasks}
              totalCount={tasks.length}
              activeTaskId={activeTaskId}
              highlightedTaskId={highlightedTaskId}
              loading={loading}
              ready={ready}
              error={error}
              search={search}
              onSearchChange={setSearch}
              onSelectTask={taskId => {
                startTransition(() => {
                  selectTask(taskId);
                });
              }}
              onRefresh={refreshCurrent}
              className="min-h-[320px] max-h-[460px]"
            />

            <div className="min-h-[560px]">{taskWorkbenchPanel}</div>
          </div>
        )}
      </div>
    </div>
  );
}
