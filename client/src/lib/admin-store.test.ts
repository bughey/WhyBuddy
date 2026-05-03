import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAdminStore } from "./admin-store";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("admin-store", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    useAdminStore.getState().resetForTest();
  });

  it("loads users with the cookie session included", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        items: [
          {
            id: "user-1",
            email: "admin@example.com",
            emailNormalized: "admin@example.com",
            displayName: "Admin",
            avatarUrl: null,
            role: "admin",
            status: "active",
            emailVerifiedAt: null,
            lastLoginAt: null,
            lastLoginIp: null,
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:00.000Z",
          },
        ],
      })
    );

    await useAdminStore.getState().loadUsers();

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users", {
      credentials: "include",
    });
    expect(useAdminStore.getState().users).toHaveLength(1);
    expect(useAdminStore.getState().users[0].email).toBe("admin@example.com");
  });

  it("surfaces success false errors from admin endpoints", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: "Admin only" }, 403)
    );

    await useAdminStore.getState().loadProjects();

    expect(useAdminStore.getState().projects).toEqual([]);
    expect(useAdminStore.getState().error).toBe("Admin only");
    expect(useAdminStore.getState().loading).toBe(false);
  });

  it("loads overview endpoints in parallel with credentials", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          summary: { users: 1, projects: 1, runs: 0, failures: 0, audit: 0 },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, items: [] }))
      .mockResolvedValueOnce(jsonResponse({ success: true, items: [] }))
      .mockResolvedValueOnce(jsonResponse({ success: true, items: [] }))
      .mockResolvedValueOnce(jsonResponse({ success: true, items: [] }))
      .mockResolvedValueOnce(jsonResponse({ success: true, items: [] }));

    await useAdminStore.getState().loadOverview();

    expect(fetchMock).toHaveBeenCalledTimes(6);
    for (const call of fetchMock.mock.calls) {
      expect(call[1]).toEqual({ credentials: "include" });
    }
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      "/api/admin/summary",
      "/api/admin/users",
      "/api/admin/projects",
      "/api/admin/runs",
      "/api/admin/failures",
      "/api/admin/audit",
    ]);
    expect(useAdminStore.getState().summary?.users).toBe(1);
  });
});
