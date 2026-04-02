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
    expect(screen.getByRole("link", { name: /funcionarios/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /programación/i })).toBeTruthy();
    expect(screen.queryByText("RRHH")).toBeNull();
    expect(screen.queryByText("Carga")).toBeNull();
    expect(screen.queryByText("Periodos")).toBeNull();
    expect(screen.queryByText("Usuarios")).toBeNull();
  });
});
