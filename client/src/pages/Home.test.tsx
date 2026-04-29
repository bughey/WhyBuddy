import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { appState, tasksState, telemetryState, workflowState, locationState } =
  vi.hoisted(() => {
    const appState = {
      isSceneReady: true,
      hydrateAIConfig: async () => {},
      runtimeMode: "frontend" as "frontend" | "advanced",
      setRuntimeMode: async () => {},
      locale: "en-US",
      toggleLocale: () => {},
      toggleConfig: () => {},
      selectedPet: null as string | null,
      setSelectedPet: () => {},
    };
    const tasksState = {
      ensureReady: async () => {},
      tasks: [],
      detailsById: {},
      selectedTaskId: null as string | null,
      selectTask: () => {},
    };
    const telemetryState = {
      fetchInitial: async () => {},
      snapshot: null,
    };
    const workflowState = {
      agents: [],
      workflows: [],
      heartbeatStatuses: {},
      disconnectSocket: () => {},
      toggleWorkflowPanel: () => {},
      openWorkflowPanel: () => {},
    };
    const locationState = {
      current: "/",
      setLocation: vi.fn(),
    };

    return {
      appState,
      tasksState,
      telemetryState,
      workflowState,
      locationState,
    };
  });

import Home from "./Home";

vi.mock("wouter", () => ({
  useLocation: () => [locationState.current, locationState.setLocation],
}));

vi.mock("@/components/AppSidebar", () => ({
  AppSidebar: ({
    collapsed,
    embedded,
  }: {
    collapsed: boolean;
    embedded?: boolean;
  }) => (
    <aside
      data-testid="app-sidebar"
      data-collapsed={collapsed ? "true" : "false"}
      data-embedded={embedded ? "true" : "false"}
    />
  ),
}));

vi.mock("@/components/ChatPanel", () => ({
  ChatPanel: () => <div data-testid="chat-panel" />,
}));

vi.mock("@/components/GitHubRepoBadge", () => ({
  GitHubRepoBadge: () => <div data-testid="github-repo-badge" />,
}));

vi.mock("@/components/LoadingScreen", () => ({
  LoadingScreen: () => <div data-testid="loading-screen" />,
}));

vi.mock("@/components/office/OfficeTaskCockpit", () => ({
  OfficeTaskCockpit: ({
    className,
    resizeActive,
  }: {
    className?: string;
    resizeActive?: boolean;
  }) => (
    <div
      data-testid="office-task-cockpit"
      data-class-name={className || ""}
      data-resize-active={resizeActive ? "true" : "false"}
    />
  ),
}));

vi.mock("@/components/scene/AgentDetailDrawer", () => ({
  AgentDetailDrawer: () => <div data-testid="agent-detail-drawer" />,
}));

vi.mock("@/components/scene/OfficeNoticeBoard", () => ({
  OfficeNoticeBoard: () => <div data-testid="office-notice-board" />,
}));

vi.mock("@/components/Scene3D", () => ({
  Scene3D: ({
    sidebarWidth,
    performanceProfile,
  }: {
    sidebarWidth?: number;
    performanceProfile?: string;
  }) => (
    <div
      data-testid="scene-3d"
      data-sidebar-width={String(sidebarWidth ?? 0)}
      data-performance-profile={performanceProfile || ""}
    />
  ),
}));

vi.mock("@/components/TelemetryDashboard", () => ({
  TelemetryDashboard: () => <div data-testid="telemetry-dashboard" />,
}));

vi.mock("@/components/ue-overlay", () => ({
  UEOverlayChrome: ({
    mediaLayer,
    sidebar,
    children,
    viewportWidth,
  }: {
    mediaLayer?: React.ReactNode;
    sidebar?: React.ReactNode;
    children?: React.ReactNode;
    viewportWidth?: number;
  }) => (
    <div data-testid="ue-overlay-chrome" data-viewport-width={viewportWidth}>
      <div data-testid="ue-media-layer">{mediaLayer}</div>
      <div data-testid="ue-sidebar-slot">{sidebar}</div>
      <div data-testid="ue-panel-slot">{children}</div>
    </div>
  ),
}));

vi.mock("@/components/WorkflowPanel", () => ({
  WorkflowPanel: () => <div data-testid="workflow-panel" />,
}));

vi.mock("@/hooks/useViewportTier", () => ({
  useViewportResizeState: () => false,
  useViewportTier: () => ({
    isMobile: false,
    isTablet: false,
    tier: "desktop",
  }),
  useViewportWidth: () => 1440,
}));

vi.mock("@/hooks/useDemoMode", () => ({
  useDemoMode: () => ({
    startDemo: async () => {},
  }),
}));

