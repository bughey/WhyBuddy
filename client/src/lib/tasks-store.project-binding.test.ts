import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateMission = vi.fn();
const mockListMissions = vi.fn();
const mockListPlanets = vi.fn();

vi.mock("./mission-client", () => ({
  cancelMission: vi.fn(),
  createMission: (...args: unknown[]) => mockCreateMission(...args),
  getMission: vi.fn(),
  getPlanet: vi.fn(),
  getPlanetInterior: vi.fn(),
  listMissionEvents: vi.fn(),
  listMissions: (...args: unknown[]) => mockListMissions(...args),
  listPlanets: (...args: unknown[]) => mockListPlanets(...args),
  submitMissionDecision: vi.fn(),
  submitMissionOperatorAction: vi.fn(),
}));

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock("./sandbox-store", () => ({
  useSandboxStore: {
    getState: () => ({
      initSocket: vi.fn(),
    }),
  },
}));

vi.mock("./store", () => ({
  useAppStore: Object.assign(() => ({}), {
    getState: () => ({ runtimeMode: "advanced" }),
    subscribe: vi.fn(),
  }),
}));

async function importFreshStore() {
  vi.resetModules();
  const mod = await import("./tasks-store");
  const { useTasksStore } = mod;

  useTasksStore.setState({
    ready: false,
    loading: false,
    error: null,
    missionSocketConnected: false,
    selectedTaskId: null,
    tasks: [],
    detailsById: {},
    decisionNotes: {},
    cancellingMissionIds: {},
    operatorActionLoadingByMissionId: {},
    lastDecisionLaunch: null,
  });

  return useTasksStore;
}

describe("tasks-store project-bound mission creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", {
      location: { origin: "http://localhost" },
      setTimeout,
      clearTimeout,
      sessionStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });
    mockCreateMission.mockResolvedValue({
      ok: true,
      task: {
        id: "mission-1",
      },
    });
    mockListMissions.mockResolvedValue({ ok: true, tasks: [] });
    mockListPlanets.mockResolvedValue({ ok: true, planets: [], edges: [] });
  });

  it("passes projectId through to the mission API for server owner validation", async () => {
    const useTasksStore = await importFreshStore();

    await useTasksStore.getState().createMission({
      kind: "nl-command",
      sourceText: "Build the owned project route.",
      autoDispatch: true,
      projectId: "project-1",
    });

    expect(mockCreateMission).toHaveBeenCalledWith({
      kind: "nl-command",
      sourceText: "Build the owned project route.",
      autoDispatch: true,
      projectId: "project-1",
    });
  });

  it("omits null projectId instead of sending it to the mission API", async () => {
    const useTasksStore = await importFreshStore();

    await useTasksStore.getState().createMission({
      kind: "chat",
      sourceText: "Create a legacy unbound mission.",
      projectId: null,
    });

    expect(mockCreateMission).toHaveBeenCalledWith({
      kind: "chat",
      sourceText: "Create a legacy unbound mission.",
      projectId: undefined,
    });
  });
});
