import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAddOfficialToGroupModal } from "./useAddOfficialToGroupModal";
import type { Funcionario, Group } from "../context/OfficialsContextDefs";

type HookProps = Parameters<typeof useAddOfficialToGroupModal>[0];

const officials: Funcionario[] = [
  {
    id: 1,
    name: "Jorge Medrano",
    title: "Enfermero",
    rut: "12345678-9",
    law: "18834",
    hours: 44,
    initial: "J",
    color: "bg-blue-600",
    isScheduled: false,
    groupId: 0,
    sisSpecialty: "Urgencia",
    lunchTime: "60 min",
    status: "activo",
    holidayDays: 0,
    administrativeDays: 0,
    congressDays: 0,
    breastfeedingTime: 0,
    lastUpdated: "2026-04-07",
    observations: "",
  },
];

const groups: Group[] = [{ id: 10, name: "Grupo A", count: 0 }];

function makeProps(overrides: Partial<HookProps> = {}): HookProps {
  return {
    isOpen: true,
    officials,
    groups,
    groupId: 10,
    assignToGroup: vi.fn(async () => {}),
    ...overrides,
  };
}

function HookHarness(props: HookProps) {
  const { handleAdd, addedCount, feedback } = useAddOfficialToGroupModal(props);

  return (
    <>
      <button onClick={() => void handleAdd(officials[0])}>Añadir</button>
      <div data-testid="added-count">{addedCount}</div>
      <div data-testid="feedback-type">{feedback?.type ?? "none"}</div>
      <div data-testid="feedback-message">{feedback?.message ?? ""}</div>
    </>
  );
}

describe("useAddOfficialToGroupModal", () => {
  it("marca éxito solo cuando assignToGroup resuelve correctamente", async () => {
    const assignToGroup = vi.fn(async () => {});

    render(<HookHarness {...makeProps({ assignToGroup })} />);

    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));

    await waitFor(() => expect(screen.getByTestId("added-count").textContent).toBe("1"));
    expect(screen.getByTestId("feedback-type").textContent).toBe("success");
    expect(screen.getByTestId("feedback-message").textContent).toBe("Funcionario añadido correctamente");
    expect(assignToGroup).toHaveBeenCalledWith(1, 10);
  });

  it("no marca agregado exitoso cuando assignToGroup falla", async () => {
    const assignToGroup = vi.fn(async () => {
      throw new Error("Binding not found");
    });

    render(<HookHarness {...makeProps({ assignToGroup })} />);

    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));

    await waitFor(() => expect(screen.getByTestId("feedback-type").textContent).toBe("error"));
    expect(screen.getByTestId("added-count").textContent).toBe("0");
    expect(screen.getByTestId("feedback-message").textContent).toBe("Binding not found");
  });
});
