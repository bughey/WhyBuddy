import { ChevronsLeft } from "lucide-react";
import { useLocation } from "wouter";

import {
  getActiveSidebarId,
  SIDEBAR_NAV_ITEMS,
  type SidebarNavigationItem,
} from "@/components/navigation-config";
import { SidebarStatusBlock } from "@/components/SidebarStatusBlock";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

type SidebarTone = "light" | "glass";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SidebarHeader({
  collapsed,
  tone,
}: {
  collapsed: boolean;
  tone: SidebarTone;
}) {
  const glass = tone === "glass";

  return (
    <div
      className={cn(
        "flex h-16 shrink-0 items-center gap-2 border-b px-4",
        collapsed && "justify-center px-2",
      )}
      style={{
        borderColor: glass
          ? "rgba(15, 23, 42, 0.08)"
          : "rgba(203, 213, 225, 0.72)",
      }}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-[10px] border text-xs font-bold shadow-sm",
          glass
            ? "border-slate-900/15 bg-slate-900 text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)]"
            : "border-emerald-200 bg-emerald-50 text-emerald-700",
        )}
      >
        {glass ? "CP" : "C"}
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span
            className={cn(
              "block truncate font-semibold",
              glass
                ? "text-[12px] uppercase tracking-[0.08em] text-slate-800"
                : "text-sm text-slate-950",
            )}
          >
            {glass ? "Cube Pets Office" : "Cube Pets"}
          </span>
          {glass && (
            <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-600">
              办公室已成为桌面运转的伙伴
            </span>
          )}
        </span>
      )}
    </div>
  );
}

function SidebarNavItem({
  item,
  active,
  collapsed,
  label,
  comingSoonLabel,
  onNavigate,
  tone,
}: {
  item: SidebarNavigationItem;
  active: boolean;
  collapsed: boolean;
  label: string;
  comingSoonLabel: string;
  onNavigate: (href: string) => void;
  tone: SidebarTone;
}) {
  const isDisabled = item.disabled || !item.href;
  const Icon = item.icon;
  const glass = tone === "glass";

  const content = (
    <button
      type="button"
      onClick={() => {
        if (!isDisabled && item.href) {
          onNavigate(item.href);
        }
      }}
      disabled={isDisabled}
      aria-current={active ? "page" : undefined}
      data-sidebar-nav-state={active ? "active" : "idle"}
      data-sidebar-nav-tone={tone}
      className={cn(
        "relative flex min-h-10 w-full items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
        collapsed && "size-10 justify-center px-0",
        glass &&
          "min-h-11 rounded-[14px] px-3 text-slate-600 hover:bg-white/42 hover:text-slate-950",
        glass &&
          collapsed &&
          "size-11 justify-center rounded-[14px] px-0",
        active &&
          (glass
            ? "border-slate-900/10 bg-slate-900 text-white shadow-[0_14px_28px_rgba(15,23,42,0.22)] hover:bg-slate-900 hover:text-white"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm"),
        !active &&
          !isDisabled &&
          !glass &&
          "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        isDisabled && "cursor-not-allowed text-slate-400 opacity-75",
      )}
    >
      {active && !glass && (
        <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-emerald-500" />
      )}
      <Icon className="size-5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );

  if (collapsed) {
    return (
      <li>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {label}
            {isDisabled && (
              <span className="ml-1 text-xs opacity-60">
                ({comingSoonLabel})
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      </li>
    );
  }

  return <li>{content}</li>;
}

function SidebarUserBlock({
  collapsed,
  tone,
}: {
  collapsed: boolean;
  tone: SidebarTone;
}) {
  const glass = tone === "glass";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-t px-4 py-3",
        glass && "mx-3 mb-2 rounded-[14px] border bg-white/26 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.34)]",
        collapsed && "justify-center px-2",
      )}
      style={{
        borderColor: glass
          ? "rgba(255, 255, 255, 0.42)"
          : "rgba(203, 213, 225, 0.72)",
      }}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
          glass
            ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700",
        )}
      >
        U
      </div>
      {!collapsed && <span className="truncate text-sm text-slate-600">User</span>}
    </div>
  );
}

function SidebarTaskStats({ tone }: { tone: SidebarTone }) {
  const glass = tone === "glass";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-around border-t px-4 py-2 text-xs font-medium text-slate-500",
        glass && "border-t-0 bg-white/18",
      )}
      style={{
        borderColor: glass
          ? "rgba(255, 255, 255, 0.24)"
          : "rgba(203, 213, 225, 0.72)",
      }}
    >
      <span>OK 0</span>
      <span>Run 0</span>
      <span>Idle 0</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  embedded?: boolean;
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  embedded = false,
}: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  const { copy } = useI18n();
  const activeId = getActiveSidebarId(location);
  const sidebarCopy = copy.sidebar;
  const sidebarTone: SidebarTone = embedded ? "glass" : "light";

  const labelMap: Record<string, string> = {
    autopilot: sidebarCopy.autopilot,
    tasks: sidebarCopy.tasks,
    projects: sidebarCopy.projects,
    knowledge: sidebarCopy.knowledge,
    datasource: sidebarCopy.datasource,
    dashboard: sidebarCopy.dashboard,
    marketplace: sidebarCopy.marketplace,
    notifications: sidebarCopy.notifications,
    settings: sidebarCopy.settings,
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r text-slate-800 backdrop-blur-xl transition-[width] duration-[250ms] ease-in-out",
        sidebarTone === "glass"
          ? "shadow-[18px_0_48px_rgba(15,23,42,0.08)]"
          : "shadow-[8px_0_28px_rgba(15,23,42,0.08)]",
        embedded ? "relative h-full" : "fixed bottom-0 left-0 top-0 z-40",
      )}
      data-sidebar-mode={embedded ? "embedded" : "fixed"}
      data-sidebar-tone={sidebarTone}
      style={{
        width: collapsed ? 64 : 240,
        background: embedded
          ? "linear-gradient(90deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.36) 72%, rgba(255, 255, 255, 0.24) 100%)"
          : "rgba(255, 255, 255, 0.96)",
        borderColor: embedded
          ? "rgba(255, 255, 255, 0.42)"
          : "rgba(203, 213, 225, 0.72)",
        color: "#1e293b",
      }}
    >
      <SidebarHeader collapsed={collapsed} tone={sidebarTone} />

      <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Main navigation">
        <ul role="list" className="flex flex-col gap-1">
          {SIDEBAR_NAV_ITEMS.map((item) => (
            <SidebarNavItem
              key={item.id}
              item={item}
              active={item.id === activeId}
              collapsed={collapsed}
              label={labelMap[item.id] ?? item.id}
              comingSoonLabel={sidebarCopy.comingSoon}
              onNavigate={setLocation}
              tone={sidebarTone}
            />
          ))}
        </ul>
      </nav>

      <div className="flex shrink-0 justify-end px-2 py-1">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? sidebarCopy.expand : sidebarCopy.collapse}
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <ChevronsLeft
            className={cn("size-4 transition-transform duration-200", collapsed && "rotate-180")}
          />
        </button>
      </div>

      <SidebarStatusBlock collapsed={collapsed} tone={sidebarTone} />

      <SidebarUserBlock collapsed={collapsed} tone={sidebarTone} />

      {!collapsed && <SidebarTaskStats tone={sidebarTone} />}
    </aside>
  );
}
