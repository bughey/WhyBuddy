import { describe, expect, it } from "vitest";

import { getViewportTier, isDesktopViewportWidth } from "./useViewportTier";

describe("getViewportTier", () => {
  it("maps mobile widths to mobile", () => {
    expect(getViewportTier(320)).toBe("mobile");
    expect(getViewportTier(767)).toBe("mobile");
  });

  it("maps tablet widths to tablet", () => {
    expect(getViewportTier(768)).toBe("tablet");
    expect(getViewportTier(1279)).toBe("tablet");
  });

  it("maps desktop widths to desktop", () => {
    expect(getViewportTier(1280)).toBe("desktop");
    expect(getViewportTier(1440)).toBe("desktop");
    expect(getViewportTier(1728)).toBe("desktop");
  });

  it("exposes the shared desktop breakpoint used by first-screen chrome", () => {
    expect(isDesktopViewportWidth(1279)).toBe(false);
    expect(isDesktopViewportWidth(1280)).toBe(true);
    expect(isDesktopViewportWidth(1440)).toBe(true);
    expect(isDesktopViewportWidth(1728)).toBe(true);
  });
});
