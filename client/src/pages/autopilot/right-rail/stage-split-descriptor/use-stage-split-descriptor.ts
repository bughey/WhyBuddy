import { useMemo } from "react";
import type { StageSplitDescriptor, StageSplitDescriptorInput } from "./types";
import { deriveStageSplitDescriptor } from "./derive-stage-split-descriptor";

/**
 * React hook wrapper around `deriveStageSplitDescriptor`.
 *
 * Callers MUST use one of two compliant patterns:
 * (a) Call this hook flatly at the top of the component, once per sub, in a
 *     fixed order (e.g. 4 explicit calls for the 4 preflight subs).
 * (b) Call a single `useMemo` at the top and invoke the pure
 *     `deriveStageSplitDescriptor` per sub inside it.
 *
 * The hook MUST NOT be called inside conditionals, loops, `.map()`, or
 * `case` branches — that violates React's Rules of Hooks.
 */
export function useStageSplitDescriptor(
  input: StageSplitDescriptorInput
): StageSplitDescriptor {
  return useMemo(
    () => deriveStageSplitDescriptor(input),
    [
      input.sub,
      input.locale,
      input.isActive,
      input.isCompleted,
      input.intake,
      input.projectContext,
      input.clarificationSession,
      input.readiness,
      input.routeSet,
      input.selection,
      input.specTree,
      input.job,
    ]
  );
}
