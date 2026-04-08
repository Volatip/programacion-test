import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FuncionariosTable } from "./FuncionariosTable";

describe("FuncionariosTable", () => {
  it("highlights active partial commission officials with a dedicated color", () => {
    const onClearFutureDismiss = vi.fn();
    const onClearPartialCommission = vi.fn();
    render(
      <FuncionariosTable
        officials={[
          {
            id: 1,
            name: "Paula Parcial",
            title: "Enfermera",
            rut: "12.345.678-9",
            law: "19.664",
            hours: 44,
            initial: "P",
            color: "bg-blue-600",
            isScheduled: true,
            groupId: 1,
            sisSpecialty: "Urgencia",
            lunchTime: "60 min",
            status: "activo",
            activeStatusLabel: "Comisión de Servicio - Parcial",
            holidayDays: 0,
            administrativeDays: 0,
            congressDays: 0,
            breastfeedingTime: 0,
            lastUpdated: "01/04/2026",
            observations: "",
            contracts: [],
          },
        ]}
        statusFilter="activo"
        isReadOnly={false}
        canManageOfficials={true}
        getContractHoursDisplay={() => "44 hrs"}
        sortState={{ column: "name", direction: "asc" }}
        onSortChange={vi.fn()}
        onActivate={vi.fn()}
        onClearFutureDismiss={onClearFutureDismiss}
        onClearPartialCommission={onClearPartialCommission}
        onDelete={vi.fn()}
      />,
    );

    const badge = screen.getByText("Activo");
    expect(badge.className).toContain("bg-sky-50");
    expect(badge.getAttribute("title")).toBe("Comisión de Servicio - Parcial");

    fireEvent.click(screen.getByRole("button", { name: "Sin comisión" }));
    expect(onClearPartialCommission).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("button", { name: "Quitar baja futura" })).toBeNull();
    expect(onClearFutureDismiss).not.toHaveBeenCalled();
  });

  it("shows the future dismiss removal button only for active officials with a future dismiss", () => {
    const onClearFutureDismiss = vi.fn();

    render(
      <FuncionariosTable
        officials={[
          {
            id: 1,
            name: "Paula Futuro",
            title: "Enfermera",
            rut: "12.345.678-9",
            law: "19.664",
            hours: 44,
            initial: "P",
            color: "bg-blue-600",
            isScheduled: true,
            groupId: 1,
            sisSpecialty: "Urgencia",
            lunchTime: "60 min",
            status: "activo",
            hasFutureDismissScheduled: true,
            futureDismissStartDate: "2026-11-01",
            holidayDays: 0,
            administrativeDays: 0,
            congressDays: 0,
            breastfeedingTime: 0,
            lastUpdated: "01/04/2026",
            observations: "",
            contracts: [],
          },
          {
            id: 2,
            name: "Paula Efectiva",
            title: "Enfermera",
            rut: "98.765.432-1",
            law: "19.664",
            hours: 44,
            initial: "P",
            color: "bg-blue-600",
            isScheduled: true,
            groupId: 1,
            sisSpecialty: "Urgencia",
            lunchTime: "60 min",
            status: "inactivo",
            hasFutureDismissScheduled: false,
            holidayDays: 0,
            administrativeDays: 0,
            congressDays: 0,
            breastfeedingTime: 0,
            lastUpdated: "01/04/2026",
            observations: "",
            contracts: [],
          },
        ]}
        statusFilter="activo"
        isReadOnly={false}
        canManageOfficials={true}
        getContractHoursDisplay={() => "44 hrs"}
        sortState={{ column: "name", direction: "asc" }}
        onSortChange={vi.fn()}
        onActivate={vi.fn()}
        onClearFutureDismiss={onClearFutureDismiss}
        onClearPartialCommission={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quitar baja futura" }));
    expect(onClearFutureDismiss).toHaveBeenCalledWith(1);
    expect(screen.getAllByRole("button", { name: "Eliminar" })).toHaveLength(1);
  });
});
