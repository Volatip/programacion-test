import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "./Modal";

describe("Modal", () => {
  it("cierra al presionar Escape", () => {
    const onClose = vi.fn();

    render(
      <Modal isOpen onClose={onClose} title="Prueba">
        <div>Contenido</div>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("resalta el botón cerrar al hacer click fuera", () => {
    render(
      <Modal isOpen onClose={() => undefined} title="Prueba">
        <div>Contenido</div>
      </Modal>,
    );

    const overlay = document.body.lastElementChild as HTMLElement | null;
    const closeButton = screen.getByRole("button", { name: /cerrar modal/i });

    expect(closeButton.className).not.toContain("bg-red-50");
    if (!overlay) {
      throw new Error("Overlay no encontrado");
    }

    fireEvent.click(overlay);

    expect(closeButton.className).toContain("bg-red-50");
  });
});
