import {
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Waves,
  X,
} from "lucide-react";
import { useLocation } from "wouter";

import { AppSidebar } from "@/components/AppSidebar";
import { ChatPanel } from "@/components/ChatPanel";
import { GitHubRepoBadge } from "@/components/GitHubRepoBadge";
import { UnifiedLaunchComposer } from "@/components/launch/UnifiedLaunchComposer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { OfficeTaskCockpit } from "@/components/office/OfficeTaskCockpit";
import { AgentDetailDrawer } from "@/components/scene/AgentDetailDrawer";
import { OfficeNoticeBoard } from "@/components/scene/OfficeNoticeBoard";
import { Scene3D } from "@/components/Scene3D";
import { TelemetryDashboard } from "@/components/TelemetryDashboard";
import { UEOverlayChrome, type HUDDefinition } from "@/components/ue-overlay";
import { WorkflowPanel } from "@/components/WorkflowPanel";
import {
  useViewportResizeState,
  useViewportTier,
  useViewportWidth,
} from "@/hooks/useViewportTier";
import { useDemoMode } from "@/hooks/useDemoMode";
import { useWorkflowRuntimeBootstrap } from "@/hooks/useWorkflowRuntimeBootstrap";
import { useI18n } from "@/i18n";
import { CAN_USE_ADVANCED_RUNTIME, IS_GITHUB_PAGES } from "@/lib/deploy-target";
import {
  type CreateProjectInput,
  type ProjectArtifactType,
  type Project,
  type ProjectRoute,
  type ProjectSpec,
  useProjectStore,
} from "@/lib/project-store";
import { buildOfficeNoticeBoardSnapshot } from "@/lib/scene-agent-detail";
import { useAppStore } from "@/lib/store";
import { useTelemetryStore } from "@/lib/telemetry-store";
import { useTasksStore } from "@/lib/tasks-store";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/workflow-store";

const HOME_DESKTOP_CHROME_CSS = `
.home-desktop-sidebar-shell aside[data-sidebar-tone="glass"] {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 252, 255, 0.66) 58%, rgba(236, 249, 255, 0.36) 100%) !important;
  border-color: rgba(186, 230, 253, 0.48) !important;
  color: #334155 !important;
  box-shadow: 18px 0 58px rgba(14, 165, 233, 0.1), inset -1px 0 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(30px) saturate(1.18);
}

.home-desktop-sidebar-shell aside[data-sidebar-tone="glass"] * {
  color: inherit;
}

.home-desktop-sidebar-shell aside[data-sidebar-tone="glass"] button {
  border-color: transparent;
}

.home-desktop-sidebar-shell aside[data-sidebar-tone="glass"] button:hover {
  border-color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.54) !important;
  color: #0f172a !important;
}

.home-desktop-sidebar-shell aside[data-sidebar-tone="glass"] button[aria-current="page"] {
  background: rgba(255, 255, 255, 0.86) !important;
  border-color: rgba(186, 230, 253, 0.82) !important;
  box-shadow: 0 18px 40px rgba(14, 165, 233, 0.18), 0 6px 18px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.96);
  color: #0f172a !important;
}

.home-desktop-sidebar-shell aside[data-sidebar-tone="glass"] button[aria-current="page"] *,
.home-desktop-sidebar-shell aside[data-sidebar-tone="glass"] button[aria-current="page"] svg {
  color: inherit;
}

.home-desktop-sidebar-shell aside[data-sidebar-tone="glass"] [data-sidebar-status-card="glass"] {
  background: rgba(255, 255, 255, 0.48) !important;
  border-color: rgba(255, 255, 255, 0.58) !important;
}

.home-first-screen-cockpit > .pointer-events-none.absolute.inset-0.z-20 > section {
  justify-content: center;
  padding-bottom: clamp(24px, 8vh, 96px);
}
`;

function formatMaterialSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function stripFileExtension(name: string) {
  return name.replace(/\.[^/.]+$/, "").trim();
}

function classifyMaterialArtifact(
  name: string,
  mimeType: string
): ProjectArtifactType {
  const normalizedName = name.toLowerCase();
  if (normalizedName.endsWith(".svg")) return "svg";
  if (mimeType.startsWith("image/")) return "screenshot";
  if (
    mimeType.includes("json") ||
    normalizedName.endsWith(".csv") ||
    normalizedName.endsWith(".json")
  ) {
    return "dataset";
  }
  if (
    normalizedName.endsWith(".ts") ||
    normalizedName.endsWith(".tsx") ||
    normalizedName.endsWith(".js") ||
    normalizedName.endsWith(".jsx") ||
    normalizedName.endsWith(".py")
  ) {
    return "code";
  }
  return "doc";
}

function getProjectSpecCompletenessScore(spec: ProjectSpec | null) {
  if (!spec) return null;
  const score = spec.completenessDetail?.score ?? spec.completeness;
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  return Math.min(1, Math.max(0, score));
}

