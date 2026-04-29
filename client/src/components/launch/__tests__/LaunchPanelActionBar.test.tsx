import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const { appState } = vi.hoisted(() => ({
  appState: {
    locale: "en-US",
    runtimeMode: "frontend",
    setRuntimeMode: async () => {},
  },
}));

vi.mock("@/lib/store", () => ({
  useAppStore: (selector: (state: typeof appState) => unknown) =>
    selector(appState),
}));

import { LaunchPanelActionBar } from "../LaunchPanelActionBar";

describe("LaunchPanelActionBar", () => {
  it("renders compact composer actions", () => {
    const markup = renderToStaticMarkup(
      createElement(LaunchPanelActionBar, {
        mode: "quick",
        onSubmit: () => {},
        onAddAttachment: () => {},
        submitting: false,
        disabled: false,
        attachmentCount: 0,
      })
    );

    expect(markup).toContain('data-testid="launch-action-attachment"');
    expect(markup).toContain('data-testid="launch-action-create-task"');
    expect(markup).toContain('data-testid="launch-action-advanced"');
    expect(markup).toContain('data-testid="launch-action-more"');
    expect(markup).toContain('data-testid="launch-action-submit"');
  });

  it("shows Launch text when not submitting", () => {
    appState.locale = "en-US";
    const markup = renderToStaticMarkup(
      createElement(LaunchPanelActionBar, {
        mode: "quick",
        onSubmit: () => {},
        onAddAttachment: () => {},
        submitting: false,
        disabled: false,
        attachmentCount: 0,
      })
    );

    expect(markup).toContain("Launch");
    expect(markup).not.toContain("Submitting...");
  });

  it("shows Submitting... text when submitting", () => {
    appState.locale = "en-US";
    const markup = renderToStaticMarkup(
      createElement(LaunchPanelActionBar, {
        mode: "quick",
        onSubmit: () => {},
        onAddAttachment: () => {},
        submitting: true,
        disabled: false,
        attachmentCount: 0,
      })
    );

    expect(markup).toContain("Submitting...");
    expect(markup).not.toContain("Launch</button>");
  });

  it("disables submit button when disabled=true", () => {
    const markup = renderToStaticMarkup(
      createElement(LaunchPanelActionBar, {
        mode: "quick",
        onSubmit: () => {},
        onAddAttachment: () => {},
        submitting: false,
        disabled: true,
        attachmentCount: 0,
      })
    );

    expect(markup).toContain("disabled");
  });

  it("disables submit button when submitting=true", () => {
    const markup = renderToStaticMarkup(
      createElement(LaunchPanelActionBar, {
        mode: "quick",
        onSubmit: () => {},
        onAddAttachment: () => {},
        submitting: true,
        disabled: false,
        attachmentCount: 0,
      })
    );

    expect(markup).toContain("disabled");
  });

  it("shows attachment count when attachments exist", () => {
    const markup = renderToStaticMarkup(
      createElement(LaunchPanelActionBar, {
        mode: "quick",
        onSubmit: () => {},
        onAddAttachment: () => {},
        submitting: false,
        disabled: false,
        attachmentCount: 3,
      })
    );

    expect(markup).toContain("(3)");
  });

  it("does not show attachment count when zero", () => {
    const markup = renderToStaticMarkup(
      createElement(LaunchPanelActionBar, {
        mode: "quick",
        onSubmit: () => {},
        onAddAttachment: () => {},
        submitting: false,
        disabled: false,
        attachmentCount: 0,
      })
    );

    expect(markup).not.toContain("(0)");
  });

  it("renders Chinese labels when locale is zh-CN", () => {
    appState.locale = "zh-CN";
    const markup = renderToStaticMarkup(
      createElement(LaunchPanelActionBar, {
        mode: "quick",
        onSubmit: () => {},
        onAddAttachment: () => {},
        submitting: false,
        disabled: false,
        attachmentCount: 0,
      })
    );

    expect(markup).toContain("添加附件");
    expect(markup).toContain("新建任务");
    expect(markup).toContain("高级");
    expect(markup).toContain("更多");
    expect(markup).toContain("发起");
    appState.locale = "en-US";
  });
});
