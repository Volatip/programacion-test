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

vi.mock("../components/programacion/ProgrammingModal", () => ({
  ProgrammingModal: ({
    funcionario,
    onClose,
    onReviewSaved,
  }: {
    funcionario: { id: number; lunchTime: string; name: string };
    onClose?: () => void;
    onReviewSaved?: (review: { review_status: string; reviewed_at: string; reviewed_by_name: string }) => void;
  }) => (
    <div>
      <div>Modal {funcionario.name} · {funcionario.lunchTime}</div>
      <button
        type="button"
        onClick={() =>
          onReviewSaved?.({
            review_status: "validated",
            reviewed_at: "2026-04-10T13:11:54-04:00",
            reviewed_by_name: "Revisor2",
          })
        }
      >
        Simular revisión
      </button>
      <button type="button" onClick={onClose}>
        Cerrar modal
      </button>
    </div>
  ),
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
          funcionario_id: 1,
          funcionario: "Andrea Pérez",
          rut: "11.111.111-1",
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
          review_status: "validated",
          reviewed_at: "2026-12-10T09:00:00Z",
          reviewed_by_name: "Rita Revisor",
          contracts: [],
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
    expect(screen.getByText("Validado")).toBeTruthy();
    expect(screen.getByText(/Rita Revisor/i)).toBeTruthy();
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

  it("muestra un estado neutral cuando no existe revisión previa", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          funcionario_id: 8,
          funcionario: "Natalia Neutral",
          rut: "88.888.888-8",
          title: "Enfermera",
          law_code: "15076",
          specialty_sis: "Urgencia",
          hours_per_week: "44 hrs",
          status: "activo",
          user_id: 8,
          user_ids: [8],
          user_name: "Paula Ramos",
          is_scheduled: false,
          programmed_label: "No Programado",
          review_status: null,
          reviewed_at: null,
          reviewed_by_name: null,
          contracts: [],
        },
      ],
    });

    render(
      <MemoryRouter>
        <General />
      </MemoryRouter>
    );

    expect(await screen.findByText("Natalia Neutral")).toBeTruthy();
    expect(screen.getByText("Sin revisión")).toBeTruthy();
    expect(screen.getByText("Pendiente")).toBeTruthy();
  });

  it("muestra Pendiente cuando la programación vuelve a revisión", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          funcionario_id: 9,
          funcionario: "Patricia Pendiente",
          rut: "99.999.999-9",
          title: "Enfermera",
          law_code: "15076",
          specialty_sis: "Urgencia",
          hours_per_week: "44 hrs",
          status: "activo",
          user_id: 9,
          user_ids: [9],
          user_name: "Paula Ramos",
          is_scheduled: true,
          programmed_label: "Programado",
          review_status: "pending",
          reviewed_at: null,
          reviewed_by_name: null,
          contracts: [],
        },
      ],
    });

    render(
      <MemoryRouter>
        <General />
      </MemoryRouter>
    );

    expect(await screen.findByText("Patricia Pendiente")).toBeTruthy();
    expect(screen.getAllByText("Pendiente").length).toBeGreaterThan(0);
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

  it("incluye Revisión en filtros avanzados", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          funcionario_id: 1,
          funcionario: "Andrea Pérez",
          rut: "11.111.111-1",
          title: "Enfermero",
          law_code: "15076",
          specialty_sis: "Urgencia",
          hours_per_week: "44 hrs",
          status: "activo",
          user_id: 1,
          user_ids: [1],
          user_name: "Jorge Medrano",
          is_scheduled: true,
          programmed_label: "Programado",
          review_status: "validated",
          reviewed_at: "2026-12-10T09:00:00Z",
          reviewed_by_name: "Rita Revisor",
          contracts: [],
        },
        {
          funcionario_id: 2,
          funcionario: "Bruno Soto",
          rut: "22.222.222-2",
          title: "Médico",
          law_code: "19664",
          specialty_sis: "Cardiología",
          hours_per_week: "22 hrs",
          status: "activo",
          user_id: 2,
          user_ids: [2],
          user_name: "Paula Rojas",
          is_scheduled: true,
          programmed_label: "Programado",
          review_status: null,
          reviewed_at: null,
          reviewed_by_name: null,
          contracts: [],
        },
      ],
    });

    render(
      <MemoryRouter>
        <General />
      </MemoryRouter>
    );

    expect(await screen.findByText("Andrea Pérez")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /mostrar filtros avanzados/i }));
    fireEvent.change(screen.getByRole("combobox", { name: /filtrar por revisión/i }), {
      target: { value: "validated" },
    });

    expect(screen.getByText("Andrea Pérez")).toBeTruthy();
    expect(screen.queryByText("Bruno Soto")).toBeNull();
  });

  it("sorts rows by hours and toggles the direction", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          funcionario_id: 1,
          funcionario: "Carlos Vega",
          rut: "11.111.111-1",
          title: "Enfermero",
          law_code: "15076",
          specialty_sis: "Urgencia",
          hours_per_week: "44 hrs",
          status: "activo",
          user_id: 1,
          user_ids: [1],
          user_name: "Usuario Zeta",
          is_scheduled: true,
          programmed_label: "Programado",
          contracts: [],
        },
        {
          funcionario_id: 2,
          funcionario: "Ana Soto",
          rut: "22.222.222-2",
          title: "Médico",
          law_code: "19664",
          specialty_sis: "Pediatría",
          hours_per_week: "11 hrs y 11 hrs",
          status: "activo",
          user_id: 2,
          user_ids: [2],
          user_name: "Usuario Alfa",
          is_scheduled: false,
          programmed_label: "No Programado",
          contracts: [],
        },
        {
          funcionario_id: 3,
          funcionario: "Bruno Díaz",
          rut: "33.333.333-3",
          title: "Matrona",
          law_code: "15076 y 19664",
          specialty_sis: "Cardiología",
          hours_per_week: "33 hrs",
          status: "inactivo",
          user_id: 3,
          user_ids: [3],
          user_name: "Usuario Beta",
          is_scheduled: true,
          programmed_label: "Programado",
          contracts: [],
        },
      ],
    });

    const { container } = render(
      <MemoryRouter>
        <General />
      </MemoryRouter>
    );

    await screen.findByText("Ana Soto");

    const getVisibleNames = () =>
      Array.from(container.querySelectorAll("tbody tr button"))
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

  it("ordena por revisión usando el mismo patrón de encabezados", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          funcionario_id: 1,
          funcionario: "Carlos Vega",
          rut: "11.111.111-1",
          title: "Enfermero",
          law_code: "15076",
          specialty_sis: "Urgencia",
          hours_per_week: "44 hrs",
          status: "activo",
          user_id: 1,
          user_ids: [1],
          user_name: "Usuario Zeta",
          is_scheduled: true,
          programmed_label: "Programado",
          review_status: "validated",
          reviewed_at: "2026-12-12T09:00:00Z",
          reviewed_by_name: "Revisor C",
          contracts: [],
        },
        {
          funcionario_id: 2,
          funcionario: "Ana Soto",
          rut: "22.222.222-2",
          title: "Médico",
          law_code: "19664",
          specialty_sis: "Pediatría",
          hours_per_week: "11 hrs",
          status: "activo",
          user_id: 2,
          user_ids: [2],
          user_name: "Usuario Alfa",
          is_scheduled: false,
          programmed_label: "No Programado",
          review_status: null,
          reviewed_at: null,
          reviewed_by_name: null,
          contracts: [],
        },
        {
          funcionario_id: 3,
          funcionario: "Bruno Díaz",
          rut: "33.333.333-3",
          title: "Matrona",
          law_code: "15076 y 19664",
          specialty_sis: "Cardiología",
          hours_per_week: "33 hrs",
          status: "inactivo",
          user_id: 3,
          user_ids: [3],
          user_name: "Usuario Beta",
          is_scheduled: true,
          programmed_label: "Programado",
          review_status: "fix_required",
          reviewed_at: "2026-12-11T09:00:00Z",
          reviewed_by_name: "Revisor B",
          contracts: [],
        },
      ],
    });

    const { container } = render(
      <MemoryRouter>
        <General />
      </MemoryRouter>
    );

    await screen.findByText("Ana Soto");

    const getVisibleNames = () =>
      Array.from(container.querySelectorAll("tbody tr button"))
        .map((element) => element.textContent)
        .filter(Boolean);

    fireEvent.click(screen.getByRole("button", { name: /ordenar por revisión/i }));
    expect(getVisibleNames()).toEqual(["Ana Soto", "Bruno Díaz", "Carlos Vega"]);

    fireEvent.click(screen.getByRole("button", { name: /ordenar por revisión/i }));
    expect(getVisibleNames()).toEqual(["Carlos Vega", "Bruno Díaz", "Ana Soto"]);
  });

  it("actualiza la revisión en la tabla al cerrar el modal sin recargar la página", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          funcionario_id: 15,
          funcionario: "Valeria Acuña",
          rut: "15.555.555-5",
          title: "Enfermera",
          law_code: "19664",
          specialty_sis: "Urgencia",
          hours_per_week: "44 hrs",
          lunch_time_minutes: 150,
          status: "activo",
          user_id: 1,
          user_ids: [1],
          user_name: "Admin Local",
          is_scheduled: true,
          programmed_label: "Programado",
          review_status: null,
          reviewed_at: null,
          reviewed_by_name: null,
          contracts: [],
        },
      ],
    });

    render(
      <MemoryRouter>
        <General />
      </MemoryRouter>
    );

    const rowButton = await screen.findByRole("button", { name: /valeria acuña/i });
    fireEvent.click(rowButton);
    fireEvent.click(screen.getByRole("button", { name: /simular revisión/i }));
    fireEvent.click(screen.getByRole("button", { name: /cerrar modal/i }));

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Validado")).toBeTruthy();
    expect(screen.getByText("Revisor2")).toBeTruthy();
  });

  it("passes consolidated lunch minutes to the programming modal", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          funcionario_id: 15,
          funcionario: "Valeria Acuña",
          rut: "15.555.555-5",
          title: "Enfermera",
          law_code: "19664",
          specialty_sis: "Urgencia",
          hours_per_week: "44 hrs",
          lunch_time_minutes: 150,
          status: "activo",
          user_id: 1,
          user_ids: [1],
          user_name: "Admin Local",
          is_scheduled: true,
          programmed_label: "Programado",
          contracts: [],
        },
      ],
    });

    render(
      <MemoryRouter>
        <General />
      </MemoryRouter>
    );

    const rowButton = await screen.findByRole("button", { name: /valeria acuña/i });
    fireEvent.click(rowButton);

    expect(await screen.findByText("Modal Valeria Acuña · 150 min")).toBeTruthy();
  });
});