function compactSpecSummary(content: string, maxLength = 140) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function formatProjectRouteKind(kind: ProjectRoute["kind"] | undefined) {
  if (!kind) return "Route";
  return kind.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function summarizeProjectRouteSteps(route: ProjectRoute) {
  if (!route.steps?.length) return "Steps pending";
  return route.steps
    .slice(0, 3)
    .map(step => step.title)
    .join(" / ");
}

export interface HomeProps {
  projectId?: string;
}

interface ProjectEditDraft {
  id: string;
  name: string;
  summary: string;
}

export default function Home({ projectId }: HomeProps = {}) {
  const isSceneReady = useAppStore(state => state.isSceneReady);
  const hydrateAIConfig = useAppStore(state => state.hydrateAIConfig);
  const runtimeMode = useAppStore(state => state.runtimeMode);
  const setRuntimeMode = useAppStore(state => state.setRuntimeMode);
  const locale = useAppStore(state => state.locale);
  const toggleLocale = useAppStore(state => state.toggleLocale);
  const toggleConfig = useAppStore(state => state.toggleConfig);
  const selectedPet = useAppStore(state => state.selectedPet);
  const setSelectedPet = useAppStore(state => state.setSelectedPet);
  const fetchTelemetry = useTelemetryStore(state => state.fetchInitial);
  const telemetrySnapshot = useTelemetryStore(state => state.snapshot);
  const ensureProjectsReady = useProjectStore(state => state.ensureReady);
  const projects = useProjectStore(state => state.projects);
  const createProject = useProjectStore(state => state.createProject);
  const selectProject = useProjectStore(state => state.selectProject);
  const updateProject = useProjectStore(state => state.updateProject);
  const archiveProject = useProjectStore(state => state.archiveProject);
  const addProjectArtifact = useProjectStore(state => state.addProjectArtifact);
  const currentProjectId = useProjectStore(state => state.currentProjectId);
  const projectSpecs = useProjectStore(state => state.specs);
  const projectRoutes = useProjectStore(state => state.routes);
  const projectMissions = useProjectStore(state => state.missions);
  const projectEvidence = useProjectStore(state => state.evidence);
  const projectClarificationQuestions = useProjectStore(
    state => state.clarificationQuestions
  );
  const visibleProjects = useMemo(
    () => projects.filter(project => project.status !== "archived"),
    [projects]
  );
  const projectCount = visibleProjects.length;
  const routeProject = useMemo(
    () =>
      projectId
        ? (visibleProjects.find(project => project.id === projectId) ?? null)
        : null,
    [projectId, visibleProjects]
  );
  const currentProject = routeProject;
  const isProjectHub = !projectId || !routeProject;
  const ensureTasksReady = useTasksStore(state => state.ensureReady);
  const createMission = useTasksStore(state => state.createMission);
  const missionTasks = useTasksStore(state => state.tasks);
  const missionDetailsById = useTasksStore(state => state.detailsById);
  const selectedTaskId = useTasksStore(state => state.selectedTaskId);
  const selectTask = useTasksStore(state => state.selectTask);
  const agents = useWorkflowStore(state => state.agents);
  const workflows = useWorkflowStore(state => state.workflows);
  const heartbeatStatuses = useWorkflowStore(state => state.heartbeatStatuses);
  const disconnectSocket = useWorkflowStore(state => state.disconnectSocket);
  const toggleWorkflowPanel = useWorkflowStore(
    state => state.toggleWorkflowPanel
  );
  const openWorkflowPanel = useWorkflowStore(state => state.openWorkflowPanel);
  const { isMobile } = useViewportTier();
  const viewportWidth = useViewportWidth();
  const resizeActive = useViewportResizeState();
  const { copy } = useI18n();
  const [, setLocation] = useLocation();
  const { startDemo } = useDemoMode();
  const ueVideoRef = useMemo(() => createRef<HTMLVideoElement>(), []);
  const materialInputRef = useRef<HTMLInputElement>(null);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [editingProject, setEditingProject] = useState<ProjectEditDraft | null>(
    null
  );
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<
    string | null
  >(null);

  useWorkflowRuntimeBootstrap({
    heartbeatReportLimit: 18,
    deferSecondary: true,
  });

  const handleStartDemo = useCallback(async () => {
    try {
      const { DEMO_BUNDLE } = await import("@/runtime/demo-data/bundle");
      await startDemo(DEMO_BUNDLE as any);
      setLocation("/tasks");
    } catch (err) {
      console.warn("[Home] Demo bundle not available yet:", err);
    }
  }, [setLocation, startDemo]);

  useEffect(() => {
    hydrateAIConfig().catch(error => {
      console.error("[Home] Failed to load AI config:", error);
    });
  }, [hydrateAIConfig]);

  useEffect(() => {
    if (runtimeMode === "frontend") {
      disconnectSocket();
    }
  }, [disconnectSocket, runtimeMode]);

  useEffect(() => {
    if (isSceneReady && runtimeMode === "advanced") {
      fetchTelemetry();
    }
  }, [fetchTelemetry, isSceneReady, runtimeMode]);

  useEffect(() => {
    ensureProjectsReady();
  }, [ensureProjectsReady]);

  useEffect(() => {
    if (projectId && routeProject && currentProjectId !== routeProject.id) {
      selectProject(routeProject.id);
    }
  }, [currentProjectId, projectId, routeProject, selectProject]);

  useEffect(() => {
    ensureTasksReady().catch(error => {
      console.warn("[Home] Failed to hydrate mission summaries:", error);
    });
  }, [ensureTasksReady]);

  const agentCount = agents.length || 18;
  const activeWorkflows =
    missionTasks.length > 0
      ? missionTasks.filter(
          task => task.status === "running" || task.status === "waiting"
        ).length
      : workflows.filter(
          workflow =>
            workflow.status === "running" || workflow.status === "pending"
        ).length;

  const noticeBoardSnapshot = useMemo(() => {
    if (!isMobile) return null;

    return buildOfficeNoticeBoardSnapshot({
      locale,
      runtimeMode,
      missionTasks,
      missionDetailsById,
      workflows,
      heartbeatStatuses,
      totalTokens:
        (telemetrySnapshot?.totalTokensIn ?? 0) +
        (telemetrySnapshot?.totalTokensOut ?? 0),
      totalCost: telemetrySnapshot?.totalCost ?? 0,
    });
  }, [
    heartbeatStatuses,
    isMobile,
    locale,
    missionDetailsById,
    missionTasks,
    runtimeMode,
    telemetrySnapshot,
    workflows,
  ]);

  const handleOpenCurrentMission = selectedTaskId
    ? () => {
        selectTask(selectedTaskId);
        setLocation(`/tasks/${selectedTaskId}`);
      }
    : undefined;
  const isZh = locale === "zh-CN";
  const fullWorkbenchLabel = isZh ? "执行明细 / 接管任务" : "Execution details";
  const workflowLabel = isZh ? "打开工作流" : copy.home.openWorkflow;
  const demoLabel = isZh ? "载入演示" : copy.home.liveDemo;
  const configLabel = isZh ? "运行时配置" : copy.home.openConfig;
  const frontendModeLabel = isZh ? "前端模式" : "Frontend";
  const advancedModeLabel = isZh ? "高级模式" : "Advanced";
  const officeNavLabel = isZh ? "项目空间" : "Project Space";
  const projectSpaceLabel = isZh ? "项目空间" : "Project Space";
  const autopilotLabel = isZh ? "自动驾驶" : "Autopilot";
  const backToProjectSpaceLabel = isZh
    ? "返回项目空间"
    : "Back to Project Space";
  const openAutopilotLabel = isZh ? "进入自动驾驶" : "Open Autopilot";
  const projectHubTitle = projectSpaceLabel;
  const projectHubSubtitle = isZh
    ? "先在项目空间新建或选择项目，点击项目卡片后进入这个项目自己的自动驾驶。后续澄清、Spec、路线、执行和证据都会绑定在这个项目里。"
    : "Create or choose a project in Project Space. Open a project card to enter its Autopilot, where clarification, specs, routes, missions, and evidence stay scoped to that project.";
  const projectHeroTitle = currentProject
    ? currentProject.name
    : projectHubTitle;
  const projectHeroSubtitle = currentProject
    ? currentProject.summary ||
      currentProject.goal ||
      (isZh
        ? "继续澄清当前项目，沉淀 spec，规划路线并执行。"
        : "Clarify the current project, evolve specs, plan routes, and execute.")
    : projectHubSubtitle;
  const projectStatusLabel = currentProject
    ? currentProject.status
        .replace(/_/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase())
    : isZh
      ? "项目入口"
      : "Project hub";
  const projectBundleStats = useMemo(() => {
    if (!currentProject) {
      return { specs: 0, routes: 0, missions: 0, evidence: 0 };
    }

    const projectId = currentProject.id;

    return {
      specs: projectSpecs.filter(item => item.projectId === projectId).length,
      routes: projectRoutes.filter(item => item.projectId === projectId).length,
      missions: projectMissions.filter(item => item.projectId === projectId)
        .length,
      evidence: projectEvidence.filter(item => item.projectId === projectId)
        .length,
    };
  }, [
    currentProject,
    projectEvidence,
    projectMissions,
    projectRoutes,
    projectSpecs,
  ]);
  const getProjectStats = useCallback(
    (project: Project) => ({
      specs: projectSpecs.filter(item => item.projectId === project.id).length,
      routes: projectRoutes.filter(item => item.projectId === project.id)
        .length,
      missions: projectMissions.filter(item => item.projectId === project.id)
        .length,
      evidence: projectEvidence.filter(item => item.projectId === project.id)
        .length,
      openQuestions: projectClarificationQuestions.filter(
        item =>
          item.projectId === project.id && !item.answeredAt && !item.skippedAt
      ).length,
    }),
    [
      projectClarificationQuestions,
      projectEvidence,
      projectMissions,
      projectRoutes,
      projectSpecs,
    ]
  );
  const currentProjectSpec = useMemo(() => {
    if (!currentProject) return null;
    if (currentProject.currentSpecId) {
      return (
        projectSpecs.find(spec => spec.id === currentProject.currentSpecId) ??
        null
      );
    }
    return (
      projectSpecs
        .filter(
          spec =>
            spec.projectId === currentProject.id && spec.status !== "superseded"
        )
        .slice()
        .sort((a, b) => b.version - a.version)[0] ?? null
    );
  }, [currentProject, projectSpecs]);
  const currentSpecCompletenessScore =
    getProjectSpecCompletenessScore(currentProjectSpec);
  const currentSpecCompletenessLabel =
    currentSpecCompletenessScore == null
      ? "Completeness pending"
      : `${Math.round(currentSpecCompletenessScore * 100)}% complete`;
  const currentSpecSourceLabel = currentProjectSpec
    ? [
        `${currentProjectSpec.sourceMessageIds?.length ?? 0} messages`,
        `${currentProjectSpec.sourceEvidenceIds?.length ?? 0} evidence`,
        `${currentProjectSpec.sourceArtifactIds?.length ?? 0} artifacts`,
      ].join(" / ")
    : "";
  const currentSpecSummary = currentProjectSpec
    ? compactSpecSummary(currentProjectSpec.content || currentProjectSpec.title)
    : "";
  const currentProjectRouteCards = useMemo(() => {
    if (!currentProject) return [];
    const routes = projectRoutes.filter(
      route => route.projectId === currentProject.id
    );
    const currentRouteId = currentProject.currentRouteId;

    return routes
      .slice()
      .sort((a, b) => {
        const aCurrent =
          (currentRouteId && a.id === currentRouteId) || Boolean(a.selectedAt);
        const bCurrent =
          (currentRouteId && b.id === currentRouteId) || Boolean(b.selectedAt);
        if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
        return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      })
      .slice(0, 3);
  }, [currentProject, projectRoutes]);
  const projectClarificationProgress = useMemo(() => {
    if (!currentProject) {
      return {
        total: 0,
        answered: 0,
        skipped: 0,
        open: 0,
        requiredOpen: 0,
        skippableOpen: 0,
        openSummary: "No active project.",
      };
    }

    const questions = projectClarificationQuestions.filter(
      question => question.projectId === currentProject.id
    );
    const openQuestions = questions.filter(
      question => !question.answeredAt && !question.skippedAt
    );

    return {
      total: questions.length,
      answered: questions.filter(question => question.answeredAt).length,
      skipped: questions.filter(question => question.skippedAt).length,
      open: openQuestions.length,
      requiredOpen: openQuestions.filter(question => question.required).length,
      skippableOpen: openQuestions.filter(
        question => !question.required || Boolean(question.defaultAssumption)
      ).length,
      openSummary:
        openQuestions[0]?.text ??
        (questions.length
          ? "All clarification questions captured."
          : "No clarification questions yet."),
    };
  }, [currentProject, projectClarificationQuestions]);
  const projectClarificationResolved =
    projectClarificationProgress.answered +
    projectClarificationProgress.skipped;
  const projectStageInsight = useMemo(() => {
    if (!currentProject) {
      return {
        title: isZh ? "先创建项目" : "Create a project first",
        description: isZh
          ? "选择模板、导入资料，或直接在输入框描述目标。"
          : "Use a template, import materials, or describe the goal in the input.",
        nextAction: isZh
          ? "创建 / 导入 / 输入目标"
          : "Create / import / describe",
        activeStep: 0,
      };
    }

    switch (currentProject.status) {
      case "draft":
      case "clarifying":
        return {
          title: isZh ? "澄清目标与边界" : "Clarify goal and boundaries",
          description: isZh
            ? "补齐用户、权限、成功标准、约束和交付物，先把项目说清楚。"
            : "Fill in users, permissions, success criteria, constraints, and deliverables before execution.",
          nextAction: isZh ? "继续问答 / 补全信息" : "Continue Q&A",
          activeStep: 1,
        };
      case "spec_ready":
        return {
          title: isZh
            ? "检查 Spec 并准备路线"
            : "Review spec and prepare routes",
          description: isZh
            ? `已有 ${projectBundleStats.specs} 个 spec，可以开始比较主路线和备选路线。`
            : `${projectBundleStats.specs} spec${projectBundleStats.specs === 1 ? "" : "s"} ready; compare the main and fallback routes next.`,
          nextAction: isZh ? "选择执行路线" : "Choose execution route",
          activeStep: 2,
        };
      case "planning":
        return {
          title: isZh ? "选择 FSD 执行路径" : "Select the FSD route",
          description: isZh
            ? `当前有 ${projectBundleStats.routes} 条路线沉淀，下一步确认主路线、保守路线或深度路线。`
            : `${projectBundleStats.routes} route${projectBundleStats.routes === 1 ? "" : "s"} captured; confirm the main, conservative, or deep route next.`,
          nextAction: isZh ? "确认路线 / 准备执行" : "Confirm route",
          activeStep: 3,
        };
      case "executing":
        return {
          title: isZh
            ? "监控执行与接管点"
            : "Monitor execution and takeover points",
          description: isZh
            ? `已有 ${projectBundleStats.missions} 个 mission 关联项目，当前活跃执行 ${activeWorkflows} 个。`
            : `${projectBundleStats.missions} mission${projectBundleStats.missions === 1 ? "" : "s"} linked; ${activeWorkflows} currently active.`,
          nextAction: isZh ? "查看执行明细" : "Open execution details",
          activeStep: 4,
        };
      case "paused":
        return {
          title: isZh ? "等待接管决策" : "Waiting for takeover",
          description: isZh
            ? "项目暂停在人工确认点，先处理阻塞、决策或补充说明。"
            : "The project is paused at a human decision point; resolve blockers or add guidance.",
          nextAction: isZh ? "接管任务" : "Take over",
          activeStep: 4,
        };
      case "completed":
        return {
          title: isZh ? "复盘证据与产物" : "Review evidence and artifacts",
          description: isZh
            ? `项目已完成，沉淀了 ${projectBundleStats.evidence} 条证据，可进入复盘和归档。`
            : `Project completed with ${projectBundleStats.evidence} evidence item${projectBundleStats.evidence === 1 ? "" : "s"} ready for replay and archive.`,
          nextAction: isZh ? "查看证据回放" : "Review evidence",
          activeStep: 5,
        };
      default:
        return {
          title: isZh ? "项目已归档" : "Project archived",
          description: isZh
            ? "这个项目已归档，建议切换到活跃项目继续推进。"
            : "This project is archived. Switch to an active project to continue.",
          nextAction: isZh ? "切换项目" : "Switch project",
          activeStep: 5,
        };
    }
  }, [activeWorkflows, currentProject, isZh, projectBundleStats]);
  const projectStageSteps = useMemo(
    () =>
      isZh
        ? ["项目", "澄清", "Spec", "路线", "执行", "证据"]
        : ["Project", "Clarify", "Spec", "Route", "Execute", "Evidence"],
    [isZh]
  );
  const projectSearchPlaceholder = isZh
    ? "搜索项目名称、目标或描述"
    : "Search projects by name, goal, or summary";
  const filteredProjects = useMemo(() => {
    const query = projectSearchQuery.trim().toLowerCase();
    if (!query) return visibleProjects;

    return visibleProjects.filter(project =>
      [project.name, project.goal, project.summary ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [projectSearchQuery, visibleProjects]);
  const recentProjects = useMemo(
    () =>
      visibleProjects
        .slice()
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        .slice(0, 4),
    [visibleProjects]
  );
  const projectTemplates = useMemo(
    () =>
      [
        {
          name: isZh ? "权限管理系统" : "Permission system",
          goal: isZh
            ? "设计并实现一个可演化的权限管理系统"
            : "Design and implement an evolvable permission management system",
          summary: isZh
            ? "从角色、资源、策略、审计开始澄清。"
            : "Start by clarifying roles, resources, policies, and audit needs.",
          status: "clarifying",
        },
        {
          name: isZh ? "GitHub 调研简报" : "Research brief",
          goal: isZh
            ? "调研同类 GitHub 仓库并沉淀成项目 spec"
            : "Research comparable GitHub repositories and turn findings into a project spec",
          summary: isZh
            ? "适合先做资料收集、对比和证据归档。"
            : "Good for collecting sources, comparing options, and keeping evidence.",
          status: "clarifying",
        },
        {
          name: isZh ? "产品规格文档" : "Product spec",
          goal: isZh
            ? "把一个产品想法澄清、拆解并演化成可执行 spec"
            : "Clarify, decompose, and evolve a product idea into an executable spec",
          summary: isZh
            ? "适合从目标、用户、约束和路线开始推进。"
            : "Good for moving from goals, users, constraints, and routes.",
          status: "clarifying",
        },
      ] satisfies CreateProjectInput[],
    [isZh]
  );
  const handleCreateProjectFromTemplate = useCallback(
    (template: CreateProjectInput) => {
      const project = createProject(template);
      selectProject(project.id);
      setLocation("/projects");
    },
    [createProject, selectProject, setLocation]
  );
  const handleImportMaterials = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? []);
      if (files.length === 0) return;

      const fileNames = files.map(file => file.name);
      const firstName = stripFileExtension(fileNames[0] ?? "");
      const project = createProject({
        name:
          files.length === 1
            ? firstName || (isZh ? "资料导入项目" : "Imported materials")
            : isZh
              ? `资料导入项目 (${files.length})`
              : `Imported materials (${files.length})`,
        goal: isZh
          ? "整理导入资料，澄清目标，并演化成项目 spec"
          : "Organize imported materials, clarify the goal, and evolve them into a project spec",
        summary: isZh
          ? `已导入 ${files.length} 个资料文件，下一步会先做资料归纳与补问。`
          : `${files.length} material file${files.length === 1 ? "" : "s"} imported; next step is summarization and clarification.`,
        status: "clarifying",
      });

      files.slice(0, 24).forEach(file => {
        addProjectArtifact({
          projectId: project.id,
          type: classifyMaterialArtifact(file.name, file.type),
          title: file.name,
          contentPreview: `${formatMaterialSize(file.size)} · ${
            file.type || "unknown type"
          }`,
        });
      });

      selectProject(project.id);
      setLocation("/projects");
      event.currentTarget.value = "";
    },
    [addProjectArtifact, createProject, isZh, selectProject, setLocation]
  );
  const handleStartEditProject = useCallback((project: Project) => {
    setEditingProject({
      id: project.id,
      name: project.name,
      summary: project.summary || project.goal,
    });
    setConfirmDeleteProjectId(null);
  }, []);
  const handleCancelEditProject = useCallback(() => {
    setEditingProject(null);
  }, []);
  const handleSaveProjectEdit = useCallback(() => {
    if (!editingProject) return;
    const name = editingProject.name.trim();
    const summary = editingProject.summary.trim();
    if (!name) return;

    updateProject(editingProject.id, {
      name,
      summary: summary || undefined,
    });
    setEditingProject(null);
  }, [editingProject, updateProject]);
  const handleDeleteProject = useCallback(
    (project: Project) => {
      if (confirmDeleteProjectId !== project.id) {
        setConfirmDeleteProjectId(project.id);
        setEditingProject(current =>
          current?.id === project.id ? null : current
        );
        return;
      }

      archiveProject(project.id);
      if (currentProjectId === project.id) {
        selectProject(null);
      }
      setConfirmDeleteProjectId(null);
      setEditingProject(current =>
        current?.id === project.id ? null : current
      );
    },
    [archiveProject, confirmDeleteProjectId, currentProjectId, selectProject]
  );
  const runtimeChipLabel = isZh
    ? `当前模式：${runtimeMode === "advanced" ? "高级模式" : "前端模式"}`
    : copy.home.runtimeChip(
        copy.toolbar.runtimeLabels[
          runtimeMode === "advanced" ? "advanced" : "frontend"
        ]
      );

  const localeLabel =
    locale === "zh-CN" ? copy.common.englishShort : copy.common.chineseShort;
  const scenePerformanceProfile =
    resizeActive && !isMobile ? "resizing" : "balanced";
  const desktopSidebarWidth = isMobile ? 0 : viewportWidth >= 1280 ? 248 : 64;
  const sceneLayer = (
    <Scene3D
      performanceProfile={scenePerformanceProfile}
      sidebarWidth={desktopSidebarWidth}
    />
  );
  const hudDefinitions: HUDDefinition[] = useMemo(
    () =>
      agents.slice(0, 8).flatMap(agent => [
        {
          id: `${agent.id}-name`,
          type: "nameTag",
          characterId: agent.id,
          data: { name: agent.name },
        },
        {
          id: `${agent.id}-status`,
          type: "statusIcon",
          characterId: agent.id,
          data: {
            icon: agent.status === "idle" ? "o" : "*",
            status: agent.status,
          },
        },
      ]),
    [agents]
  );
  const desktopGlassClass = resizeActive
    ? "border-slate-200/90 bg-[hsl(var(--background))]/96 shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
    : "border-white/64 bg-[rgba(248,250,252,0.78)] shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur";
  const utilityChipClass = resizeActive
    ? "border-slate-200/90 bg-[hsl(var(--background))]/96 shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
    : "border-white/68 bg-[rgba(248,250,252,0.82)] shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur";

  return (
    <div className="relative h-[100svh] w-screen overflow-hidden bg-[linear-gradient(180deg,#eef6fb_0%,#f7fbfd_48%,#e5f1f4_100%)]">
      <style>{HOME_DESKTOP_CHROME_CSS}</style>
      {isMobile ? (
        sceneLayer
      ) : (
        <UEOverlayChrome
          videoElement={ueVideoRef}
          mediaLayer={sceneLayer}
          hudDefinitions={hudDefinitions}
          viewportWidth={viewportWidth}
          overlayTone="clear"
          backgroundClassName="bg-[linear-gradient(180deg,#eef6fb_0%,#f7fbfd_48%,#e5f1f4_100%)]"
          sidebar={
            <div className="home-desktop-sidebar-shell h-full">
              <AppSidebar
                collapsed={viewportWidth < 1280}
                onToggleCollapse={() => undefined}
                embedded
              />
            </div>
          }
        >
          {isSceneReady ? (
            <div className="home-desktop-workspace relative h-full min-h-0">
              <div
                className="absolute inset-x-0 top-0 z-[60] px-3 py-2 xl:px-4"
                data-testid="home-desktop-toolbar"
                style={{ pointerEvents: "auto" }}
              >
                <div className="relative flex items-center justify-between gap-2">
                  <div
                    className="pointer-events-none fixed left-1/2 top-3 z-[70] flex -translate-x-1/2 justify-center"
                    data-testid="home-desktop-center-controls"
                  >
                    <div className="pointer-events-auto flex items-center gap-2">
                      <div
                        className={cn(
                          "flex items-center gap-1 rounded-[16px] border p-0.5",
                          desktopGlassClass
                        )}
                      >
                        <button
                          onClick={() => void setRuntimeMode("frontend")}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                            runtimeMode === "frontend"
                              ? "bg-sky-50 text-slate-950 shadow-sm"
                              : "text-slate-500 hover:text-slate-950"
                          }`}
                        >
                          {frontendModeLabel}
                        </button>
                        {CAN_USE_ADVANCED_RUNTIME && (
                          <button
                            onClick={() => void setRuntimeMode("advanced")}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                              runtimeMode === "advanced"
                                ? "bg-[#0f766e] text-white shadow-sm"
                                : "text-slate-500 hover:text-slate-950"
                            }`}
                          >
                            {advancedModeLabel}
                          </button>
                        )}
                      </div>

                      <div
                        className={cn(
                          "rounded-[16px] border p-0.5",
                          desktopGlassClass
                        )}
                      >
                        <span className="block rounded-full bg-[#0f766e] px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                          {officeNavLabel}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={toggleLocale}
                        className={cn(
                          "rounded-[16px] border px-3 py-[7px] text-[11px] font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-950",
                          desktopGlassClass
                        )}
                        title={copy.app.localeSwitch}
                      >
                        {localeLabel}
                      </button>
                    </div>
                  </div>

                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLocation("/tasks")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-white hover:text-slate-950",
                        utilityChipClass
                      )}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      {fullWorkbenchLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => openWorkflowPanel()}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-white hover:text-slate-950",
                        utilityChipClass
                      )}
                    >
                      <Waves className="h-3.5 w-3.5" />
                      {workflowLabel}
                    </button>
                    <button
                      type="button"
                      onClick={handleStartDemo}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-white hover:text-slate-950",
                        utilityChipClass
                      )}
                    >
                      {demoLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleConfig()}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-white hover:text-slate-950",
                        utilityChipClass
                      )}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      {configLabel}
                    </button>
                    {IS_GITHUB_PAGES && <GitHubRepoBadge />}
                    <div
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold text-slate-700",
                        utilityChipClass
                      )}
                    >
                      {runtimeChipLabel}
                    </div>
                  </div>
                </div>
              </div>

              {isProjectHub ? (
                <div
                  className="pointer-events-none fixed inset-y-[clamp(86px,10vh,118px)] left-[max(288px,calc(var(--sidebar-width,248px)+34px))] right-8 z-[58] flex items-start justify-center"
                  data-testid="home-project-hub"
                >
                  <div className="pointer-events-auto flex max-h-full w-full max-w-[1180px] flex-col rounded-[28px] border border-white/72 bg-white/72 p-5 text-left shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#0f766e]/15 bg-[#0f766e]/8 px-3 py-1 text-[11px] font-black text-[#0f766e]">
                          <FolderKanban className="h-3.5 w-3.5" />
                          {projectSpaceLabel}
                        </div>
                        <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950 2xl:text-4xl">
                          {projectHubTitle}
                        </h1>
                        <p className="mt-2 max-w-[720px] text-sm font-semibold leading-6 text-slate-600 2xl:text-base">
                          {projectHubSubtitle}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={materialInputRef}
                          type="file"
                          multiple
                          className="sr-only"
                          aria-label={
                            isZh ? "导入项目资料" : "Import project materials"
                          }
                          onChange={handleImportMaterials}
                        />
                        <button
                          type="button"
                          onClick={() => materialInputRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/86 px-3.5 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-white hover:text-slate-950"
                        >
                          <Upload className="h-4 w-4 text-[#0f766e]" />
                          {isZh ? "导入资料建项目" : "Import materials"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-4 gap-2 text-xs font-black text-slate-600">
                      <div className="rounded-2xl border border-white/72 bg-white/70 px-3 py-2">
                        <span className="text-slate-400">
                          {isZh ? "项目" : "Projects"}
                        </span>
                        <strong className="ml-2 text-slate-950">
                          {projectCount}
                        </strong>
                      </div>
                      <div className="rounded-2xl border border-white/72 bg-white/70 px-3 py-2">
                        <span className="text-slate-400">Specs</span>
                        <strong className="ml-2 text-slate-950">
                          {projectSpecs.length}
                        </strong>
                      </div>
                      <div className="rounded-2xl border border-white/72 bg-white/70 px-3 py-2">
                        <span className="text-slate-400">Missions</span>
                        <strong className="ml-2 text-slate-950">
                          {projectMissions.length}
                        </strong>
                      </div>
                      <div className="rounded-2xl border border-white/72 bg-white/70 px-3 py-2">
                        <span className="text-slate-400">Evidence</span>
                        <strong className="ml-2 text-slate-950">
                          {projectEvidence.length}
                        </strong>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <label className="relative min-w-[260px] flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="search"
                          value={projectSearchQuery}
                          onChange={event =>
                            setProjectSearchQuery(event.currentTarget.value)
                          }
                          placeholder={projectSearchPlaceholder}
                          disabled={visibleProjects.length === 0}
                          className="h-10 w-full rounded-2xl border border-white/80 bg-white/82 pl-9 pr-10 text-sm font-semibold text-slate-800 outline-none shadow-sm transition placeholder:text-slate-400 focus:border-[#0f766e]/35 focus:ring-2 focus:ring-[#0f766e]/12 disabled:cursor-not-allowed disabled:opacity-60"
                          data-testid="home-project-search"
                        />
                        {projectSearchQuery ? (
                          <button
                            type="button"
                            onClick={() => setProjectSearchQuery("")}
                            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label={isZh ? "清空搜索" : "Clear search"}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </label>
                      <div className="rounded-full border border-white/76 bg-white/72 px-3 py-2 text-[11px] font-black text-slate-500 shadow-sm">
                        {isZh ? "匹配" : "Showing"}{" "}
                        <span className="text-slate-950">
                          {filteredProjects.length}
                        </span>{" "}
                        / {projectCount}
                      </div>
                    </div>

                    <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
                      {visibleProjects.length > 0 ? (
                        filteredProjects.length > 0 ? (
                          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
                            {filteredProjects.map(project => {
                              const stats = getProjectStats(project);
                              const isActive = project.id === currentProjectId;
                              const isEditing =
                                editingProject?.id === project.id;
                              const isConfirmingDelete =
                                confirmDeleteProjectId === project.id;
                              const editLabel = isZh ? "编辑" : "Edit";
                              const deleteLabel = isConfirmingDelete
                                ? isZh
                                  ? "确认删除"
                                  : "Confirm"
                                : isZh
                                  ? "删除"
                                  : "Delete";
                              return (
                                <article
                                  key={project.id}
                                  className={cn(
                                    "group flex min-h-[238px] flex-col rounded-[22px] border bg-white/82 p-4 text-left shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_22px_46px_rgba(15,23,42,0.12)]",
                                    isActive
                                      ? "border-[#0f766e]/45 ring-2 ring-[#0f766e]/12"
                                      : "border-white/76"
                                  )}
                                  data-testid="home-project-card"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0f766e]/10 text-[#0f766e]">
                                      <FolderKanban className="h-5 w-5" />
                                    </div>
                                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
                                      <span
                                        className={cn(
                                          "rounded-full px-2.5 py-1 text-[10px] font-black",
                                          project.status === "clarifying"
                                            ? "bg-amber-100 text-amber-700"
                                            : project.status === "executing"
                                              ? "bg-blue-100 text-blue-700"
                                              : "bg-[#0f766e]/10 text-[#0f766e]"
                                        )}
                                      >
                                        {project.status.replace(/_/g, " ")}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleStartEditProject(project)
                                        }
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 bg-white/86 text-slate-500 shadow-sm transition hover:border-[#0f766e]/25 hover:text-[#0f766e]"
                                        aria-label={`${editLabel} ${project.name}`}
                                        data-testid="home-project-edit"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteProject(project)
                                        }
                                        className={cn(
                                          "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[10px] font-black shadow-sm transition",
                                          isConfirmingDelete
                                            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                            : "border-slate-200/80 bg-white/86 text-slate-500 hover:border-rose-200 hover:text-rose-700"
                                        )}
                                        aria-label={`${deleteLabel} ${project.name}`}
                                        data-testid="home-project-delete"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span>{deleteLabel}</span>
                                      </button>
                                    </div>
                                  </div>
                                  {isEditing && editingProject ? (
                                    <div className="mt-4 flex flex-1 flex-col gap-2">
                                      <input
                                        value={editingProject.name}
                                        onChange={event =>
                                          setEditingProject(current =>
                                            current?.id === project.id
                                              ? {
                                                  ...current,
                                                  name: event.currentTarget
                                                    .value,
                                                }
                                              : current
                                          )
                                        }
                                        className="h-10 rounded-2xl border border-slate-200/80 bg-white px-3 text-sm font-black text-slate-950 outline-none transition focus:border-[#0f766e]/35 focus:ring-2 focus:ring-[#0f766e]/12"
                                        aria-label={
                                          isZh ? "项目名称" : "Project name"
                                        }
                                        data-testid="home-project-edit-name"
                                      />
                                      <textarea
                                        value={editingProject.summary}
                                        onChange={event =>
                                          setEditingProject(current =>
                                            current?.id === project.id
                                              ? {
                                                  ...current,
                                                  summary:
                                                    event.currentTarget.value,
                                                }
                                              : current
                                          )
                                        }
                                        rows={3}
                                        className="min-h-20 resize-none rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-semibold leading-5 text-slate-700 outline-none transition focus:border-[#0f766e]/35 focus:ring-2 focus:ring-[#0f766e]/12"
                                        aria-label={
                                          isZh ? "项目描述" : "Project summary"
                                        }
                                        data-testid="home-project-edit-summary"
                                      />
                                      <div className="mt-auto flex items-center justify-end gap-2 pt-2">
                                        <button
                                          type="button"
                                          onClick={handleCancelEditProject}
                                          className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-black text-slate-600 transition hover:bg-white hover:text-slate-950"
                                        >
                                          {isZh ? "取消" : "Cancel"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={handleSaveProjectEdit}
                                          disabled={
                                            editingProject.name.trim()
                                              .length === 0
                                          }
                                          className="inline-flex items-center gap-1 rounded-full bg-[#0f766e] px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:bg-slate-300"
                                          data-testid="home-project-save"
                                        >
                                          {isZh ? "保存" : "Save"}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <h2 className="mt-4 line-clamp-1 text-xl font-black text-slate-950">
                                        {project.name}
                                      </h2>
                                      <p className="mt-2 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-600">
                                        {project.summary || project.goal}
                                      </p>
                                      <div className="mt-4 grid grid-cols-4 gap-1.5 text-center text-[10px] font-black text-slate-500">
                                        <span className="rounded-xl bg-slate-50 px-2 py-2">
                                          <FileText className="mx-auto mb-1 h-3.5 w-3.5 text-slate-400" />
                                          {stats.specs}
                                        </span>
                                        <span className="rounded-xl bg-slate-50 px-2 py-2">
                                          <Sparkles className="mx-auto mb-1 h-3.5 w-3.5 text-slate-400" />
                                          {stats.routes}
                                        </span>
                                        <span className="rounded-xl bg-slate-50 px-2 py-2">
                                          <Clock3 className="mx-auto mb-1 h-3.5 w-3.5 text-slate-400" />
                                          {stats.openQuestions}
                                        </span>
                                        <span className="rounded-xl bg-slate-50 px-2 py-2">
                                          <CheckCircle2 className="mx-auto mb-1 h-3.5 w-3.5 text-slate-400" />
                                          {stats.evidence}
                                        </span>
                                      </div>
                                      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                                        <span className="min-w-0 truncate text-[11px] font-bold text-slate-400">
                                          {isZh ? "更新于" : "Updated"}{" "}
                                          {new Date(
                                            project.updatedAt
                                          ).toLocaleDateString()}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            selectProject(project.id);
                                            setLocation(
                                              `/projects/${project.id}`
                                            );
                                          }}
                                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0f766e] px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-[#115e59]"
                                        >
                                          {openAutopilotLabel}
                                          <ArrowRight className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </article>
                              );
                            })}
                          </div>
                        ) : (
                          <div
                            className="rounded-[22px] border border-dashed border-slate-200 bg-white/68 px-5 py-8 text-center"
                            data-testid="home-project-search-empty"
                          >
                            <Search className="mx-auto h-10 w-10 text-[#0f766e]" />
                            <h2 className="mt-3 text-xl font-black text-slate-950">
                              {isZh ? "没有匹配项目" : "No matching projects"}
                            </h2>
                            <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-slate-600">
                              {isZh
                                ? "换一个关键词，或清空搜索后查看全部项目。"
                                : "Try another keyword, or clear the search to show every project."}
                            </p>
                            <button
                              type="button"
                              onClick={() => setProjectSearchQuery("")}
                              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#0f766e] px-3.5 py-2 text-xs font-black text-white transition hover:bg-[#115e59]"
                            >
                              <X className="h-3.5 w-3.5" />
                              {isZh ? "清空搜索" : "Clear search"}
                            </button>
                          </div>
                        )
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/68 px-5 py-8 text-center">
                          <FolderKanban className="mx-auto h-10 w-10 text-[#0f766e]" />
                          <h2 className="mt-3 text-xl font-black text-slate-950">
                            {isZh ? "还没有项目" : "No projects yet"}
                          </h2>
                          <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-slate-600">
                            {isZh
                              ? "先创建一个项目，后续澄清、spec、路线和执行都会绑定在这个项目里。"
                              : "Create a project first; every clarification, spec, route, and mission will attach to it."}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 border-t border-white/72 pt-4">
                      <p className="mb-2 text-[11px] font-black uppercase tracking-normal text-slate-500">
                        {isZh ? "快速创建" : "Quick create"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {projectTemplates.map(template => (
                          <button
                            key={template.name}
                            type="button"
                            onClick={() =>
                              handleCreateProjectFromTemplate(template)
                            }
                            className="inline-flex max-w-[220px] items-center gap-2 rounded-full border border-white/80 bg-white/78 px-3.5 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-white hover:text-slate-950"
                          >
                            <Plus className="h-3.5 w-3.5 shrink-0 text-[#0f766e]" />
                            <span className="truncate">{template.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div
                className={cn(
                  "pointer-events-none fixed left-1/2 top-[clamp(68px,8vh,96px)] z-[58] w-[min(760px,calc(100vw-560px))] -translate-x-1/2 text-center",
                  isProjectHub && "hidden"
                )}
                data-testid="home-desktop-scene-title"
              >
                <button
                  type="button"
                  onClick={() => setLocation("/projects")}
                  className="pointer-events-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/72 bg-white/72 px-3 py-1.5 text-[11px] font-black text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur transition hover:bg-white hover:text-slate-950"
                  data-testid="home-back-to-project-space"
                >
                  <ArrowLeft className="h-3.5 w-3.5 text-[#0f766e]" />
                  {backToProjectSpaceLabel}
                </button>
                <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-white/70 bg-white/72 px-3 py-1 text-[11px] font-bold text-slate-600 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur">
                  <FolderKanban className="h-3.5 w-3.5 text-[#0f766e]" />
                  <span className="truncate">{autopilotLabel}</span>
                  <span className="rounded-full bg-[#0f766e] px-2 py-0.5 text-white">
                    {projectStatusLabel}
                  </span>
                </div>
                <h1 className="truncate text-3xl font-black leading-none text-slate-950 drop-shadow-[0_10px_28px_rgba(255,255,255,0.72)] 2xl:text-4xl">
                  {projectHeroTitle}
                </h1>
                <p className="mx-auto mt-2 max-w-[680px] text-sm font-semibold leading-6 text-slate-600 2xl:text-base">
                  {projectHeroSubtitle}
                </p>
                <div className="mt-3 flex justify-center gap-1.5 text-[11px] font-bold text-slate-600">
                  {[
                    `${projectCount} project${projectCount === 1 ? "" : "s"}`,
                    `Specs ${projectBundleStats.specs}`,
                    `Routes ${projectBundleStats.routes}`,
                    `Missions ${projectBundleStats.missions}`,
                    `Evidence ${projectBundleStats.evidence}`,
                  ].map(label => (
                    <span
                      key={label}
                      className="rounded-full border border-white/72 bg-white/64 px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur"
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <div
                  className="pointer-events-auto mx-auto mt-3 max-w-[640px] rounded-[20px] border border-white/72 bg-white/62 px-3 py-2 text-left shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur"
                  data-testid="home-project-stage-panel"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-normal text-[#0f766e]">
                        {projectStageInsight.nextAction}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-black text-slate-900">
                        {projectStageInsight.title}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {projectStageSteps.map((step, index) => (
                        <span
                          key={step}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-black",
                            index <= projectStageInsight.activeStep
                              ? "bg-[#0f766e] text-white"
                              : "bg-white/74 text-slate-500"
                          )}
                        >
                          {step}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-5 text-slate-600">
                    {projectStageInsight.description}
                  </p>
                  {currentProject ? (
                    <>
                      <div
                        className="mt-2 rounded-[14px] border border-white/70 bg-white/68 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                        data-testid="home-clarification-progress"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-normal text-slate-500">
                              Clarification
                            </p>
                            <p className="mt-0.5 truncate text-[12px] font-black text-slate-900">
                              {projectClarificationProgress.open} open ·{" "}
                              {projectClarificationResolved} resolved
                            </p>
                          </div>
                          <span className="rounded-full bg-[#0f766e]/12 px-2 py-1 text-[10px] font-black text-[#0f766e]">
                            {projectClarificationProgress.requiredOpen} required
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-[11px] font-semibold leading-4 text-slate-600">
                          {projectClarificationProgress.openSummary}
                        </p>
                        <p className="mt-1 text-[10px] font-bold text-slate-500">
                          {projectClarificationProgress.answered} answered /{" "}
                          {projectClarificationProgress.skipped} skipped /{" "}
                          {projectClarificationProgress.skippableOpen} skippable
                        </p>
                      </div>
                      <div
                        className="mt-2 rounded-[14px] border border-white/70 bg-white/68 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                        data-testid="home-current-spec-summary"
                      >
                        {currentProjectSpec ? (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-normal text-slate-500">
                                  Current spec
                                </p>
                                <p className="mt-0.5 truncate text-[12px] font-black text-slate-900">
                                  v{currentProjectSpec.version} ·{" "}
                                  {currentProjectSpec.title}
                                </p>
                              </div>
                              <span
                                className="rounded-full bg-[#0f766e]/12 px-2 py-1 text-[10px] font-black text-[#0f766e]"
                                data-testid="home-current-spec-completeness"
                              >
                                {currentSpecCompletenessLabel}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-slate-600">
                              {currentSpecSummary}
                            </p>
                            <p className="mt-1 text-[10px] font-bold text-slate-500">
                              {currentSpecSourceLabel}
                            </p>
                            <button
                              type="button"
                              className="mt-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                              data-testid="home-open-spec-center"
                              onClick={() => setLocation("/specs")}
                            >
                              Spec Center
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-normal text-slate-500">
                                Current spec
                              </p>
                              <p className="mt-0.5 text-[12px] font-black text-slate-900">
                                No spec draft yet
                              </p>
                            </div>
                            <span className="rounded-full bg-white/78 px-2 py-1 text-[10px] font-black text-slate-500">
                              Spec pending
                            </span>
                          </div>
                        )}
                      </div>
                      <div
                        className="mt-2 rounded-[14px] border border-white/70 bg-white/68 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                        data-testid="home-route-cards"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-normal text-slate-500">
                              Routes
                            </p>
                            <p className="mt-0.5 truncate text-[12px] font-black text-slate-900">
                              {currentProjectRouteCards.length > 0
                                ? "Current route options"
                                : "No route plan yet"}
                            </p>
                          </div>
                          <span className="rounded-full bg-[#0f766e]/12 px-2 py-1 text-[10px] font-black text-[#0f766e]">
                            {currentProjectRouteCards.length} shown
                          </span>
                        </div>
                        {currentProjectRouteCards.length > 0 ? (
                          <div className="mt-2 grid gap-1.5">
                            {currentProjectRouteCards.map(route => {
                              const isCurrent =
                                route.id === currentProject.currentRouteId ||
                                Boolean(route.selectedAt);
                              return (
                                <div
                                  key={route.id}
                                  className={cn(
                                    "rounded-[12px] border px-2.5 py-2",
                                    isCurrent
                                      ? "border-[#0f766e]/30 bg-[#0f766e]/8"
                                      : "border-white/64 bg-white/56"
                                  )}
                                  data-testid="home-route-card"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-black uppercase tracking-normal text-[#0f766e]">
                                        {formatProjectRouteKind(route.kind)}
                                        {isCurrent ? " / Current" : ""}
                                      </p>
                                      <p className="mt-0.5 truncate text-[12px] font-black text-slate-900">
                                        {route.title}
                                      </p>
                                    </div>
                                    <span className="rounded-full bg-white/78 px-2 py-0.5 text-[10px] font-black text-slate-600">
                                      {route.riskLevel} risk
                                    </span>
                                  </div>
                                  <p className="mt-1 line-clamp-1 text-[11px] font-semibold leading-4 text-slate-600">
                                    {route.summary}
                                  </p>
                                  <p className="mt-1 line-clamp-1 text-[10px] font-bold text-slate-500">
                                    {summarizeProjectRouteSteps(route)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-1 line-clamp-1 text-[11px] font-semibold leading-4 text-slate-600">
                            Review the current spec before choosing main,
                            conservative, or fallback execution.
                          </p>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
                {!currentProject ? (
                  <div className="pointer-events-auto mt-3 flex flex-wrap justify-center gap-2">
                    {recentProjects.length > 0 ? (
                      <div
                        className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/72 bg-white/60 px-2 py-1 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur"
                        data-testid="home-project-resume-strip"
                      >
                        <span className="px-1.5 text-[11px] font-bold text-slate-500">
                          {isZh ? "继续项目" : "Resume"}
                        </span>
                        {recentProjects.map(project => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => {
                              selectProject(project.id);
                              setLocation(`/projects/${project.id}`);
                            }}
                            className="max-w-[150px] truncate rounded-full bg-white/78 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition-colors hover:bg-white hover:text-slate-950"
                          >
                            {project.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {projectTemplates.map(template => (
                      <button
                        key={template.name}
                        type="button"
                        onClick={() =>
                          handleCreateProjectFromTemplate(template)
                        }
                        className="inline-flex max-w-[180px] items-center gap-1.5 rounded-full border border-white/72 bg-white/72 px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur transition-colors hover:bg-white hover:text-slate-950"
                      >
                        <Plus className="h-3 w-3 flex-shrink-0 text-[#0f766e]" />
                        <span className="truncate">{template.name}</span>
                      </button>
                    ))}
                    <input
                      ref={materialInputRef}
                      type="file"
                      multiple
                      className="sr-only"
                      aria-label={
                        isZh ? "导入项目资料" : "Import project materials"
                      }
                      onChange={handleImportMaterials}
                    />
                    <button
                      type="button"
                      onClick={() => materialInputRef.current?.click()}
                      className="inline-flex max-w-[180px] items-center gap-1.5 rounded-full border border-white/72 bg-white/72 px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur transition-colors hover:bg-white hover:text-slate-950"
                    >
                      <Upload className="h-3 w-3 flex-shrink-0 text-[#0f766e]" />
                      <span className="truncate">
                        {isZh ? "导入资料" : "Import materials"}
                      </span>
                    </button>
                  </div>
                ) : recentProjects.length > 1 ? (
                  <div
                    className="pointer-events-auto mt-3 inline-flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/72 bg-white/60 px-2 py-1 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur"
                    data-testid="home-project-switcher"
                  >
                    <span className="px-1.5 text-[11px] font-bold text-slate-500">
                      {isZh ? "切换项目" : "Switch project"}
                    </span>
                    {recentProjects.map(project => (
                      <button
                        key={project.id}
                        type="button"
                        aria-pressed={project.id === currentProject.id}
                        onClick={() => {
                          selectProject(project.id);
                          setLocation(`/projects/${project.id}`);
                        }}
                        className={cn(
                          "max-w-[150px] truncate rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors",
                          project.id === currentProject.id
                            ? "bg-[#0f766e] text-white shadow-sm"
                            : "bg-white/78 text-slate-700 hover:bg-white hover:text-slate-950"
                        )}
                      >
                        {project.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {!isProjectHub ? (
                <OfficeTaskCockpit
                  resizeActive={resizeActive}
                  className="home-first-screen-cockpit"
                />
              ) : null}

              <ChatPanel />
              <WorkflowPanel />
              <TelemetryDashboard />
            </div>
          ) : null}
        </UEOverlayChrome>
      )}

      <div className="pointer-events-none absolute inset-0 z-[5]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(228,241,252,0.72),rgba(228,241,252,0)_38%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,251,247,0.42),rgba(255,251,247,0)_30%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.07),rgba(59,130,246,0)_32%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(15,118,110,0.1),rgba(15,118,110,0)_24%)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#f5f9fd]/46 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#dbeafe]/32 to-transparent" />
        <div className="absolute inset-0 shadow-[inset_0_0_160px_rgba(15,23,42,0.08)]" />
      </div>

      {isSceneReady && isMobile && isProjectHub ? (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+92px)] z-[18] flex justify-center px-3">
          <div className="pointer-events-auto max-h-[calc(100svh-150px)] w-full overflow-y-auto rounded-[28px] studio-shell px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-normal text-[#0f766e]">
              <FolderKanban className="h-4 w-4" />
              {projectSpaceLabel}
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              {projectHubTitle}
            </h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {projectHubSubtitle}
            </p>
            <label className="relative mt-4 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={projectSearchQuery}
                onChange={event =>
                  setProjectSearchQuery(event.currentTarget.value)
                }
                placeholder={projectSearchPlaceholder}
                disabled={visibleProjects.length === 0}
                className="h-10 w-full rounded-2xl border border-white/80 bg-white/82 pl-9 pr-10 text-sm font-semibold text-slate-800 outline-none shadow-sm transition placeholder:text-slate-400 focus:border-[#0f766e]/35 focus:ring-2 focus:ring-[#0f766e]/12 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="home-mobile-project-search"
              />
              {projectSearchQuery ? (
                <button
                  type="button"
                  onClick={() => setProjectSearchQuery("")}
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label={isZh ? "清空搜索" : "Clear search"}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </label>
            <div className="mt-4 grid gap-3">
              {filteredProjects.map(project => {
                const stats = getProjectStats(project);
                const isEditing = editingProject?.id === project.id;
                const isConfirmingDelete =
                  confirmDeleteProjectId === project.id;
                return (
                  <article
                    key={project.id}
                    className="rounded-[22px] border border-white/74 bg-white/76 px-4 py-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
                    data-testid="home-mobile-project-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-slate-950">
                          {project.name}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">
                          {project.summary || project.goal}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#0f766e]/10 px-2 py-1 text-[10px] font-black text-[#0f766e]">
                        {project.status}
                      </span>
                    </div>
                    {isEditing && editingProject ? (
                      <div className="mt-3 grid gap-2">
                        <input
                          value={editingProject.name}
                          onChange={event =>
                            setEditingProject(current =>
                              current?.id === project.id
                                ? {
                                    ...current,
                                    name: event.currentTarget.value,
                                  }
                                : current
                            )
                          }
                          className="h-10 rounded-2xl border border-slate-200/80 bg-white px-3 text-sm font-black text-slate-950 outline-none transition focus:border-[#0f766e]/35 focus:ring-2 focus:ring-[#0f766e]/12"
                          aria-label={isZh ? "项目名称" : "Project name"}
                          data-testid="home-mobile-project-edit-name"
                        />
                        <textarea
                          value={editingProject.summary}
                          onChange={event =>
                            setEditingProject(current =>
                              current?.id === project.id
                                ? {
                                    ...current,
                                    summary: event.currentTarget.value,
                                  }
                                : current
                            )
                          }
                          rows={3}
                          className="min-h-20 resize-none rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-semibold leading-5 text-slate-700 outline-none transition focus:border-[#0f766e]/35 focus:ring-2 focus:ring-[#0f766e]/12"
                          aria-label={isZh ? "项目描述" : "Project summary"}
                          data-testid="home-mobile-project-edit-summary"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={handleCancelEditProject}
                            className="rounded-full border border-slate-200/80 bg-white/82 px-3 py-1.5 text-[11px] font-black text-slate-600"
                          >
                            {isZh ? "取消" : "Cancel"}
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveProjectEdit}
                            disabled={editingProject.name.trim().length === 0}
                            className="rounded-full bg-[#0f766e] px-3 py-1.5 text-[11px] font-black text-white disabled:bg-slate-300"
                            data-testid="home-mobile-project-save"
                          >
                            {isZh ? "保存" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[10px] font-black text-slate-500">
                          <span className="rounded-xl bg-white/72 px-2 py-2">
                            Spec {stats.specs}
                          </span>
                          <span className="rounded-xl bg-white/72 px-2 py-2">
                            Route {stats.routes}
                          </span>
                          <span className="rounded-xl bg-white/72 px-2 py-2">
                            Q {stats.openQuestions}
                          </span>
                          <span className="rounded-xl bg-white/72 px-2 py-2">
                            Ev {stats.evidence}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditProject(project)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/86 px-2.5 py-1.5 text-[11px] font-black text-slate-600"
                              data-testid="home-mobile-project-edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {isZh ? "编辑" : "Edit"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProject(project)}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-black",
                                isConfirmingDelete
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : "border-slate-200/80 bg-white/86 text-slate-600"
                              )}
                              data-testid="home-mobile-project-delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {isConfirmingDelete
                                ? isZh
                                  ? "确认删除"
                                  : "Confirm"
                                : isZh
                                  ? "删除"
                                  : "Delete"}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              selectProject(project.id);
                              setLocation(`/projects/${project.id}`);
                            }}
                            className="inline-flex items-center gap-1 rounded-full bg-[#0f766e] px-3 py-1.5 text-[11px] font-black text-white"
                          >
                            {openAutopilotLabel}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
              {visibleProjects.length > 0 && filteredProjects.length === 0 ? (
                <div
                  className="rounded-[22px] border border-dashed border-slate-200 bg-white/70 px-4 py-7 text-center"
                  data-testid="home-mobile-project-search-empty"
                >
                  <p className="text-lg font-black text-slate-950">
                    {isZh ? "没有匹配项目" : "No matching projects"}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                    {isZh
                      ? "换一个关键词，或清空搜索后查看全部项目。"
                      : "Try another keyword, or clear the search to show every project."}
                  </p>
                </div>
              ) : null}
              {visibleProjects.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/70 px-4 py-7 text-center">
                  <p className="text-lg font-black text-slate-950">
                    {isZh ? "还没有项目" : "No projects yet"}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                    {isZh
                      ? "创建一个项目后，后续操作都会绑定在它里面。"
                      : "Create one project first; later work will stay scoped to it."}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {projectTemplates.map(template => (
                <button
                  key={template.name}
                  type="button"
                  onClick={() => handleCreateProjectFromTemplate(template)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/72 bg-white/82 px-3 py-2 text-xs font-black text-slate-700"
                >
                  <Plus className="h-3.5 w-3.5 text-[#0f766e]" />
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {isSceneReady && isMobile && !isProjectHub ? (
        <div className="pointer-events-none absolute inset-x-0 z-[18] flex justify-center px-3 top-[calc(env(safe-area-inset-top)+108px)]">
          <div className="pointer-events-auto w-full max-w-none rounded-[28px] studio-shell px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                {autopilotLabel}
              </p>
              <button
                type="button"
                onClick={() => setLocation("/projects")}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/85 px-3 py-1.5 text-xs font-black text-slate-700 transition-colors hover:bg-white hover:text-slate-950"
                data-testid="home-mobile-back-to-project-space"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-[#0f766e]" />
                {backToProjectSpaceLabel}
              </button>
            </div>
            <div className="mt-3 space-y-3">
              <div className="min-w-0">
                <h1
                  className="text-xl font-semibold tracking-tight text-slate-950"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {projectHeroTitle}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {projectHeroSubtitle}
                </p>
              </div>

              <div
                className="rounded-[22px] border border-white/70 bg-white/64 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]"
                data-testid="home-mobile-project-next-step"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-normal text-[#0f766e]">
                      {projectStageInsight.nextAction}
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      {projectStageInsight.title}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                      {projectStageInsight.description}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#0f766e] px-2 py-1 text-[10px] font-black text-white">
                    {projectStatusLabel}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {projectStageSteps.map((step, index) => (
                    <span
                      key={step}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-black",
                        index <= projectStageInsight.activeStep
                          ? "bg-[#0f766e]/12 text-[#0f766e]"
                          : "bg-white/72 text-slate-500"
                      )}
                    >
                      {step}
                    </span>
                  ))}
                </div>
              </div>

              <UnifiedLaunchComposer
                createMission={createMission}
                projectId={currentProject?.id ?? null}
                projectName={currentProject?.name ?? null}
                compact
                bare
                dense
                hideHeader
                hideInputLabel
                className="home-mobile-project-composer"
              />

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setLocation("/tasks")}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#115e59]"
                >
                  {fullWorkbenchLabel}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleWorkflowPanel()}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-white/85 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-white hover:text-slate-950"
                >
                  {copy.home.openWorkflow}
                </button>
                <button
                  type="button"
                  onClick={() => toggleConfig()}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-white/85 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-white hover:text-slate-950"
                >
                  {copy.home.openConfig}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-600">
                {copy.home.runtimeChip(
                  copy.toolbar.runtimeLabels[
                    runtimeMode === "advanced" ? "advanced" : "frontend"
                  ]
                )}
              </span>
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-600">
                {copy.home.agentChip(agentCount)}
              </span>
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-600">
                {copy.home.workflowChip(activeWorkflows)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {!isSceneReady && <LoadingScreen />}

      {isSceneReady && isMobile && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+270px)] z-[18] px-3">
            <div className="pointer-events-auto">
              {noticeBoardSnapshot ? (
                <OfficeNoticeBoard
                  locale={locale}
                  snapshot={noticeBoardSnapshot}
                  onOpenTasks={() => setLocation("/tasks")}
                  onOpenWorkflow={() => openWorkflowPanel()}
                  onOpenCurrentTask={handleOpenCurrentMission}
                />
              ) : null}
            </div>
          </div>
          <ChatPanel />
          <WorkflowPanel />
          <TelemetryDashboard />
        </>
      )}

      <AgentDetailDrawer
        agentId={selectedPet}
        open={isMobile && Boolean(selectedPet)}
        onOpenChange={nextOpen => {
          if (!nextOpen) {
            setSelectedPet(null);
          }
        }}
      />
    </div>
  );
}
