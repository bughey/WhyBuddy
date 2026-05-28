import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { appState } = vi.hoisted(() => ({
  appState: {
    locale: "zh-CN",
    loadingProgress: 67,
    setLocale: () => {},
    toggleLocale: () => {},
  },
}));

vi.mock("@/lib/store", () => ({
  useAppStore: (selector: (state: typeof appState) => unknown) =>
    selector(appState),
}));

import { LoadingScreen } from "../LoadingScreen";

/**
 * MiroFish-aligned LoadingScreen contract — see
 * duanyun-rebrand-and-stage3-unblock-2026-05-28 §D.1.
 *
 * The pixel-art / hologram skin was replaced with a flat MiroFish surface:
 *   - white background, #FF4500 single-accent
 *   - 1px solid #E5E5E5 borders (no gradients, no shadows)
 *   - DM Sans wordmark renders the brand 端云 / Duanyun
 *   - status rail still shows INIT / SYNC / CONFIG / FINALIZE
 *   - progress bar still binds to --loading-progress and the percent label
 *
 * `data-testid="loading-screen"`, `loading-status-rail`, and
 * `loading-wide-card` are preserved so existing higher-level tests (Home
 * smoke etc.) keep matching. `loading-pixel-field` and
 * `loading-simple-logo` were removed by the skin swap and replaced with
 * `loading-brand-wordmark`.
 */
describe("LoadingScreen — MiroFish skin", () => {
  beforeEach(() => {
    appState.locale = "zh-CN";
    appState.loadingProgress = 67;
  });

  it("renders the MiroFish-aligned bootstrap composition", () => {
    const markup = renderToStaticMarkup(<LoadingScreen />);

    // — Surface anchors that other tests rely on
    expect(markup).toContain('data-testid="loading-screen"');
    expect(markup).toContain('data-testid="loading-wide-card"');
    expect(markup).toContain('data-testid="loading-status-rail"');
    expect(markup).toContain('data-testid="loading-brand-wordmark"');

    // — Brand swap: 端云 / Duanyun, not Cube Pets Office
    expect(markup).toContain("\u7aef\u4e91"); // 端云
    expect(markup).toContain("Duanyun");
    expect(markup).not.toContain("CUBE PETS OFFICE");
    expect(markup).not.toContain("Cube Pets Office");

    // — Tagline
    expect(markup).toContain(
      "\u7aef\u4fa7\u6267\u884c"
    ); // 端侧执行
    expect(markup).toContain(
      "\u4e91\u7aef\u8c03\u5ea6"
    ); // 云端调度

    // — Status rail labels
    expect(markup).toContain("SYSTEM");
    expect(markup).toContain("ONLINE");
    expect(markup).toContain("INIT");
    expect(markup).toContain("SYNC");
    expect(markup).toContain("CONFIG");
    expect(markup).toContain("FINALIZE");
    expect(markup).toContain("VER. 1.0.0");

    // — Progress
    expect(markup).toContain("PIXEL SYNC");
    expect(markup).toContain("67%");
    expect(markup).toContain("--loading-progress:67%");

    // — MiroFish accent stays as the single accent color
    expect(markup).toContain("#FF4500");

    // — Pixel-field / simple-logo were removed by the skin swap
    expect(markup).not.toContain('data-testid="loading-pixel-field"');
    expect(markup).not.toContain('data-testid="loading-simple-logo"');
    // — No gradients survive (MiroFish: no gradients)
    expect(markup).not.toContain("linear-gradient(90deg,#ff4d4f");
  });
});
