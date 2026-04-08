import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Users } from "./Users";

const fetchWithAuthMock = vi.fn();
const buildApiUrlMock = vi.fn((path: string) => path);

vi.mock("../lib/api", () => ({
  buildApiUrl: (...args: unknown[]) => buildApiUrlMock(...args),
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock("../components/contextual-help/ContextualHelpButton", () => ({
  ContextualHelpButton: () => <div>Help usuarios</div>,
}));

vi.mock("../components/users/UserFormModal", () => ({
  UserFormModal: () => null,
}));

vi.mock("../components/users/UsersFloatingMenu", () => ({
  UsersFloatingMenu: () => null,
}));

describe("Users page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 1,
          name: "Zoe Admin",
          rut: "11.111.111-1",
          email: "zoe@example.com",
          role: "admin",
          status: "inactivo",
          last_access: "2026-04-08T10:30:00Z",
        },
        {
          id: 2,
          name: "Ana User",
          rut: "22.222.222-2",
          email: "ana@example.com",
          role: "user",
          status: "activo",
          last_access: "2026-04-08T08:00:00Z",
        },
        {
          id: 3,
          name: "Bruno Supervisor",
          rut: "33.333.333-3",
          email: "bruno@example.com",
          role: "supervisor",
          status: "activo",
          last_access: "2026-04-08T09:00:00Z",
        },
      ],
    });
  });

  it("sorts users by column and toggles direction", async () => {
    const { container } = render(<Users />);

    await waitFor(() => expect(fetchWithAuthMock).toHaveBeenCalledWith("/users"));
    await screen.findByText("Ana User");

    const getVisibleNames = () =>
      Array.from(container.querySelectorAll("tbody tr td:first-child span.font-medium"))
        .map((element) => element.textContent)
        .filter(Boolean);

    expect(getVisibleNames()).toEqual(["Ana User", "Bruno Supervisor", "Zoe Admin"]);

    fireEvent.click(screen.getByRole("button", { name: /ordenar por estado/i }));
    expect(getVisibleNames()).toEqual(["Ana User", "Bruno Supervisor", "Zoe Admin"]);

    fireEvent.click(screen.getByRole("button", { name: /ordenar por estado/i }));
    expect(getVisibleNames()).toEqual(["Zoe Admin", "Ana User", "Bruno Supervisor"]);

    fireEvent.click(screen.getByRole("button", { name: /ordenar por usuario/i }));
    expect(getVisibleNames()).toEqual(["Ana User", "Bruno Supervisor", "Zoe Admin"]);
  });
});
