import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DismissReason } from "../../lib/dismissReasons";
import { FuncionariosModals } from "./FuncionariosModals";

function makeReason(overrides: Partial<DismissReason> = {}): DismissReason {
  return {
    id: 1,
    system_key: null,
    name: "Otro motivo",
    description: "",
    action_type: "dismiss",
    reason_category: "other",
    sort_order: 0,
    is_active: true,
    requires_start_date: false,
    suboptions: [],
    ...overrides,
  };
}

function renderModals(selectedDismissReason: DismissReason | null, dismissReasons: DismissReason[] = selectedDismissReason ? [selectedDismissReason] : []) {
  return render(
    <FuncionariosModals
      isActivateModalOpen={false}
      setIsActivateModalOpen={vi.fn()}
      isProcessingActivation={false}
      handleConfirmActivate={vi.fn(async () => {})}
      isDismissModalOpen
      setIsDismissModalOpen={vi.fn()}
      isProcessingDismiss={false}
      dismissReasons={dismissReasons}
      isLoadingDismissReasons={false}
      dismissReasonId={selectedDismissReason?.id ?? null}
      setDismissReasonId={vi.fn()}
      dismissSuboptionId={null}
      setDismissSuboptionId={vi.fn()}
      dismissPartialHours=""
      setDismissPartialHours={vi.fn()}
      dismissStartDate=""
      setDismissStartDate={vi.fn()}
      setShowConfirmHardDelete={vi.fn()}
      setDismissError={vi.fn()}
      dismissError=""
      showConfirmHardDelete={false}
      selectedDismissReason={selectedDismissReason}
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
    />,
  );
}

describe("FuncionariosModals", () => {
  it("requires selecting a suboption when the reason has configured suboptions", () => {
    const setDismissSuboptionId = vi.fn();
    const reason = makeReason({
      system_key: "comision-servicio",
      name: "Comisión de Servicio",
      reason_category: "mobility",
      requires_start_date: true,
      suboptions: [
        { id: 11, system_key: "total", name: "Total", description: "Todo el período", sort_order: 10 },
        { id: 12, system_key: "parcial", name: "Parcial", description: "Parte del período", sort_order: 20 },
      ],
    });

    render(
      <FuncionariosModals
        isActivateModalOpen={false}
        setIsActivateModalOpen={vi.fn()}
        isProcessingActivation={false}
        handleConfirmActivate={vi.fn(async () => {})}
        isDismissModalOpen
        setIsDismissModalOpen={vi.fn()}
        isProcessingDismiss={false}
        dismissReasons={[reason]}
        isLoadingDismissReasons={false}
        dismissReasonId={1}
        setDismissReasonId={vi.fn()}
        dismissSuboptionId={null}
        setDismissSuboptionId={setDismissSuboptionId}
        dismissPartialHours=""
        setDismissPartialHours={vi.fn()}
        dismissStartDate=""
        setDismissStartDate={vi.fn()}
        setShowConfirmHardDelete={vi.fn()}
        setDismissError={vi.fn()}
        dismissError=""
        showConfirmHardDelete={false}
        selectedDismissReason={reason}
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
      />,
    );

    expect(screen.getByText(/subopción obligatoria/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /confirmar baja/i }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /total/i }));

    expect(setDismissSuboptionId).toHaveBeenCalledWith(11);
  });

  it("shows numeric partial hours input for comisión de servicio parcial", () => {
    const reason = makeReason({
      system_key: "comision-servicio",
      name: "Comisión de Servicio",
      reason_category: "mobility",
      requires_start_date: true,
      suboptions: [
        { id: 11, system_key: "total", name: "Total", description: "Todo el período", sort_order: 10 },
        { id: 12, system_key: "parcial", name: "Parcial", description: "Parte del período", sort_order: 20 },
      ],
    });

    render(
      <FuncionariosModals
        isActivateModalOpen={false}
        setIsActivateModalOpen={vi.fn()}
        isProcessingActivation={false}
        handleConfirmActivate={vi.fn(async () => {})}
        isDismissModalOpen
        setIsDismissModalOpen={vi.fn()}
        isProcessingDismiss={false}
        dismissReasons={[reason]}
        isLoadingDismissReasons={false}
        dismissReasonId={1}
        setDismissReasonId={vi.fn()}
        dismissSuboptionId={12}
        setDismissSuboptionId={vi.fn()}
        dismissPartialHours="4"
        setDismissPartialHours={vi.fn()}
        dismissStartDate="2026-10-01"
        setDismissStartDate={vi.fn()}
        setShowConfirmHardDelete={vi.fn()}
        setDismissError={vi.fn()}
        dismissError=""
        showConfirmHardDelete={false}
        selectedDismissReason={reason}
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
      />,
    );

    expect(screen.getByLabelText(/horas de comisión parcial/i)).toBeTruthy();
    expect(screen.getByDisplayValue("4")).toBeTruthy();
  });

  it("shows and hides start date input based on reason configuration", () => {
    const requiringReason = makeReason({
      id: 1,
      name: "Renuncia",
      reason_category: "resignation",
      requires_start_date: true,
    });
    const optionalReason = makeReason({
      id: 2,
      system_key: "agregado-error",
      name: "Agregado por Error",
      action_type: "hide",
      requires_start_date: false,
    });

    const { rerender } = renderModals(requiringReason);
    expect(screen.getByLabelText(/fecha de inicio de la baja/i)).toBeTruthy();

    rerender(
      <FuncionariosModals
        isActivateModalOpen={false}
        setIsActivateModalOpen={vi.fn()}
        isProcessingActivation={false}
        handleConfirmActivate={vi.fn(async () => {})}
        isDismissModalOpen
        setIsDismissModalOpen={vi.fn()}
        isProcessingDismiss={false}
        dismissReasons={[optionalReason]}
        isLoadingDismissReasons={false}
        dismissReasonId={2}
        setDismissReasonId={vi.fn()}
        dismissSuboptionId={null}
        setDismissSuboptionId={vi.fn()}
        dismissPartialHours=""
        setDismissPartialHours={vi.fn()}
        dismissStartDate=""
        setDismissStartDate={vi.fn()}
        setShowConfirmHardDelete={vi.fn()}
        setDismissError={vi.fn()}
        dismissError=""
        showConfirmHardDelete={false}
        selectedDismissReason={optionalReason}
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
      />,
    );

    expect(screen.queryByLabelText(/fecha de inicio de la baja/i)).toBeNull();
  });

  it('does not require start date for "Agregado por Error"', () => {
    const reason = makeReason({
      id: 6,
      system_key: "agregado-error",
      name: "Agregado por Error",
      action_type: "hide",
      requires_start_date: false,
    });

    renderModals(reason);

    expect(screen.queryByLabelText(/fecha de inicio de la baja/i)).toBeNull();
    expect(screen.getByRole("button", { name: /confirmar baja/i }).hasAttribute("disabled")).toBe(false);
  });
});
