// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveViteBase } from "./vite.config";

describe("resolveViteBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses root base during local serve", () => {
    vi.stubEnv("VITE_APP_BASE_PATH", "/programacion");

    expect(resolveViteBase("serve", "development")).toBe("/");
  });

  it("uses explicit app base path during build", () => {
    vi.stubEnv("VITE_APP_BASE_PATH", "/programacion");

    expect(resolveViteBase("build", "production")).toBe("/programacion/");
  });

  it("infers app base path from API base path during build", () => {
    vi.stubEnv("VITE_API_BASE_PATH", "/programacion/api");

    expect(resolveViteBase("build", "production")).toBe("/programacion/");
  });

  it("falls back to /programacion/ when no base env is configured", () => {
    expect(resolveViteBase("build", "production")).toBe("/programacion/");
  });
});
