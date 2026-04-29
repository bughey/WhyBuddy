import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AppSidebar } from "../AppSidebar";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    copy: {
      sidebar: {
        autopilot: "Autopilot",
        tasks: "Tasks",
        projects: "Projects",
        knowledge: "Knowledge",
        datasource: "Data",
        dashboard: "Dashboard",
        marketplace: "Marketplace",
        notifications: "Notifications",
        settings: "Settings",
        comingSoon: "soon",
        expand: "Expand sidebar",
        collapse: "Collapse sidebar",
      },
    },
  }),
}));

vi.mock("../SidebarStatusBlock", () => ({
  SidebarStatusBlock: ({ collapsed }: { collapsed: boolean }) => (
    <div data-testid="sidebar-status" data-collapsed={collapsed} />
  ),
}));

vi.mock("../ui/tooltip", () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  TooltipTrigger: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe("AppSidebar overlay embedding", () => {
  it("uses relative full-height layout when rendered inside UE overlay chrome", () => {
    const markup = renderToStaticMarkup(
      <AppSidebar collapsed={false} onToggleCollapse={() => {}} embedded />
    );

    const aside = markup.match(/<aside[^>]*>/)?.[0] ?? "";

    expect(aside).toContain('data-sidebar-mode="embedded"');
    expect(aside).toContain("relative");
    expect(aside).toContain("h-full");
    expect(aside).not.toContain("fixed");
    expect(aside).not.toContain("left-0 top-0 bottom-0");
  });

  it("marks embedded sidebar as a transparent glass surface for the home scene", () => {
    const markup = renderToStaticMarkup(
      <AppSidebar collapsed={false} onToggleCollapse={() => {}} embedded />
    );

    const aside = markup.match(/<aside[^>]*>/)?.[0] ?? "";

    expect(aside).toContain('data-sidebar-tone="glass"');
    expect(aside).toContain('data-sidebar-mode="embedded"');
    expect(aside).toContain("background:linear-gradient");
    expect(aside).toContain("width:248px");
    expect(aside).toContain("rgba(255, 255, 255, 0.9)");
    expect(aside).toContain("rgba(236, 249, 255, 0.36)");
    expect(aside).not.toContain("rgba(22, 35, 63");
    expect(aside).not.toContain("text-white");
  });

  it("renders the embedded active item as a bright future-glass control", () => {
    const markup = renderToStaticMarkup(
      <AppSidebar collapsed={false} onToggleCollapse={() => {}} embedded />
    );

    expect(markup).toContain('data-sidebar-nav-tone="glass"');
    expect(markup).toContain('data-sidebar-nav-state="active"');

    const activeButton =
      markup.match(/<button[^>]*data-sidebar-nav-state="active"[^>]*>/)?.[0] ??
      "";

    expect(activeButton).toContain("bg-white/86");
    expect(activeButton).toContain("rounded-[18px]");
    expect(activeButton).toContain("border-sky-200/82");
    expect(activeButton).toContain("shadow-[0_18px_40px_rgba(14,165,233,0.18)");
    expect(markup).toContain('data-sidebar-nav-icon=""');
    expect(markup).toContain("bg-sky-400");
    expect(markup).not.toContain("bg-slate-900");
    expect(activeButton).not.toContain("bg-emerald-50");
  });

  it("keeps fixed sidebar light, fixed, and expanded near the reference width", () => {
    const markup = renderToStaticMarkup(
      <AppSidebar collapsed={false} onToggleCollapse={() => {}} />
    );

    const aside = markup.match(/<aside[^>]*>/)?.[0] ?? "";

    expect(aside).toContain('data-sidebar-tone="light"');
    expect(aside).toContain('data-sidebar-mode="fixed"');
    expect(aside).toContain("fixed");
    expect(aside).toContain("width:248px");
    expect(aside).toContain("background:linear-gradient");
    expect(aside).toContain("rgba(255, 255, 255, 0.98)");
    expect(aside).toContain("rgba(244, 251, 255, 0.94)");
    expect(markup).toContain("CP");
    expect(markup).toContain("Cube Pets Office");
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('aria-expanded="true"');
  });

  it("keeps collapsed sidebar usable and exposes collapsed aria state", () => {
    const markup = renderToStaticMarkup(
      <AppSidebar collapsed onToggleCollapse={() => {}} />
    );

    const aside = markup.match(/<aside[^>]*>/)?.[0] ?? "";

    expect(aside).toContain('data-sidebar-tone="light"');
    expect(aside).toContain("width:64px");
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('aria-expanded="false"');
  });
});