vi.mock("@/hooks/useWorkflowRuntimeBootstrap", () => ({
  useWorkflowRuntimeBootstrap: () => {},
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    copy: {
      app: {
        localeSwitch: "Switch language",
      },
      common: {
        chineseShort: "ZH",
        englishShort: "EN",
      },
      home: {
        agentChip: (count: number) => `${count} agents`,
        desktopOfficeLabel: "Desktop office",
        enterTasks: "Tasks",
        liveDemo: "Demo",
        mobileHint: "Mobile hint",
        officeEyebrow: "Office",
        officeTitle: "Cube Pets Office",
        openConfig: "Config",
        openWorkflow: "Workflow",
        runtimeChip: (label: string) => `Runtime: ${label}`,
        workflowChip: (count: number) => `${count} workflows`,
      },
      toolbar: {
        primaryNav: {
          more: { label: "More" },
          office: { label: "Office" },
        },
        runtimeLabels: {
          advanced: "Advanced",
          frontend: "Frontend",
        },
      },
    },
  }),
}));

vi.mock("@/lib/deploy-target", () => ({
  CAN_USE_ADVANCED_RUNTIME: true,
  IS_GITHUB_PAGES: false,
}));

vi.mock("@/lib/scene-agent-detail", () => ({
  buildOfficeNoticeBoardSnapshot: () => null,
}));

vi.mock("@/lib/store", () => ({
  useAppStore: (selector: (state: typeof appState) => unknown) =>
    selector(appState),
}));

vi.mock("@/lib/tasks-store", () => ({
  useTasksStore: (selector: (state: typeof tasksState) => unknown) =>
    selector(tasksState),
}));

vi.mock("@/lib/telemetry-store", () => ({
  useTelemetryStore: (selector: (state: typeof telemetryState) => unknown) =>
    selector(telemetryState),
}));

vi.mock("@/lib/workflow-store", () => ({
  useWorkflowStore: (selector: (state: typeof workflowState) => unknown) =>
    selector(workflowState),
}));

describe("Home desktop shell", () => {
  beforeEach(() => {
    locationState.current = "/";
    locationState.setLocation.mockClear();
  });

  it("keeps the scene and toolbar aligned to the desktop sidebar shell", () => {
    const markup = renderToStaticMarkup(<Home />);

    expect(markup).toContain('data-testid="scene-3d"');
    expect(markup).toContain('data-sidebar-width="248"');
    expect(markup).toContain("home-desktop-sidebar-shell");

    const toolbarTag =
      markup.match(/<div[^>]*data-testid="home-desktop-toolbar"[^>]*>/)?.[0] ||
      "";

    expect(toolbarTag).toContain("absolute");
    expect(toolbarTag).not.toContain("left-0");
    expect(toolbarTag).not.toContain("right-0");
  });

  it("pins the desktop center controls to the viewport centerline", () => {
    const markup = renderToStaticMarkup(<Home />);

    const centerControlsTag =
      markup.match(
        /<div[^>]*data-testid="home-desktop-center-controls"[^>]*>/
      )?.[0] || "";

    expect(centerControlsTag).toContain("fixed");
    expect(centerControlsTag).toContain("left-1/2");
    expect(centerControlsTag).toContain("-translate-x-1/2");
    expect(centerControlsTag).not.toContain("inset-x-0");
    expect(centerControlsTag).not.toContain("justify-between");
  });

  it("styles the desktop sidebar shell as transparent glass instead of a solid rail", () => {
    const markup = renderToStaticMarkup(<Home />);

    expect(markup).toContain(
      '.home-desktop-sidebar-shell aside[data-sidebar-tone="glass"]'
    );
    expect(markup).toContain("rgba(255, 255, 255, 0.9)");
    expect(markup).toContain("rgba(236, 249, 255, 0.36)");
    expect(markup).toContain("backdrop-filter: blur(30px)");
    expect(markup).not.toContain(
      ".home-desktop-sidebar-shell aside {\n  background: rgba(248, 250, 252, 0.96)"
    );
    expect(markup).not.toContain(
      '.home-desktop-sidebar-shell aside [style*="background"]'
    );
  });

  it("keeps the right drawer reachable while retaining the autopilot cockpit", () => {
    const markup = renderToStaticMarkup(<Home />);

    expect(markup).toContain('data-testid="office-task-cockpit"');
    expect(markup).toContain("home-first-screen-cockpit");
    expect(markup).not.toContain("[&amp;_.office-cockpit-splitter]:opacity-0");
    expect(markup).not.toContain(
      "[&amp;_.office-cockpit-splitter]:pointer-events-none"
    );
    expect(markup).not.toContain(
      ".home-first-screen-cockpit .office-cockpit-splitter {\n  opacity: 0"
    );
  });
});
