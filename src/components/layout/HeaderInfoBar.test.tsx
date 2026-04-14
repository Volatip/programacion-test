import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeaderInfoBar } from "./HeaderInfoBar";

describe("HeaderInfoBar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renderiza segmentos coloreados y contador de días", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T09:00:00"));

    render(
      <HeaderInfoBar
        infoConfig={{
          version: 1,
          segments: [
            { id: "1", text: "¡Bienvenido!", color: "default" },
            { id: "2", text: "Proceso actualizado", color: "emerald" },
          ],
          countdown: {
            enabled: true,
            targetDate: "2026-04-20",
            prefix: "Quedan",
            suffix: "días para cerrar",
            color: "amber",
          },
        }}
        isAdmin={true}
        isInfoVisible={true}
        openEditModal={() => undefined}
        toggleInfoVisibility={() => undefined}
      />
    );

    expect(screen.getByText("¡Bienvenido!")).toBeInTheDocument();
    expect(screen.getByText("Proceso actualizado")).toBeInTheDocument();
    expect(screen.getByText("Quedan 6 días para cerrar")).toBeInTheDocument();
  });
});
