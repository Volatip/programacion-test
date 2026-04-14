import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Funcionarios } from "./Funcionarios";

const useAuthMock = vi.fn();
const useSupervisorScopeMock = vi.fn();
const useOfficialsMock = vi.fn();
const usePeriodsMock = vi.fn();
const useProgrammingCacheMock = vi.fn();
const dismissReasonsListMock = vi.fn();

vi.mock("../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../context/SupervisorScopeContext", () => ({
  useSupervisorScope: () => useSupervisorScopeMock(),
}));

vi.mock("../context/OfficialsContext", () => ({
  useOfficials: () => useOfficialsMock(),
}));

vi.mock("../context/PeriodsContext", () => ({
  usePeriods: () => usePeriodsMock(),
}));

vi.mock("../context/ProgrammingCacheContext", () => ({
  useProgrammingCache: () => useProgrammingCacheMock(),
}));

vi.mock("../components/contextual-help/ContextualHelpButton", () => ({
  ContextualHelpButton: () => <div>Help funcionarios</div>,
}));

vi.mock("../components/supervisor/SupervisorScopePanel", () => ({
  SupervisorScopePanel: () => <div>Supervisor Scope Panel</div>,
}));

vi.mock("../components/funcionarios/FuncionariosModals", () => ({
  FuncionariosModals: () => null,
}));

vi.mock("../lib/dismissReasons", () => ({
  dismissReasonsApi: {
    list: (...args: unknown[]) => dismissReasonsListMock(...args),
  },
  isPartialCommissionSelection: vi.fn(() => false),
}));

describe("Funcionarios page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { role: "admin" } });
    useSupervisorScopeMock.mockReturnValue({
      isSupervisor: false,
      isScopeReady: true,
    });
    usePeriodsMock.mockReturnValue({ isReadOnly: false });
    useProgrammingCacheMock.mockReturnValue({ removeCachedProgramming: vi.fn() });
    dismissReasonsListMock.mockResolvedValue([]);
    useOfficialsMock.mockReturnValue({
      officials: [
        {
          id: 1,
          name: "Carlos Vega",
          title: "Enfermero",
          rut: "11.111.111-1",
          law: "15076",
          hours: 44,
          initial: "CV",
          color: "bg-blue-600",
          isScheduled: true,
          groupId: 1,
          sisSpecialty: "Urgencia",
          lunchTime: "60 min",
          status: "activo",
          holidayDays: 0,
          administrativeDays: 0,
          congressDays: 0,
          breastfeedingTime: 0,
          lastUpdated: "08/04/2026",
          observations: "",
          contracts: [],
        },
        {
          id: 2,
          name: "Ana Soto",
          title: "Médico",
          rut: "22.222.222-2",
          law: "19664",
          hours: 11,
          initial: "AS",
          color: "bg-green-600",
          isScheduled: true,
          groupId: 1,
          sisSpecialty: "Pediatría",
          lunchTime: "30 min",
          status: "activo",
          holidayDays: 0,
          administrativeDays: 0,
          congressDays: 0,
          breastfeedingTime: 0,
          lastUpdated: "07/04/2026",
          observations: "",
          contracts: [],
        },
        {
          id: 3,
          name: "Bruno Díaz",
          title: "Matrona",
          rut: "33.333.333-3",
          law: "15076 y 19664",
          hours: 33,
          initial: "BD",
          color: "bg-cyan-600",
          isScheduled: false,
          groupId: 1,
          sisSpecialty: "Cardiología",
          lunchTime: "45 min",
          status: "activo",
          holidayDays: 0,
          administrativeDays: 0,
          congressDays: 0,
          breastfeedingTime: 0,
          lastUpdated: "06/04/2026",
          observations: "",
          contracts: [],
        },
        {
          id: 4,
          name: "Diana Fin",
          title: "Enfermera",
          rut: "44.444.444-4",
          law: "18834",
          hours: 22,
          initial: "DF",
          color: "bg-violet-600",
          isScheduled: false,
          groupId: 1,
          sisSpecialty: "UPC",
          lunchTime: "30 min",
          status: "inactivo",
          inactiveReason: "Renuncia",
          terminationDate: "05/04/2026",
          terminationDateRaw: "2026-04-05T00:00:00Z",
          holidayDays: 0,
          administrativeDays: 0,
          congressDays: 0,
          breastfeedingTime: 0,
          lastUpdated: "05/04/2026",
          observations: "",
          contracts: [],
        },
      ],
      addOfficial: vi.fn(),
      removeOfficial: vi.fn(),
      activateOfficial: vi.fn(),
      clearPartialCommission: vi.fn(),
      clearFutureDismiss: vi.fn(),
      searchOfficials: vi.fn().mockResolvedValue([]),
      refreshOfficials: vi.fn(),
    });
  });

  it("sorts officials by column and toggles direction", async () => {
    const { container } = render(<Funcionarios />);

    await waitFor(() => expect(dismissReasonsListMock).toHaveBeenCalled());
    await screen.findByText("Ana Soto");

    const getVisibleNames = () =>
      Array.from(container.querySelectorAll("tbody tr td:first-child > div > .min-w-0 > div.truncate.text-sm.font-semibold"))
        .map((element) => element.textContent)
        .filter(Boolean);

    expect(getVisibleNames()).toEqual(["Ana Soto", "Bruno Díaz", "Carlos Vega"]);

    fireEvent.click(screen.getByRole("button", { name: /ordenar por hrs\/sem/i }));
    expect(getVisibleNames()).toEqual(["Ana Soto", "Bruno Díaz", "Carlos Vega"]);

    fireEvent.click(screen.getByRole("button", { name: /ordenar por hrs\/sem/i }));
    expect(getVisibleNames()).toEqual(["Carlos Vega", "Bruno Díaz", "Ana Soto"]);

    fireEvent.click(screen.getByRole("button", { name: /ordenar por funcionario/i }));
    expect(getVisibleNames()).toEqual(["Ana Soto", "Bruno Díaz", "Carlos Vega"]);
  });

  it("resets sorting when changing to a status view that hides the active sort column", async () => {
    const { container } = render(<Funcionarios />);

    await waitFor(() => expect(dismissReasonsListMock).toHaveBeenCalled());
    await screen.findByText("Carlos Vega");

    const getVisibleNames = () =>
      Array.from(container.querySelectorAll("tbody tr td:first-child > div > .min-w-0 > div.truncate.text-sm.font-semibold"))
        .map((element) => element.textContent)
        .filter(Boolean);

    fireEvent.click(screen.getByRole("button", { name: /inactivos/i }));
    await screen.findByText("Diana Fin");

    fireEvent.click(screen.getByRole("button", { name: /ordenar por fecha término/i }));
    fireEvent.click(screen.getByRole("button", { name: /^activos$/i }));

    expect(getVisibleNames()).toEqual(["Ana Soto", "Bruno Díaz", "Carlos Vega"]);
    expect(screen.queryByRole("button", { name: /ordenar por fecha término/i })).toBeNull();
  });
});
