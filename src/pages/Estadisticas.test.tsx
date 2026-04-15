import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Estadisticas from "./Estadisticas";

const useAuthMock = vi.fn();
const usePeriodsMock = vi.fn();
const useSupervisorScopeMock = vi.fn();
const useDashboardStatsMock = vi.fn();
const useThemeMock = vi.fn();

vi.mock("../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../context/PeriodsContext", () => ({
  usePeriods: () => usePeriodsMock(),
}));

vi.mock("../context/SupervisorScopeContext", () => ({
  useSupervisorScope: () => useSupervisorScopeMock(),
}));

vi.mock("../hooks/useDashboardStats", () => ({
  useDashboardStats: (...args: unknown[]) => useDashboardStatsMock(...args),
}));

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => useThemeMock(),
}));

vi.mock("../components/contextual-help/ContextualHelpButton", () => ({
  ContextualHelpButton: () => <div>Help estadísticas</div>,
}));

vi.mock("../components/supervisor/SupervisorScopePanel", () => ({
  SupervisorScopePanel: () => <div>Supervisor Scope Panel</div>,
}));

vi.mock("../components/dashboard/ContractStatisticsSection", () => ({
  ContractStatisticsSection: () => <div>Contract Statistics Section</div>,
}));

describe("Estadísticas page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { role: "admin" } });
    usePeriodsMock.mockReturnValue({ selectedPeriod: { id: 7, name: "2026-12" } });
    useSupervisorScopeMock.mockReturnValue({
      isSupervisor: false,
      isScopeReady: true,
      selectedUser: null,
    });
    useThemeMock.mockReturnValue({ theme: "light" });
    useDashboardStatsMock.mockReturnValue({
      stats: {
        summary: {
          period_name: "2026-12",
          shift_hours: 0,
          shift_officials_count: 0,
        },
        chart_data: [],
        group_chart_data: [],
      },
      loading: false,
      error: null,
      fetchStats: vi.fn(),
    });
  });

  it("preserves the dynamic period subtitle", () => {
    render(<Estadisticas />);

    expect(screen.getByRole("heading", { name: "Estadísticas" })).toBeTruthy();
    expect(screen.getByText("2026-12")).toBeTruthy();
    expect(screen.getByText("Contract Statistics Section")).toBeTruthy();
  });
});
