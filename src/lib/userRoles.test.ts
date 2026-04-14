import { describe, expect, it } from "vitest";

import { getRoleLabel, isReadOnlyRole, isReviewerRole, isSupervisorRole } from "./userRoles";

describe("userRoles", () => {
  it("returns the supervisor label", () => {
    expect(getRoleLabel("supervisor")).toBe("Supervisor");
  });

  it("detects supervisor role", () => {
    expect(isSupervisorRole("supervisor")).toBe(true);
    expect(isSupervisorRole("admin")).toBe(false);
  });

  it("detects reviewer as read-only role", () => {
    expect(getRoleLabel("revisor")).toBe("Revisor");
    expect(isReviewerRole("revisor")).toBe(true);
    expect(isReadOnlyRole("revisor")).toBe(true);
  });
});
