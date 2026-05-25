import type { FC } from "react";

import type { AppLocale } from "@/lib/locale";
import type { BlueprintGenerationJob } from "@shared/blueprint/contracts";

import { ProcessArtifactSplitPanel } from "./ProcessArtifactSplitPanel";
import type { StageSplitDescriptor } from "./stage-split-descriptor/types";

export interface StageSplitMountProps {
  descriptor: StageSplitDescriptor;
  job: BlueprintGenerationJob | null;
  locale: AppLocale;
  variant: "active" | "completed";
}

/**
 * Thin pass-through mount for a single sub-stage's two-column split panel.
 *
 * - Returns `null` when `descriptor.shouldMount === false`
 * - Otherwise renders `<ProcessArtifactSplitPanel>` with the descriptor's
 *   pre-computed artifacts, stageFilter, artifactTypes, and fallback entries
 * - Wraps in a `div` with a stable `data-testid` for regression visibility
 *
 * No hooks, no state, no network calls.
 */
export const StageSplitMount: FC<StageSplitMountProps> = ({
  descriptor,
  job,
  locale,
  variant,
}) => {
  if (!descriptor.shouldMount) {
    return null;
  }

  return (
    <div
      data-testid={`autopilot-stage-split-mount-${descriptor.sub}-${variant}`}
    >
      <ProcessArtifactSplitPanel
        artifacts={descriptor.artifacts}
        stageFilter={descriptor.stageFilter}
        artifactTypes={descriptor.artifactTypes as readonly string[]}
        fallbackExecutionEntries={descriptor.fallbackExecutionEntries}
        executionTitle={descriptor.executionTitle}
        artifactTitle={descriptor.artifactTitle}
        locale={locale}
        job={job}
      />
    </div>
  );
};
