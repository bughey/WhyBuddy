/**
 * autopilot-mirofish-stream / Wave 0 — 6 类 MiroFish 卡片组件
 *
 * 每张卡片都是 SSR 友好的纯展示组件,共享 MiroFishCardShell 外壳,只通过
 * primaryRow / secondaryRow / icon / label / dataAttrs 注入差异。
 *
 * 自动驾驶 3D 场景融合 follow-up 修复（2026-05-13 i18n）：
 * - 所有 user-facing 文本（artifact title / node title / route title /
 *   reasoning thought&observation / system note message）都通过
 *   `blueprintCopy(value, locale)` 走中英文翻译表。
 * - `locale` 由 MiroFishCardStream 主组件透传,缺省 fallback 到 "zh-CN"。
 * - 不动 label / status / icon 等结构化标识符（capability · invoking 等仍英文）。
 */

import type { FC } from "react";

import { blueprintCopy } from "@/lib/blueprint-copy";
import type { AppLocale } from "@/lib/locale";

import type {
  MiroFishArtifactCreatedEntry,
  MiroFishCapabilityInvocationEntry,
  MiroFishNodeCompletedEntry,
  MiroFishReasoningEntry,
  MiroFishRouteDecisionEntry,
  MiroFishSystemNoteEntry,
} from "../mirofish-stream-types";

import { MiroFishCardShell } from "./card-shell";

// ─── ReasoningCard ───────────────────────────────────────────────────────

const REASONING_PHASE_ICON: Record<string, string> = {
  thinking: "💭",
  acting: "⚡",
  observing: "👁",
  completed: "✓",
  error: "⚠",
};

const REASONING_PHASE_LABEL: Record<string, string> = {
  thinking: "thinking",
  acting: "acting",
  observing: "observing",
  completed: "completed",
  error: "error",
};

export const ReasoningCard: FC<{
  entry: MiroFishReasoningEntry;
  locale?: AppLocale;
}> = ({ entry, locale = "zh-CN" }) => {
  const icon = REASONING_PHASE_ICON[entry.phase] ?? "·";
  const label = `${REASONING_PHASE_LABEL[entry.phase] ?? entry.phase} · ${entry.iterationLabel}`;

  let primary: string | undefined;
  if (entry.thought) primary = blueprintCopy(entry.thought, locale);
  else if (entry.actionToolId) primary = `→ ${entry.actionToolId}`;
  else if (entry.observationSummary) {
    const mark = entry.observationSuccess === false ? "✗" : "✓";
    primary = `${mark} ${blueprintCopy(entry.observationSummary, locale)}`;
  } else if (entry.reason) primary = blueprintCopy(entry.reason, locale);
  else if (entry.error) primary = blueprintCopy(entry.error, locale);

  return (
    <MiroFishCardShell
      icon={icon}
      label={label}
      tone={entry.tone}
      timestamp={entry.timestamp}
      primaryRow={primary}
      testid="mirofish-card-reasoning"
      dataAttrs={{
        "data-phase": entry.phase,
        "data-iteration": entry.iterationLabel,
      }}
    />
  );
};

// ─── NodeCompletedCard ───────────────────────────────────────────────────

const NODE_SOURCE_LABEL: Record<string, string> = {
  llm: "llm",
  fallback: "fallback",
  template: "template",
};

export const NodeCompletedCard: FC<{
  entry: MiroFishNodeCompletedEntry;
  locale?: AppLocale;
}> = ({ entry, locale = "zh-CN" }) => {
  const sourceTag = entry.generationSource
    ? `· ${NODE_SOURCE_LABEL[entry.generationSource] ?? entry.generationSource}`
    : "";
  const docs = entry.documentTypes.join(" / ");
  return (
    <MiroFishCardShell
      icon="🌳"
      label="node_completed"
      tone={entry.tone}
      timestamp={entry.timestamp}
      primaryRow={`✓ ${blueprintCopy(entry.nodeTitle, locale)}`}
      secondaryRow={`${docs} ${sourceTag}`.trim()}
      testid="mirofish-card-node-completed"
      dataAttrs={{
        "data-node-id": entry.nodeId,
        "data-source": entry.generationSource ?? "unknown",
      }}
    />
  );
};

// ─── RouteDecisionCard ───────────────────────────────────────────────────

export const RouteDecisionCard: FC<{
  entry: MiroFishRouteDecisionEntry;
  locale?: AppLocale;
}> = ({ entry, locale = "zh-CN" }) => {
  const kindTag = entry.routeKind ? `· ${entry.routeKind}` : "";
  const titleZh = blueprintCopy(entry.routeTitle, locale);
  const reasonZh = entry.reason ? blueprintCopy(entry.reason, locale) : "";
  const primary =
    locale === "zh-CN"
      ? `选择路线：${titleZh}`
      : `Selected route: ${titleZh}`;
  return (
    <MiroFishCardShell
      icon="🛣"
      label="route_decision"
      tone={entry.tone}
      timestamp={entry.timestamp}
      primaryRow={primary}
      secondaryRow={[reasonZh, kindTag].filter(Boolean).join("  ")}
      testid="mirofish-card-route-decision"
      dataAttrs={{
        "data-route-id": entry.routeId,
        "data-route-kind": entry.routeKind ?? "unknown",
      }}
    />
  );
};

// ─── CapabilityInvocationCard ────────────────────────────────────────────

const CAPABILITY_STATUS_LABEL: Record<string, string> = {
  invoking: "invoking",
  completed: "completed",
  failed: "failed",
};

export const CapabilityInvocationCard: FC<{
  entry: MiroFishCapabilityInvocationEntry;
}> = ({ entry }) => {
  const statusLabel =
    CAPABILITY_STATUS_LABEL[entry.status] ?? entry.status;
  return (
    <MiroFishCardShell
      icon="🔧"
      label={`capability · ${statusLabel}`}
      tone={entry.tone}
      timestamp={entry.timestamp}
      primaryRow={entry.capabilityId}
      testid="mirofish-card-capability"
      dataAttrs={{
        "data-capability-id": entry.capabilityId,
        "data-capability-status": entry.status,
      }}
    />
  );
};

// ─── ArtifactCreatedCard ─────────────────────────────────────────────────

export const ArtifactCreatedCard: FC<{
  entry: MiroFishArtifactCreatedEntry;
  locale?: AppLocale;
}> = ({ entry, locale = "zh-CN" }) => {
  return (
    <MiroFishCardShell
      icon="📦"
      label={`artifact · ${entry.artifactType}`}
      tone={entry.tone}
      timestamp={entry.timestamp}
      primaryRow={blueprintCopy(entry.title, locale)}
      testid="mirofish-card-artifact"
      dataAttrs={{
        "data-artifact-id": entry.artifactId,
        "data-artifact-type": entry.artifactType,
      }}
    />
  );
};

// ─── SystemNoteCard ───────────────────────────────────────────────────────

export const SystemNoteCard: FC<{
  entry: MiroFishSystemNoteEntry;
  locale?: AppLocale;
}> = ({ entry, locale = "zh-CN" }) => {
  return (
    <MiroFishCardShell
      icon={entry.tone === "warning" || entry.tone === "danger" ? "⚠" : "ℹ"}
      label="system"
      tone={entry.tone}
      timestamp={entry.timestamp}
      primaryRow={blueprintCopy(entry.message, locale)}
      secondaryRow={entry.hint ? blueprintCopy(entry.hint, locale) : undefined}
      testid="mirofish-card-system-note"
    />
  );
};

export { MiroFishCardShell, formatTimestampHHMMSS } from "./card-shell";
