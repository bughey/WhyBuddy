/**
 * Camera compensation utilities for adapting the 3D scene to varying
 * effective viewport widths (e.g. when a sidebar is present).
 *
 * The functions are pure and side-effect-free so they can be tested
 * with property-based tests.
 */

const WIDE_THRESHOLD = 1200;
const NARROW_THRESHOLD = 800;
const MAX_FOV_COMPENSATION = 6;

/**
 * Compute an additive FOV compensation value based on the effective
 * viewport width.
 *
 * - effectiveWidth >= 1200  →  0° (no compensation needed)
 * - effectiveWidth <= 800   →  +6° (maximum compensation)
 * - Between 800 and 1200    →  linear interpolation
 *
 * **Properties**:
 *   1. Monotonicity – narrower width ⇒ larger compensation
 *   2. Bounded – result is always in [0, MAX_FOV_COMPENSATION]
 */
export function computeFovCompensation(effectiveWidth: number): number {
  if (effectiveWidth >= WIDE_THRESHOLD) return 0;
  if (effectiveWidth <= NARROW_THRESHOLD) return MAX_FOV_COMPENSATION;

  const ratio =
    (WIDE_THRESHOLD - effectiveWidth) / (WIDE_THRESHOLD - NARROW_THRESHOLD);
  return ratio * MAX_FOV_COMPENSATION;
}

const MAX_X_OFFSET = 0.3;

/**
 * Compute a camera X-axis offset to visually re-center the scene
 * when a sidebar occupies part of the viewport.
 *
 * - sidebarWidth === 0  →  0 (no offset)
 * - sidebarWidth >= 240 →  MAX_X_OFFSET (0.3)
 * - Between 0 and 240   →  linear interpolation
 */
export function computeCameraXOffset(
  _effectiveWidth: number,
  sidebarWidth: number
): number {
  if (sidebarWidth === 0) return 0;
  const ratio = Math.min(sidebarWidth / 240, 1);
  return ratio * MAX_X_OFFSET;
}
