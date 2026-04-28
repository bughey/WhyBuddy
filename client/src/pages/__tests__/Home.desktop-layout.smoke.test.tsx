import { createRef, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => (
    <span aria-hidden="true" className={className} />
  );

  return {
    ArrowRight: Icon,
    Settings2: Icon,
    Waves: Icon,
  };
});

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

const appState = {
  isSceneReady: true,
  runtimeMode: "frontend",
  locale: "en-US",
  selectedPet: null,
  hydrateAIConfig: vi.fn(async () => {}),
  setRuntimeMode: vi.fn(async () => {}),
  toggleLocale: vi.fn(),
  toggleConfig: vi.fn(),
  setSelectedPet: vi.fn(),
};

const taskState = {
  tasks: [],
  detailsById: {},
  selectedTaskId: null,
  ensureReady: vi.fn(async () => {}),
  selectTask: vi.fn(),
};

const workflowState = {
  agents: [],
  workflows: [],
  heartbeatStatuses: {},
  disconnectSocket: vi.fn(),
  toggleWorkflowPanel: vi.fn(),
  openWorkflowPanel: vi.fn(),
};

const telemetryState = {
  snapshot: null,
  fetchInitial: vi.fn(async () => {}),
};

function selectFrom<T extends Record<string, unknown>, R>(
  state: T,
  selector: (state: T) => R,
) {
  return selector(state);
}

vi.mock("@/lib/store", () => ({
  useAppStore: (selector: (state: typeof appState) => unknown) =>
    selectFrom(appState, selector),
}));

vi.mock("@/lib/tasks-store", () => ({
  useTasksStore: (selector: (state: typeof taskState) => unknown) =>
    selectFrom(taskState, selector),
}));

vi.mock("@/lib/workflow-store", () => ({
  useWorkflowStore: (selector: (state: typeof workflowState) => unknown) =>
    selectFrom(workflowState, selector),
}));

vi.mock("@/lib/telemetry-store", () => ({
  useTelemetryStore: (selector: (state: typeof telemetryState) => unknown) =>
    selectFrom(telemetryState, selector),
}));

vi.mock("@/hooks/useDemoMode", () => ({
  useDemoMode: () => ({ startDemo: vi.fn(async () => {}) }),
}));

vi.mock("@/hooks/useWorkflowRuntimeBootstrap", () => ({
  useWorkflowRuntimeBootstrap: vi.fn(),
}));

vi.mock("@/hooks/useViewportTier", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useViewportTier")>(
    "@/hooks/useViewportTier",
  );

  return {
    ...actual,
    useViewportTier: () => ({
      width: currentViewportWidth,
      tier: actual.getViewportTier(currentViewportWidth),
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isCompact: false,
    }),
    useViewportWidth: () => currentViewportWidth,
    useViewportResizeState: () => false,
  };
});

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    copy: {
      app: { localeSwitch: "Switch language" },
      common: {
        chineseShort: "ZH",
        englishShort: "EN",
      },
      home: {
        desktopOfficeLabel: "Cube Pets Office / Office",
        officeTitle: "Office is now the default desktop execution shell.",
        enterTasks: "Task Workbench",
        openWorkflow: "Open Workflow",
        liveDemo: "Load Demo",
        openConfig: "Runtime Config",
        runtimeChip: (label: string) => `Current mode: ${label}`,
      },
      toolbar: {
        primaryNav: {
          office: { label: "Office" },
          more: { label: "More" },
        },
        runtimeLabels: {
          frontend: "Frontend Mode",
          advanced: "Advanced Mode",
        },
      },
    },
  }),
}));

vi.mock("@/lib/deploy-target", () => ({
  CAN_USE_ADVANCED_RUNTIME: true,
  IS_GITHUB_PAGES: false,
}));

vi.mock("@/components/AppSidebar", () => ({
  AppSidebar: ({ collapsed, embedded }: { collapsed: boolean; embedded?: boolean }) => (
    <aside
      data-testid="app-sidebar"
      data-collapsed={collapsed ? "true" : "false"}
      data-embedded={embedded ? "true" : "false"}
    />
  ),
}));

