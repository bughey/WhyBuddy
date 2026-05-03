import { describe, expect, it } from "vitest";

import {
  isAdminRole,
  normalizeAuthEmail,
  type CurrentUser,
} from "../../shared/auth.js";

describe("auth shared contract", () => {
  it("normalizes email globally and identifies admin roles", () => {
    expect(normalizeAuthEmail("  USER@Example.COM ")).toBe("user@example.com");
    expect(isAdminRole("user")).toBe(false);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(true);
  });

  it("keeps CurrentUser free of password and token fields", () => {
    const user: CurrentUser = {
      id: "user-1",
      email: "user@example.com",
      role: "user",
      status: "active",
      emailVerified: true,
      createdAt: "2026-04-30T00:00:00.000Z",
    };

    expect(JSON.stringify(user)).not.toContain("passwordHash");
    expect(JSON.stringify(user)).not.toContain("tokenHash");
  });
});
