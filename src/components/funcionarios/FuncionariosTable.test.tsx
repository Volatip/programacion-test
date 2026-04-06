import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FuncionariosTable } from "./FuncionariosTable";

describe("FuncionariosTable", () => {
  it("highlights active partial commission officials with a dedicated color", () => {
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
        onActivate={vi.fn()}
        onClearPartialCommission={onClearPartialCommission}
        onDelete={vi.fn()}
      />,
    );

    const badge = screen.getByText("Activo");
    expect(badge.className).toContain("bg-sky-50");
    expect(badge.getAttribute("title")).toBe("Comisión de Servicio - Parcial");

    fireEvent.click(screen.getByRole("button", { name: "Sin comisión" }));
    expect(onClearPartialCommission).toHaveBeenCalledWith(1);
  });
});
