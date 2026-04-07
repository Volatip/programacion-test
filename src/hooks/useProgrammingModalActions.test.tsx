import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgrammingModalActions } from "./useProgrammingModalActions";
import { fetchWithAuth } from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
  };
});

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

type HookProps = Parameters<typeof useProgrammingModalActions>[0];

function makeProps(overrides: Partial<HookProps> = {}): HookProps {
  return {
    funcionario: {
      id: 1,
      name: "Funcionario Demo",
      title: "Enfermero",
      rut: "12345678-9",
      law: "19664",
      hours: 44,
      initial: "FD",
      color: "#000000",
      isScheduled: true,
      programmingId: 10,
      groupId: 1,
      sisSpecialty: "Urgencia",
      lunchTime: "60",
      status: "activo",
      holidayDays: 0,
      administrativeDays: 0,
      congressDays: 0,
      breastfeedingTime: 0,
      lastUpdated: "2026-01-01T00:00:00Z",
      observations: "",
    },
    selectedPeriodId: 1,
    selectedCopyFuncionario: null,
    isMedicalOfficial: false,
    programmingId: 10,
    fetchProgramming: vi.fn(),
    removeCachedProgramming: vi.fn(),
    updateOfficialLocally: vi.fn(),
    onClose: vi.fn(),
    setToastConfig: vi.fn(),
    setTimeUnit: vi.fn(),
    setGlobalSpecialty: vi.fn(),
    setSelectedProcess: vi.fn(),
    setSelectedPerformanceUnit: vi.fn(),
    setAssignedGroupId: vi.fn(),
    setActivityEntries: vi.fn(),
    setCopySourceId: vi.fn(),
    ...overrides,
  };
}

function HookHarness(props: HookProps) {
  const { handleDeleteProgramming } = useProgrammingModalActions(props);

  return <button onClick={() => void handleDeleteProgramming()}>Eliminar</button>;
}

describe("useProgrammingModalActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("shows the backend deletion message when the API returns one", async () => {
    const setToastConfig = vi.fn();
    const removeCachedProgramming = vi.fn();
    const updateOfficialLocally = vi.fn();
    const onClose = vi.fn();
    const detail = "No es posible eliminar la programación; solo se puede modificar porque hay dos o más usuarios asociados a este funcionario.";

    fetchWithAuthMock.mockResolvedValue(
      new Response(JSON.stringify({ detail }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <HookHarness
        {...makeProps({
          setToastConfig,
          removeCachedProgramming,
          updateOfficialLocally,
          onClose,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(setToastConfig).toHaveBeenCalledWith({
        isOpen: true,
        type: "error",
        message: detail,
      });
    });

    expect(removeCachedProgramming).not.toHaveBeenCalled();
    expect(updateOfficialLocally).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
