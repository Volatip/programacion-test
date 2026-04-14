import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomeTimelineSection } from "./HomeTimelineSection";
import { DEFAULT_HOME_TIMELINE_SECTION } from "../../lib/homeTimeline";

const appConfigReadMock = vi.fn();
const appConfigUpsertMock = vi.fn();
const parseJsonResponseMock = vi.fn();
const parseErrorDetailMock = vi.fn();

vi.mock("../../lib/api", () => ({
  appConfigApi: {
    read: (...args: unknown[]) => appConfigReadMock(...args),
    upsert: (...args: unknown[]) => appConfigUpsertMock(...args),
  },
  parseJsonResponse: (...args: unknown[]) => parseJsonResponseMock(...args),
  parseErrorDetail: (...args: unknown[]) => parseErrorDetailMock(...args),
}));

vi.mock("../contextual-help/ContextualHelpButton", () => ({
  ContextualHelpButton: () => <div>Help home</div>,
}));

describe("HomeTimelineSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseErrorDetailMock.mockResolvedValue("Error");
  });

  it("muestra hitos guardados y oculta edición para roles no admin", async () => {
    appConfigReadMock.mockResolvedValue({ ok: true, status: 200 });
    parseJsonResponseMock.mockResolvedValue({
      key: "home_timeline",
      value: JSON.stringify({
        section: {
          title: "Línea de tiempo operativa",
          subtitle: "Hitos clave",
          description: "Seguimiento resumido del flujo.",
        },
        milestones: [
          { id: "1", title: "Carga base", date: "Abr 2026", description: "Datos iniciales", color: "indigo" },
          { id: "2", title: "Validación final", date: "May 2026", description: "Cierre", color: "emerald" },
        ],
      }),
    });

    render(<HomeTimelineSection role="supervisor" />);

    expect(await screen.findByText("Línea de tiempo operativa")).toBeTruthy();
    expect(screen.getByText("Hitos clave")).toBeTruthy();
    expect(screen.getByText("Seguimiento resumido del flujo.")).toBeTruthy();
    expect(await screen.findByText("Carga base")).toBeTruthy();
    expect(screen.getByText("Validación final")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /editar timeline/i })).toBeNull();
    expect(screen.queryByLabelText(/título principal/i)).toBeNull();
  });

  it("permite al admin editar y guardar textos de sección y hitos", async () => {
    appConfigReadMock.mockResolvedValue({ ok: true, status: 200 });
    parseJsonResponseMock.mockResolvedValue({
      key: "home_timeline",
      value: JSON.stringify({
        section: DEFAULT_HOME_TIMELINE_SECTION,
        milestones: [{ id: "1", title: "Carga base", date: "Abr 2026", description: "Datos iniciales", color: "indigo" }],
      }),
    });
    appConfigUpsertMock.mockResolvedValue({ ok: true, status: 200 });

    render(<HomeTimelineSection role="admin" />);

    await screen.findByText("Carga base");

    fireEvent.click(screen.getByRole("button", { name: /editar timeline/i }));
    fireEvent.change(screen.getAllByLabelText(/título principal/i)[0], { target: { value: "Timeline editable" } });
    fireEvent.change(screen.getAllByLabelText(/subtítulo \/ etiqueta/i)[0], { target: { value: "Proceso mensual" } });
    fireEvent.change(screen.getAllByLabelText(/descripción de la sección/i)[0], { target: { value: "Vista horizontal del proceso." } });
    fireEvent.change(screen.getByLabelText(/^título$/i), { target: { value: "Carga consolidada" } });
    fireEvent.change(screen.getByLabelText(/^fecha$/i), { target: { value: "Jun 2026" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar línea de tiempo/i }));

    await waitFor(() => expect(appConfigUpsertMock).toHaveBeenCalledTimes(1));

    const savedPayload = appConfigUpsertMock.mock.calls[0]?.[0];
    const savedValue = JSON.parse(savedPayload.value as string);

    expect(savedPayload).toMatchObject({
      key: "home_timeline",
      description: "Línea de tiempo editable de la página Inicio",
    });
    expect(savedValue.section).toMatchObject({
      title: "Timeline editable",
      subtitle: "Proceso mensual",
      description: "Vista horizontal del proceso.",
    });
    expect(savedValue.milestones[0]).toMatchObject({
      title: "Carga consolidada",
      date: "Jun 2026",
    });

    expect(await screen.findByText(/línea de tiempo guardada/i)).toBeTruthy();
    expect(screen.getByText("Timeline editable")).toBeTruthy();
    expect(screen.getByText("Proceso mensual")).toBeTruthy();
  });
});
