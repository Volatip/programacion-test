import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FuncionariosModals } from "./FuncionariosModals";

describe("FuncionariosModals", () => {
  it("requires selecting a suboption when the reason has configured suboptions", () => {
    const setDismissReasonId = vi.fn();
    const setDismissSuboptionId = vi.fn();

    render(
      <FuncionariosModals
        isActivateModalOpen={false}
        setIsActivateModalOpen={vi.fn()}
        isProcessingActivation={false}
        handleConfirmActivate={vi.fn(async () => {})}
        isDismissModalOpen
        setIsDismissModalOpen={vi.fn()}
        isProcessingDismiss={false}
        dismissReasons={[
          {
            id: 1,
            name: "Comisión de Servicio",
            description: "Configurada",
            action_type: "dismiss",
            reason_category: "mobility",
            sort_order: 10,
            is_active: true,
            suboptions: [
              { id: 11, name: "Total", description: "Todo el período", sort_order: 10 },
              { id: 12, name: "Parcial", description: "Parte del período", sort_order: 20 },
            ],
          },
        ]}
        isLoadingDismissReasons={false}
        dismissReasonId={1}
        setDismissReasonId={setDismissReasonId}
        dismissSuboptionId={null}
        setDismissSuboptionId={setDismissSuboptionId}
        setShowConfirmHardDelete={vi.fn()}
        setDismissError={vi.fn()}
        dismissError=""
        showConfirmHardDelete={false}
        selectedDismissReason={{
          id: 1,
          name: "Comisión de Servicio",
          description: "Configurada",
          action_type: "dismiss",
          reason_category: "mobility",
          sort_order: 10,
          is_active: true,
          suboptions: [
            { id: 11, name: "Total", description: "Todo el período", sort_order: 10 },
            { id: 12, name: "Parcial", description: "Parte del período", sort_order: 20 },
          ],
        }}
        handleConfirmDismiss={vi.fn(async () => {})}
        isAddOfficialModalOpen={false}
        setIsAddOfficialModalOpen={vi.fn()}
        addOfficialSearchQuery=""
        setAddOfficialSearchQuery={vi.fn()}
        isSearching={false}
        searchResults={[]}
        handleAddOfficial={vi.fn()}
        normalizeRutInput={(value) => value}
        toastOpen={false}
        toastMessage=""
        toastType="info"
        setToastOpen={vi.fn()}
      />
    );

    expect(screen.getByText(/subopción obligatoria/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /confirmar baja/i }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /total/i }));

    expect(setDismissSuboptionId).toHaveBeenCalledWith(11);
  });
});
