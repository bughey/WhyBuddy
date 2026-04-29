import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button primitive", () => {
  it("forwards refs so Radix asChild triggers can anchor overlays", () => {
    expect(Button.$$typeof).toBe(Symbol.for("react.forward_ref"));
  });
});