vi.mock("@/components/Scene3D", () => ({
  Scene3D: ({
    performanceProfile,
    sidebarWidth,
  }: {
    performanceProfile: string;
    sidebarWidth: number;
  }) => (
    <div
      data-testid="scene-3d"
      data-performance-profile={performanceProfile}
      data-sidebar-width={sidebarWidth}
    />
  ),
}));

vi.mock("@/components/office/OfficeTaskCockpit", () => ({
  OfficeTaskCockpit: ({ resizeActive }: { resizeActive?: boolean }) => (
    <section
      data-testid="office-task-cockpit"
      data-resize-active={resizeActive ? "true" : "false"}
    />
  ),
}));

vi.mock("@/components/ue-overlay", async () => {
  const actual = await vi.importActual<typeof import("@/components/ue-overlay")>(
    "@/components/ue-overlay",
  );

  return {
    ...actual,
    UEOverlayChrome: ({
      mediaLayer,
      sidebar,
      children,
      viewportWidth,
    }: {
      videoElement: ReturnType<typeof createRef<HTMLVideoElement>>;
      mediaLayer?: ReactNode;
      sidebar?: ReactNode;
      children: ReactNode;
      viewportWidth?: number;
    }) => (
      <div
        data-testid="ue-overlay-chrome"
        data-viewport-width={viewportWidth}
      >
        <div data-testid="ue-overlay-sidebar-slot">{sidebar}</div>
        <div data-testid="ue-overlay-media-layer">{mediaLayer}</div>
        <div data-testid="ue-overlay-panel-slot">{children}</div>
      </div>
    ),
  };
});

vi.mock("@/components/ChatPanel", () => ({ ChatPanel: () => null }));
vi.mock("@/components/WorkflowPanel", () => ({ WorkflowPanel: () => null }));
vi.mock("@/components/TelemetryDashboard", () => ({
  TelemetryDashboard: () => null,
}));
vi.mock("@/components/GitHubRepoBadge", () => ({ GitHubRepoBadge: () => null }));
vi.mock("@/components/LoadingScreen", () => ({ LoadingScreen: () => null }));
vi.mock("@/components/scene/AgentDetailDrawer", () => ({
  AgentDetailDrawer: () => null,
}));
vi.mock("@/components/scene/OfficeNoticeBoard", () => ({
  OfficeNoticeBoard: () => null,
}));
vi.mock("@/lib/scene-agent-detail", () => ({
  buildOfficeNoticeBoardSnapshot: vi.fn(() => null),
}));
vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) =>
    values.filter(Boolean).join(" "),
}));

let currentViewportWidth = 1440;

async function renderDesktopHome(width: number) {
  currentViewportWidth = width;
  const { default: Home } = await import("../Home");

  return renderToStaticMarkup(<Home />);
}

describe("Home desktop first-screen layout smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentViewportWidth = 1440;
  });

  it.each([1280, 1440, 1728])(
    "keeps sidebar, Scene3D, central cockpit, and toolbar visible at %ipx",
    async width => {
      const markup = await renderDesktopHome(width);

      expect(markup).toContain('data-testid="ue-overlay-chrome"');
      expect(markup).toContain(`data-viewport-width="${width}"`);
      expect(markup).toContain('data-testid="app-sidebar"');
      expect(markup).toContain('data-embedded="true"');
      expect(markup).toContain('data-testid="scene-3d"');
      expect(markup).toContain('data-testid="office-task-cockpit"');
      expect(markup).toContain("Task Workbench");
      expect(markup).toContain("Open Workflow");
      expect(markup).toContain("Runtime Config");
      expect(markup).not.toContain("task-detail-full-screen");
    },
  );

  it("only collapses the embedded sidebar below the desktop breakpoint", async () => {
    const markup = await renderDesktopHome(1280);

    expect(markup).toContain('data-collapsed="false"');
  });
});
