import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { General } from "./General";

const fetchWithAuthMock = vi.fn();
const parseErrorDetailMock = vi.fn();
const useAuthMock = vi.fn();
const usePeriodsMock = vi.fn();
const useSupervisorScopeMock = vi.fn();

vi.mock("../lib/api", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
  parseErrorDetail: (...args: unknown[]) => parseErrorDetailMock(...args),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../context/PeriodsContext", () => ({
  usePeriods: () => usePeriodsMock(),
}));

vi.mock("../context/SupervisorScopeContext", () => ({
  useSupervisorScope: () => useSupervisorScopeMock(),
}));

vi.mock("../components/supervisor/SupervisorScopePanel", () => ({
  SupervisorScopePanel: () => <div>Supervisor Scope Panel</div>,
}));

vi.mock("../components/contextual-help/ContextualHelpButton", () => ({
  ContextualHelpButton: ({ slug }: { slug: string }) => <div>Help: {slug}</div>,
}));

describe("General page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { role: "admin" } });
    usePeriodsMock.mockReturnValue({ selectedPeriod: { id: 7, name: "2026-12" } });
    useSupervisorScopeMock.mockReturnValue({
      isSupervisor: false,
      isScopeReady: true,
      selectedUser: null,
      selectedUserId: null,
    });
    parseErrorDetailMock.mockResolvedValue("No se pudo cargar la vista General.");
  });

  it("renders consolidated rows for admin", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          funcionario: "Andrea Pérez",
          title: "Enfermero",
          law_code: "15076 y 19664",
          specialty_sis: "Urgencia",
          hours_per_week: "22 hrs y 11 hrs",
          status: "activo",
          user_id: 1,
          user_ids: [1],
          user_name: "Jorge Medrano",
          is_scheduled: true,
          programmed_label: "Programado",
        },
      ],
    });

    render(
      <MemoryRouter>
        <General />
      </MemoryRouter>
    );

    await waitFor(() => expect(fetchWithAuthMock).toHaveBeenCalledWith("/general?period_id=7"));
    expect(await screen.findByText("Andrea Pérez")).toBeTruthy();
    expect(screen.getAllByText("Jorge Medrano").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Programado").length).toBeGreaterThan(1);
    expect(screen.getByText("Help: general")).toBeTruthy();
  });

  it("allows the general table for supervisor without selecting a user", async () => {
    useAuthMock.mockReturnValue({ user: { role: "supervisor" } });
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    useSupervisorScopeMock.mockReturnValue({
      isSupervisor: true,
      isScopeReady: false,
      selectedUser: null,
      selectedUserId: null,
    });

    render(
      <MemoryRouter>
        <General />
      </MemoryRouter>
    );

    expect(screen.getByText("Supervisor Scope Panel")).toBeTruthy();
    expect(screen.getByPlaceholderText(/buscar funcionario/i)).toBeTruthy();
    await waitFor(() => expect(fetchWithAuthMock).toHaveBeenCalledWith("/general?period_id=7"));
  });

  it("combines main search with advanced filters", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          funcionario: "Andrea Pérez",
          title: "Enfermero",
          law_code: "15076 y 19664",
          specialty_sis: "Urgencia",
          hours_per_week: "22 hrs y 11 hrs",
          status: "activo",
          user_id: 1,
          user_ids: [1],
          user_name: "Jorge Medrano",
          is_scheduled: true,
          programmed_label: "Programado",
        },
        {
          funcionario: "Bruno Soto",
          title: "Médico",
          law_code: "15076",
          specialty_sis: "Cardiología",
          hours_per_week: "44 hrs",
          status: "inactivo",
          user_id: 2,
          user_ids: [2],
          user_name: "Paula Rojas",
          is_scheduled: false,
          programmed_label: "No Programado",
        },
      ],
    });

    render(
      <MemoryRouter>
        <General />
      </MemoryRouter>
    );

    expect(await screen.findByText("Andrea Pérez")).toBeTruthy();
    expect(screen.getByText("Bruno Soto")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: /buscar en general/i }), {
      target: { value: "jorge" },
    });
    fireEvent.click(screen.getByRole("button", { name: /mostrar filtros avanzados/i }));
    fireEvent.change(screen.getByPlaceholderText(/filtrar especialidad/i), {
      target: { value: "urgencia" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /filtrar por programación/i }), {
      target: { value: "programado" },
    });

    expect(screen.getByText("Andrea Pérez")).toBeTruthy();
    expect(screen.queryByText("Bruno Soto")).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: /buscar en general/i }), {
      target: { value: "paula" },
    });

    expect(await screen.findByText(/no hay registros que coincidan/i)).toBeTruthy();
  });
});
