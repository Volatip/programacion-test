import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "./Sidebar";

const useAuthMock = vi.fn();

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows only allowed navigation for supervisor", () => {
    useAuthMock.mockReturnValue({ user: { role: "supervisor" } });

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /inicio/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /estadísticas/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /funcionarios/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /general/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /programación/i })).toBeTruthy();
    expect(screen.queryByText("RRHH")).toBeNull();
    expect(screen.queryByText("Carga")).toBeNull();
    expect(screen.queryByText("Bajas")).toBeNull();
    expect(screen.queryByText("Correo")).toBeNull();
    expect(screen.queryByText("Periodos")).toBeNull();
    expect(screen.queryByText("Usuarios")).toBeNull();
  });

  it("places statistics after general", () => {
    useAuthMock.mockReturnValue({ user: { role: "supervisor" } });

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    const links = screen.getAllByRole("link");
    const generalIndex = links.findIndex((link) => link.textContent?.match(/general/i));
    const estadisticasIndex = links.findIndex((link) => link.textContent?.match(/estadísticas/i));

    expect(generalIndex).toBeGreaterThanOrEqual(0);
    expect(estadisticasIndex).toBe(generalIndex + 1);
  });

  it("shows bajas link for admin", () => {
    useAuthMock.mockReturnValue({ user: { role: "admin" } });

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /bajas/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /correo/i })).toBeTruthy();
  });
});
