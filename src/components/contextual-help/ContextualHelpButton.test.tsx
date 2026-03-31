import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContextualHelpButton } from "./ContextualHelpButton";
import { contextualHelpApi } from "../../lib/contextualHelp";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { role: "admin" },
  }),
}));

vi.mock("../../lib/contextualHelp", async () => {
  const actual = await vi.importActual<typeof import("../../lib/contextualHelp")>("../../lib/contextualHelp");
  return {
    ...actual,
    contextualHelpApi: {
      getBySlug: vi.fn(),
    },
  };
});

describe("ContextualHelpButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and renders contextual help content inside the modal", async () => {
    vi.mocked(contextualHelpApi.getBySlug).mockResolvedValue({
      id: 1,
      slug: "funcionarios",
      page_name: "Funcionarios",
      description: "Descripción general",
      updated_by_name: "Admin",
      sections: [
        { id: 10, position: 1, title: "Filtros", content: "Sirven para acotar el listado." },
      ],
    });

    render(
      <MemoryRouter>
        <ContextualHelpButton slug="funcionarios" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /abrir ayuda contextual/i }));

    await waitFor(() => expect(contextualHelpApi.getBySlug).toHaveBeenCalledWith("funcionarios"));
    expect(await screen.findByText("Ayuda: Funcionarios")).toBeTruthy();
    expect(screen.getByText("Descripción general")).toBeTruthy();
    expect(screen.getByText(/Filtros/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /gestionar ayuda/i }).getAttribute("href")).toBe("/admin/ayudas-contextuales?slug=funcionarios");
  });
});
