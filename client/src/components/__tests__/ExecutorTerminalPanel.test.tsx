import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ExecutorTerminalPanel } from "../ExecutorTerminalPanel";

describe("ExecutorTerminalPanel", () => {
  it("renders the auto-scroll toggle copy", () => {
    const markup = renderToStaticMarkup(
      <ExecutorTerminalPanel
        missionId="mission-1"
        missionStatus="running"
        executorStatus="running"
      />
    );

    expect(markup).toContain("暂停滚动");
  });
});
