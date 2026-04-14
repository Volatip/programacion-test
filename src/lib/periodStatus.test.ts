import { describe, expect, it } from "vitest";

import { isActivePeriodForReview } from "./periodStatus";

describe("isActivePeriodForReview", () => {
  it("rechaza períodos históricos", () => {
    expect(isActivePeriodForReview({ status: "ANTIGUO", is_active: false })).toBe(false);
  });

  it("acepta períodos activos por estado", () => {
    expect(isActivePeriodForReview({ status: "ACTIVO", is_active: false })).toBe(true);
  });

  it("mantiene compatibilidad con el flag legacy is_active", () => {
    expect(isActivePeriodForReview({ status: "OCULTO", is_active: true })).toBe(true);
  });
});
