import { describe, expect, it } from "vitest";

import { isPartialCommissionSelection, type DismissReason } from "./dismissReasons";

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

describe("isPartialCommissionSelection", () => {
  it("uses system_key when configured", () => {
    const reason = makeReason({
      system_key: "comision-servicio",
      name: "Texto editable",
      suboptions: [{ id: 10, system_key: "parcial", name: "Texto editable", description: "", sort_order: 0 }],
    });

    expect(isPartialCommissionSelection(reason, 10)).toBe(true);
  });

  it("keeps legacy name fallback", () => {
    const reason = makeReason({
      name: "Comisión de Servicio",
      suboptions: [{ id: 11, system_key: null, name: "Parcial", description: "", sort_order: 0 }],
    });

    expect(isPartialCommissionSelection(reason, 11)).toBe(true);
  });

  it("does not mark total as partial even with reason system_key", () => {
    const reason = makeReason({
      system_key: "comision-servicio",
      suboptions: [{ id: 12, system_key: "total", name: "Total", description: "", sort_order: 0 }],
    });

    expect(isPartialCommissionSelection(reason, 12)).toBe(false);
  });
});
