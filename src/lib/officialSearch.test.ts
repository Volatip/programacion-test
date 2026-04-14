import { describe, expect, it } from "vitest";

import { matchesOfficialSearch } from "./officialSearch";

describe("matchesOfficialSearch", () => {
  it("encuentra nombres por palabras en cualquier orden", () => {
    expect(matchesOfficialSearch({ name: "Pablo Merino", rut: "12.345.678-9", query: "merino pablo" })).toBe(true);
    expect(matchesOfficialSearch({ name: "Pablo Merino", rut: "12.345.678-9", query: "pablo merino" })).toBe(true);
  });

  it("encuentra RUT con y sin guion", () => {
    expect(matchesOfficialSearch({ name: "Pablo Merino", rut: "12.345.678-9", query: "123456789" })).toBe(true);
    expect(matchesOfficialSearch({ name: "Pablo Merino", rut: "12.345.678-9", query: "12.345.678-9" })).toBe(true);
  });
});
