import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Programacion } from "./Programacion";
import { ProgramacionGrupo } from "./ProgramacionGrupo";
import { ProgramacionLista } from "./ProgramacionLista";

const useAuthMock = vi.fn();
const usePeriodsMock = vi.fn();
const useSupervisorScopeMock = vi.fn();
const useOfficialsMock = vi.fn();
const useProgrammingClassificationMock = vi.fn();

vi.mock("../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../context/PeriodsContext", () => ({
  usePeriods: () => usePeriodsMock(),
}));

vi.mock("../context/SupervisorScopeContext", () => ({
  useSupervisorScope: () => useSupervisorScopeMock(),
}));

vi.mock("../context/OfficialsContext", () => ({
  useOfficials: () => useOfficialsMock(),
}));

vi.mock("../hooks/useProgrammingClassification", () => ({
  useProgrammingClassification: () => useProgrammingClassificationMock(),
}));

vi.mock("../components/contextual-help/ContextualHelpButton", () => ({
  ContextualHelpButton: ({ slug }: { slug: string }) => <div>Help: {slug}</div>,
}));

vi.mock("../components/supervisor/SupervisorScopePanel", () => ({
  SupervisorScopePanel: () => <div>Supervisor Scope Panel</div>,
}));

vi.mock("../components/ui/PageHeader", () => ({
  PageHeader: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("../components/programacion/ProgrammingGroupModals", () => ({
  ProgrammingGroupModals: () => <div>Programming Group Modals</div>,
}));

vi.mock("../components/programacion/ProgrammingGroupsPanel", () => ({
  ProgrammingGroupsPanel: () => <div>Programming Groups Panel</div>,
}));

vi.mock("../components/programacion/ProgrammingStatusSummary", () => ({
  ProgrammingStatusSummary: () => <div>Programming Status Summary</div>,
}));

vi.mock("../components/programacion/ProgrammingGroupHeader", () => ({
  ProgrammingGroupHeader: ({ groupName }: { groupName: string }) => <div>{groupName}</div>,
}));

vi.mock("../components/programacion/ProgrammingGroupOfficialsList", () => ({
  ProgrammingGroupOfficialsList: ({ officials }: { officials: Array<{ name: string }> }) => (
    <div>{officials.map((official) => official.name).join(",")}</div>
  ),
}));

vi.mock("../components/programacion/AddOfficialToGroupModal", () => ({
  AddOfficialToGroupModal: () => null,
}));

vi.mock("../components/programacion/ProgrammingModal", () => ({
  ProgrammingModal: ({ funcionario }: { funcionario: { name: string } }) => <div>Modal {funcionario.name}</div>,
}));

const officialInGroup = {
  id: 1,
  name: "Pablo Merino",
  title: "Enfermero",
  rut: "12.345.678-9",
  law: "15076",
  hours: 44,
  initial: "PM",
  color: "bg-blue-600",
  isScheduled: true,
  programmingId: 101,
  groupId: 7,
  sisSpecialty: "Urgencia",
  lunchTime: "60 min",
  status: "activo",
  holidayDays: 0,
  administrativeDays: 0,
  congressDays: 0,
  breastfeedingTime: 0,
  lastUpdated: "2026-04-13",
  observations: "",
  contracts: [],
};

const unscheduledOfficial = {
  ...officialInGroup,
  id: 2,
  name: "Andrea Soto",
  rut: "98.765.432-1",
  groupId: 0,
  isScheduled: false,
  programmingId: undefined,
};

describe("Programación search flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { role: "admin" } });
    usePeriodsMock.mockReturnValue({ isReadOnly: false });
    useSupervisorScopeMock.mockReturnValue({ isSupervisor: false, isScopeReady: true });
    useProgrammingClassificationMock.mockReturnValue({
      scheduledFuncionarios: [officialInGroup],
      unscheduledFuncionarios: [unscheduledOfficial],
      isProgrammed: (official: { isScheduled: boolean }) => official.isScheduled,
    });
    useOfficialsMock.mockReturnValue({
      officials: [officialInGroup, unscheduledOfficial],
      groups: [{ id: 7, name: "Urgencia", count: 1 }],
      addGroup: vi.fn(),
      updateGroup: vi.fn(),
      removeGroup: vi.fn(),
      assignToGroup: vi.fn(),
    });
  });

  it("filtra por nombre flexible y navega con estado al grupo", async () => {
    render(
      <MemoryRouter initialEntries={["/programacion"]}>
        <Routes>
          <Route path="/programacion" element={<Programacion />} />
          <Route path="/programacion/grupo/:groupId" element={<ProgramacionGrupo />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/buscar funcionario en programación/i), {
      target: { value: "merino pablo" },
    });

    fireEvent.click(await screen.findByRole("button", { name: /pablo merino/i }));

    expect(await screen.findByText("Modal Pablo Merino")).toBeTruthy();
  });

  it("encuentra por RUT sin guion y abre el modal en no programados", async () => {
    render(
      <MemoryRouter initialEntries={["/programacion"]}>
        <Routes>
          <Route path="/programacion" element={<Programacion />} />
          <Route path="/programacion/no-programados" element={<ProgramacionLista type="unscheduled" />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/buscar funcionario en programación/i), {
      target: { value: "987654321" },
    });

    fireEvent.click(await screen.findByRole("button", { name: /andrea soto/i }));

    expect(await screen.findByText("Modal Andrea Soto")).toBeTruthy();
  });
});
