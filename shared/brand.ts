/**
 * 端云 / Duanyun — brand constants.
 *
 * Per duanyun-rebrand-and-stage3-unblock-2026-05-28 §C, the project's user-
 * facing brand has changed from "Cube Pets Office" to "端云 / Duanyun".
 *
 * Strategy: alias-first, not big-bang rename. Internal symbols (file names,
 * module identifiers, audit / lineage event families, the 287 spec dirs that
 * mention the legacy name) keep their existing strings; only the user-
 * visible touchpoints (HTML title, login screen, loading screen, README hero,
 * package.json `name`) consume these constants.
 *
 * The legacy package name stays exported here (`BRAND_PACKAGE_LEGACY`) for
 * the small number of modules that need to reference the old token while a
 * future `duanyun-internal-rename` spec carries out a coordinated sweep.
 */

export const BRAND_NAME_DISPLAY = "端云";
export const BRAND_NAME_LATIN = "Duanyun";
export const BRAND_NAME_FULL = "端云 / Duanyun";
export const BRAND_DOMAIN = "duanyun.com";

export const BRAND_TAGLINE_ZH = "端侧执行 · 云端调度";
export const BRAND_TAGLINE_EN = "Edge execution · Cloud orchestration";

/**
 * One-line product tagline that combines display name + tagline. Used by the
 * HTML <title> and the login subtitle.
 */
export const BRAND_HEADLINE_ZH = `${BRAND_NAME_DISPLAY}·任务自动驾驶`;
export const BRAND_HEADLINE_EN = `${BRAND_NAME_LATIN} · Task Autopilot`;

/**
 * Legacy package name — kept for places that still need to reference the
 * old token while the internal rename is staged.
 */
export const BRAND_PACKAGE_LEGACY = "cube-pets-office";
