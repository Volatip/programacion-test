import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Carga API endpoints", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    window.history.replaceState({}, "", "/programacion/carga");
  });

  it("builds upload and template urls under the mounted /programacion/api base path", async () => {
    vi.stubEnv("VITE_API_ORIGIN", "http://localhost");
    vi.stubEnv("VITE_API_BASE_PATH", "/programacion/api");

    const { buildApiUrl } = await import("../lib/api");
    const { UPLOAD_OPTIONS } = await import("./Carga");

    for (const option of UPLOAD_OPTIONS) {
      expect(option.endpoint.startsWith("/api/")).toBe(false);
      expect(option.templateEndpoint.startsWith("/api/")).toBe(false);
      expect(buildApiUrl(option.endpoint)).toBe(`http://localhost/programacion/api${option.endpoint}`);
      expect(buildApiUrl(option.templateEndpoint)).toBe(`http://localhost/programacion/api${option.templateEndpoint}`);
    }
  });
});
