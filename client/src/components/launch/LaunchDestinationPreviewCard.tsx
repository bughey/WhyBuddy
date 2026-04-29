import type { LaunchDestinationPreview } from "@/lib/autopilot-launch-examples";
import { cn } from "@/lib/utils";

function t(locale: string, zh: string, en: string) {
  return locale === "zh-CN" ? zh : en;
}

function getPreviewConfidenceClass(
  confidence: LaunchDestinationPreview["confidence"]
) {
  if (confidence === "high") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (confidence === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function getPreviewConfidenceLabel(
  locale: string,
  confidence: LaunchDestinationPreview["confidence"]
) {
  if (confidence === "high") {
    return t(locale, "高置信", "High confidence");
  }
  if (confidence === "medium") {
    return t(locale, "中置信", "Medium confidence");
  }
  return t(locale, "需补路标", "Needs waypoints");
}

export const UNIFIED_LAUNCH_EXPLANATION_LAYER_MARKERS = [
  "destination-preview",
  "confidence",
  "attachment-influence",
  "missing-waypoints",
  "waypoints-complete",
] as const;

function getMissingFieldLabel(
  locale: string,
  field: LaunchDestinationPreview["missingFields"][number]
) {
  switch (field) {
    case "goal":
      return t(locale, "目标", "Goal");
    case "deliverable":
      return t(locale, "交付物", "Deliverable");
    case "constraints":
      return t(locale, "约束", "Constraints");
    case "timeline":
      return t(locale, "时间线", "Timeline");
    case "successCriteria":
      return t(locale, "成功标准", "Success criteria");
  }
}

function PreviewValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-white/80 bg-white/64 px-2 py-1.5">
      <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-stone-400">
        {label}
      </div>
      <div className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-4 text-stone-700">
        {value}
      </div>
    </div>
  );
}

export function LaunchDestinationPreviewCard({
  preview,
  locale,
  className,
}: {
  preview: LaunchDestinationPreview;
  locale: string;
  className?: string;
}) {
  const missingLabels = preview.missingFields.map(field =>
    getMissingFieldLabel(locale, field)
  );
  const constraintText =
    preview.constraints.length > 0
      ? preview.constraints.join(" / ")
      : t(locale, "暂未识别", "Not detected");
  const successText =
    preview.successCriteria.length > 0
      ? preview.successCriteria.join(" / ")
      : t(locale, "暂未识别", "Not detected");

  return (
    <div
      className={cn(
        "mt-2 rounded-[18px] border border-[#d8e6dd]/80 bg-[linear-gradient(135deg,rgba(247,253,249,0.94),rgba(255,248,239,0.82))] p-2 shadow-[0_12px_30px_rgba(75,105,85,0.08)] motion-reduce:transition-none",
        className
      )}
      data-testid="autopilot-destination-preview-card"
      data-explanation-layer={UNIFIED_LAUNCH_EXPLANATION_LAYER_MARKERS[0]}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#267064]">
            {t(locale, "目的地预览", "Destination preview")}
          </div>
          <div className="mt-0.5 text-[10px] leading-4 text-stone-600">
            {t(
              locale,
              "先看系统理解到的目标、交付物和缺口，再选择路线发车。",
              "Review the interpreted goal, deliverable, and gaps before choosing a route."
            )}
          </div>
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-1 text-[9px] font-semibold",
            getPreviewConfidenceClass(preview.confidence)
          )}
          data-explanation-layer={UNIFIED_LAUNCH_EXPLANATION_LAYER_MARKERS[1]}
        >
          {getPreviewConfidenceLabel(locale, preview.confidence)}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewValue label={t(locale, "目标", "Goal")} value={preview.goal} />
        <PreviewValue
          label={t(locale, "交付物", "Deliverable")}
          value={preview.deliverable}
        />
        <PreviewValue
          label={t(locale, "时间线", "Timeline")}
          value={preview.timeline ?? t(locale, "暂未识别", "Not detected")}
        />
        <PreviewValue
          label={t(locale, "推荐模式", "Route mode")}
          value={preview.route.mode}
        />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <PreviewValue
          label={t(locale, "约束", "Constraints")}
          value={constraintText}
        />
        <PreviewValue
          label={t(locale, "成功标准", "Success criteria")}
          value={successText}
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-semibold">
        <span
          className="rounded-full border border-[#d8e6dd] bg-white/70 px-2 py-0.5 text-[#267064]"
          data-explanation-layer={UNIFIED_LAUNCH_EXPLANATION_LAYER_MARKERS[2]}
        >
          {preview.attachmentInfluence.summary}
        </span>
        {missingLabels.length > 0 ? (
          <span
            className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700"
            data-explanation-layer={UNIFIED_LAUNCH_EXPLANATION_LAYER_MARKERS[3]}
          >
            {t(locale, "缺少：", "Missing: ")}
            {missingLabels.join(" / ")}
          </span>
        ) : (
          <span
            className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700"
            data-explanation-layer={UNIFIED_LAUNCH_EXPLANATION_LAYER_MARKERS[4]}
          >
            {t(locale, "目的地路标完整", "Destination waypoints complete")}
          </span>
        )}
      </div>
    </div>
  );
}
