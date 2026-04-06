import { describe, expect, it } from "vitest";

import { PARTIAL_COMMISSION_BASE_MESSAGE, validatePartialCommissionBaseForOfficial } from "./partialCommissionValidation";

describe("validatePartialCommissionBaseForOfficial", () => {
  it("returns an error when the official has no base programming", () => {
    expect(validatePartialCommissionBaseForOfficial({ programmingId: undefined })).toBe(PARTIAL_COMMISSION_BASE_MESSAGE);
    expect(validatePartialCommissionBaseForOfficial(null)).toBe(PARTIAL_COMMISSION_BASE_MESSAGE);
  });

  it("allows partial commission when the official already has programming", () => {
    expect(validatePartialCommissionBaseForOfficial({ programmingId: 15 })).toBeNull();
  });
});
