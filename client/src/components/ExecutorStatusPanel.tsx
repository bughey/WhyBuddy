import { Box, Clock, Loader2, Server } from "lucide-react";

import { EmptyHintBlock } from "@/components/tasks/EmptyHintBlock";
import { useI18n } from "@/i18n";
import { Progress } from "@/components/ui/progress";
import type {
  MissionExecutorContext,
  MissionInstanceContext,
} from "@shared/mission/contracts";
import { cn } from "@/lib/utils";

export interface ExecutorStatusPanelProps {
  executor?: MissionExecutorContext;
  instance?: MissionInstanceContext;
}

const STATUS_STYLES: Record<
  string,
  {
    dot: string;
    badge: string;
    labelKey:
      | "statusQueued"
      | "statusRunning"
      | "statusCompleted"
      | "statusFailed"
      | "statusWarning";
  }
> = {
  queued: {
    dot: "bg-stone-400",
    badge: "border-stone-200 bg-stone-50 text-stone-600",
    labelKey: "statusQueued",
  },
  running: {
    dot: "bg-sky-500 animate-pulse",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    labelKey: "statusRunning",
  },
  completed: {
    dot: "bg-emerald-500",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    labelKey: "statusCompleted",
  },
  failed: {
    dot: "bg-rose-500",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    labelKey: "statusFailed",
  },
  warning: {
    dot: "bg-amber-500",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    labelKey: "statusWarning",
  },
};

function statusStyle(status: string | undefined) {
  const normalized = status?.toLowerCase() ?? "";

  if (
    normalized.includes("fail") ||
    normalized.includes("error") ||
    normalized.includes("unreach") ||
    normalized.includes("disconnect")
  ) {
    return STATUS_STYLES.warning;
  }

  return STATUS_STYLES[normalized] ?? STATUS_STYLES.queued;
}

function formatEventTime(
  locale: string,
  ts: number | undefined,
  fallback: string
): string {
  if (!ts) return fallback;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(ts));
}

function isExecutorUnavailable(executor?: MissionExecutorContext): boolean {
  const status = executor?.status?.toLowerCase() ?? "";
  const lastEventType = executor?.lastEventType?.toLowerCase() ?? "";

  return (
    status.includes("unreach") ||
    status.includes("disconnect") ||
    status.includes("error") ||
    lastEventType.includes("error") ||
    lastEventType.includes("disconnect")
  );
}

export function ExecutorStatusPanel({
  executor,
  instance,
}: ExecutorStatusPanelProps) {
  const { locale, copy } = useI18n();

  if (!executor) return null;

  const style = statusStyle(executor.status);
  const isRunning = executor.status === "running";
  const unavailable = isExecutorUnavailable(executor);
  return (
    <div className="space-y-3" data-testid="executor-status-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Server className="size-4 text-stone-500" />
          <span className="text-sm font-semibold text-stone-900">
            {executor.name}
          </span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
            style.badge
          )}
        >
          <span className={cn("size-1.5 rounded-full", style.dot)} />
          {copy.tasks.executor[style.labelKey]}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {executor.jobId ? (
          <div className="rounded-[16px] border border-stone-200/80 bg-stone-50/70 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              {copy.tasks.executor.jobId}
            </div>
            <div className="mt-0.5 truncate text-xs font-medium text-stone-800">
              {executor.jobId}
            </div>
          </div>
        ) : null}
        <div className="rounded-[16px] border border-stone-200/80 bg-stone-50/70 px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            <Clock className="size-3" />
            {copy.tasks.executor.lastEvent}
          </div>
          <div className="mt-0.5 text-xs font-medium text-stone-800">
            {formatEventTime(
              locale,
              executor.lastEventAt,
              copy.common.unavailable
            )}
          </div>
        </div>
        <div className="rounded-[16px] border border-stone-200/80 bg-stone-50/70 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            {copy.tasks.executor.lastEventType}
          </div>
          <div className="mt-0.5 truncate text-xs font-medium text-stone-800">
            {executor.lastEventType || copy.common.unavailable}
          </div>
        </div>
      </div>

      {unavailable ? (
        <EmptyHintBlock
          icon={<Server className="size-4" />}
          title={copy.tasks.executor.unavailableTitle}
          description={copy.tasks.executor.unavailableDescription}
          tone="warning"
        />
      ) : null}

      {isRunning ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            <Loader2 className="size-3 animate-spin text-sky-500" />
            {copy.tasks.executor.runningHint}
          </div>
          <Progress className="h-1.5 bg-sky-100" value={undefined} />
        </div>
      ) : null}

      {instance?.image ? (
        <div className="rounded-[16px] border border-stone-200/80 bg-stone-50/70 px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            <Box className="size-3" />
            {copy.tasks.executor.container}
          </div>
          <div className="mt-0.5 truncate text-xs font-medium text-stone-800">
            {instance.image}
          </div>
        </div>
      ) : null}
    </div>
  );
}
