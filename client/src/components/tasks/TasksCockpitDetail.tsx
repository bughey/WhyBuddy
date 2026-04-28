import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import type {
  MissionOperatorActionLoadingMap,
  MissionTaskDetail,
} from "@/lib/tasks-store";
import type { MissionOperatorActionType } from "@shared/mission/contracts";
import { cn } from "@/lib/utils";

import { RightInfoPanel } from "./RightInfoPanel";
import { TaskDetailView } from "./TaskDetailView";

function t(locale: string, zh: string, en: string) {
  return locale === "zh-CN" ? zh : en;
}

export function TasksCockpitDetail({
  detail,
  decisionNote,
  onDecisionNoteChange,
  onLaunchDecision,
  launchingPresetId,
  onSubmitOperatorAction,
  operatorActionLoading,
  onDecisionSubmitted,
  className,
}: {
  detail: MissionTaskDetail | null;
  decisionNote: string;
  onDecisionNoteChange: (next: string) => void;
  onLaunchDecision: (presetId: string) => void | Promise<void>;
  launchingPresetId?: string | null;
  onSubmitOperatorAction?: (payload: {
    action: MissionOperatorActionType;
    reason?: string;
  }) => void | Promise<void>;
  operatorActionLoading?: MissionOperatorActionLoadingMap;
  onDecisionSubmitted?: () => void;
  className?: string;
}) {
  const { locale } = useI18n();
  const [showFullDetail, setShowFullDetail] = useState(false);

  if (!detail) {
    return (
      <RightInfoPanel
        detail={null}
        locale={locale}
        className={className}
      />
    );
  }

  return (
    <>
      <div
        className={cn(
          "h-full min-h-0 overflow-hidden rounded-[16px] border border-white/45 bg-white/45",
          "shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-md",
          "[&_[data-testid='right-info-panel']]:bg-transparent",
          "[&_[data-testid='task-overview-section']]:border-white/45 [&_[data-testid='task-overview-section']]:bg-white/54 [&_[data-testid='task-overview-section']]:shadow-none",
          "[&_[data-testid='live-progress-section']]:border-white/45 [&_[data-testid='live-progress-section']]:bg-white/54 [&_[data-testid='live-progress-section']]:shadow-none",
          "[&_[data-testid='recent-activity-section']]:border-white/45 [&_[data-testid='recent-activity-section']]:bg-white/54 [&_[data-testid='recent-activity-section']]:shadow-none",
          className
        )}
        data-visual-role="cockpit-side-detail"
      >
        <RightInfoPanel
          detail={detail}
          autopilotSummary={detail.autopilotSummary}
          locale={locale}
          onExpandDetail={() => setShowFullDetail(true)}
          className="h-full !bg-transparent"
        />
      </div>
      <Dialog open={showFullDetail} onOpenChange={setShowFullDetail}>
        <DialogContent
          className="max-h-[85vh] max-w-3xl overflow-y-auto"
          data-testid="full-detail-dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {t(locale, "完整任务详情", "Full Task Details")}
            </DialogTitle>
          </DialogHeader>
          <TaskDetailView
            detail={detail}
            decisionNote={decisionNote}
            onDecisionNoteChange={onDecisionNoteChange}
            onLaunchDecision={onLaunchDecision}
            launchingPresetId={launchingPresetId}
            onSubmitOperatorAction={onSubmitOperatorAction}
            operatorActionLoading={operatorActionLoading}
            onDecisionSubmitted={onDecisionSubmitted}
            variant="cockpit"
            autoHeight
            deferRuntimeEvidence
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
