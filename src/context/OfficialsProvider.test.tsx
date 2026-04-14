import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { OfficialsProvider } from "./OfficialsProvider";
import { useOfficials } from "./OfficialsContextDefs";
import { fetchWithAuth } from "../lib/api";

const authState = { user: { id: 1, role: "user" } };
const periodsState = { selectedPeriod: { id: 7 } };
const supervisorState = {
  isSupervisor: false,
  isScopeReady: true,
  selectedUserId: null,
};

vi.mock("./AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("./PeriodsContext", () => ({
  usePeriods: () => periodsState,
}));

vi.mock("./SupervisorScopeContext", () => ({
  useSupervisorScope: () => supervisorState,
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
  };
});

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

function Consumer() {
  const { officials, assignToGroup, clearFutureDismiss } = useOfficials();
  const [result, setResult] = useState("idle");

  return (
    <>
      <div data-testid="group-id">{officials[0]?.groupId ?? "none"}</div>
      <div data-testid="future-dismiss">{officials[0]?.hasFutureDismissScheduled ? "yes" : "no"}</div>
      <div data-testid="termination-date">{officials[0]?.terminationDate ?? "none"}</div>
      <div data-testid="result">{result}</div>
      <button
        onClick={async () => {
          try {
            await assignToGroup(1, 3);
            setResult("success");
          } catch (error) {
            setResult(error instanceof Error ? error.message : "unknown-error");
          }
        }}
      >
        Asignar
      </button>
      <button
        onClick={async () => {
          try {
            await clearFutureDismiss(1);
            setResult("future-cleared");
          } catch (error) {
            setResult(error instanceof Error ? error.message : "unknown-error");
          }
        }}
      >
        Quitar baja futura
      </button>
    </>
  );
}

describe("OfficialsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propaga el error HTTP real y no actualiza el estado local en falso positivo", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 1,
              name: "Jorge Medrano",
              title: "Enfermero",
              rut: "12345678",
              dv: "9",
              law_code: "18834",
              hours_per_week: 44,
              group_id: null,
               specialty_sis: "Urgencia",
               lunch_time_minutes: 60,
               status: "activo",
               termination_date: "2026-10-01T00:00:00Z",
               has_future_dismiss_scheduled: true,
               future_dismiss_start_date: "2026-11-01",
              holiday_days: 0,
              administrative_days: 0,
              congress_days: 0,
              breastfeeding_time: 0,
              created_at: "2026-04-07T00:00:00Z",
              observations: "",
              contracts: [],
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 3, name: "Grupo A", count: 0 }]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Binding not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      );

    render(
      <OfficialsProvider>
        <Consumer />
      </OfficialsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("group-id").textContent).toBe("0"));
    expect(screen.getByTestId("future-dismiss").textContent).toBe("yes");
    expect(screen.getByTestId("termination-date").textContent).toBe(new Date("2026-10-01T00:00:00Z").toLocaleDateString());

    fireEvent.click(screen.getByRole("button", { name: "Asignar" }));

    await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("Binding not found"));
    expect(screen.getByTestId("group-id").textContent).toBe("0");
    expect(screen.getByTestId("future-dismiss").textContent).toBe("yes");
  });

  it("limpia el estado local al quitar una baja futura", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 1,
              name: "Jorge Medrano",
              title: "Enfermero",
              rut: "12345678",
              dv: "9",
              law_code: "18834",
              hours_per_week: 44,
              group_id: null,
               specialty_sis: "Urgencia",
               lunch_time_minutes: 60,
               status: "activo",
               termination_date: "2026-10-01T00:00:00Z",
               has_future_dismiss_scheduled: true,
               future_dismiss_start_date: "2026-11-01",
              holiday_days: 0,
              administrative_days: 0,
              congress_days: 0,
              breastfeeding_time: 0,
              created_at: "2026-04-07T00:00:00Z",
              observations: "",
              contracts: [],
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 3, name: "Grupo A", count: 0 }]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Baja futura eliminada correctamente",
            status: "activo",
            has_future_dismiss_scheduled: false,
            future_dismiss_start_date: null,
            active_status_label: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    render(
      <OfficialsProvider>
        <Consumer />
      </OfficialsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("future-dismiss").textContent).toBe("yes"));

    fireEvent.click(screen.getByRole("button", { name: "Quitar baja futura" }));

    await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("future-cleared"));
    expect(screen.getByTestId("future-dismiss").textContent).toBe("no");
  });
});
