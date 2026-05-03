import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@shared/auth";

import { useAuthStore } from "@/lib/auth-store";

import { AdminLayout } from "./AdminLayout";
import { AdminOverviewPage } from "./Overview";

const user: CurrentUser = {
  id: "user-1",
  email: "user@example.com",
  displayName: "User One",
  avatarUrl: null,
  role: "user",
  status: "active",
  emailVerified: true,
  createdAt: "2026-05-01T00:00:00.000Z",
};

describe("AdminLayout", () => {
  beforeEach(() => {
    useAuthStore.getState().resetForTest();
  });

  it("shows a sign-in prompt instead of admin content when logged out", () => {
    const markup = renderToStaticMarkup(
      <AdminLayout>
        <AdminOverviewPage />
      </AdminLayout>
    );

    expect(markup).toContain("Sign in required");
    expect(markup).toContain("/login");
    expect(markup).not.toContain('data-testid="admin-overview-page"');
  });

  it("blocks regular users from seeing admin navigation and pages", () => {
    useAuthStore.setState({ currentUser: user });

    const markup = renderToStaticMarkup(
      <AdminLayout>
        <AdminOverviewPage />
      </AdminLayout>
    );

    expect(markup).toContain("Admin access required");
    expect(markup).not.toContain("Admin navigation");
    expect(markup).not.toContain('data-testid="admin-overview-page"');
  });

  it("renders admin navigation and child pages for admins", () => {
    useAuthStore.setState({
      currentUser: { ...user, role: "admin", email: "admin@example.com" },
    });

    const markup = renderToStaticMarkup(
      <AdminLayout>
        <section data-testid="admin-child-page">Admin page</section>
      </AdminLayout>
    );

    expect(markup).toContain("Admin Console");
    expect(markup).toContain("Admin navigation");
    expect(markup).toContain("/admin/users");
    expect(markup).toContain("/admin/projects");
    expect(markup).toContain('data-testid="admin-child-page"');
  });
});
