import { describe, expect, it } from "vitest";

import { getRoleLabel, isSupervisorRole } from "./userRoles";

describe("userRoles", () => {
  it("returns the supervisor label", () => {
    expect(getRoleLabel("supervisor")).toBe("Supervisor");
  });

  it("detects supervisor role", () => {
    expect(isSupervisorRole("supervisor")).toBe(true);
    expect(isSupervisorRole("admin")).toBe(false);
  });
});
