import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PageHeader } from "./PageHeader";

const useAuthMock = vi.fn();
const readConfigMock = vi.fn();
const upsertConfigMock = vi.fn();
const parseJsonResponseMock = vi.fn();
const parseErrorDetailMock = vi.fn();

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../../lib/api", () => ({
  appConfigApi: {
    read: (...args: unknown[]) => readConfigMock(...args),
    upsert: (...args: unknown[]) => upsertConfigMock(...args),
  },
  parseJsonResponse: (...args: unknown[]) => parseJsonResponseMock(...args),
  parseErrorDetail: (...args: unknown[]) => parseErrorDetailMock(...args),
}));

vi.mock("./Modal", () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => (isOpen ? <div>{children}</div> : null),
}));

describe("PageHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseErrorDetailMock.mockResolvedValue("Error");
  });

  it("uses default title and subtitle when there is no saved config", async () => {
    useAuthMock.mockReturnValue({ user: { role: "supervisor" } });
    readConfigMock.mockResolvedValue({ ok: false, status: 404 });

    render(<PageHeader pageSlug="general" title="General" subtitle="Vista consolidada" />);

    expect(await screen.findByRole("heading", { name: "General" })).toBeTruthy();
    expect(screen.getByText("Vista consolidada")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /editar encabezado/i })).toBeNull();
    await waitFor(() => expect(readConfigMock).toHaveBeenCalledWith("page_header:general"));
  });

  it("loads persisted overrides and keeps extra subtitle content", async () => {
    useAuthMock.mockReturnValue({ user: { role: "supervisor" } });
    readConfigMock.mockResolvedValue({ ok: true, status: 200 });
    parseJsonResponseMock.mockResolvedValue({
      key: "page_header:rrhh",
      value: JSON.stringify({
        version: 1,
        title: "RRHH Configurado",
        subtitle: "Texto editable desde config",
      }),
    });

    render(
      <PageHeader pageSlug="rrhh" title="Recursos Humanos" defaultSubtitle="Carga y gestión de datos de RRHH" subtitle={<span>Periodo actual</span>} />,
    );

    expect(await screen.findByRole("heading", { name: "RRHH Configurado" })).toBeTruthy();
    expect(screen.getByText("Texto editable desde config")).toBeTruthy();
    expect(screen.getByText("Periodo actual")).toBeTruthy();
  });

  it("normalizes persisted subtitles before rendering dynamic fragments", async () => {
    useAuthMock.mockReturnValue({ user: { role: "supervisor" } });
    readConfigMock.mockResolvedValue({ ok: true, status: 200 });
    parseJsonResponseMock.mockResolvedValue({
      key: "page_header:usuarios",
      value: JSON.stringify({
        version: 1,
        title: "Usuarios",
        subtitle: "Gestiona los usuarios del sistema (14 visibles)",
      }),
    });

    render(
      <PageHeader
        pageSlug="usuarios"
        title="Usuarios"
        defaultSubtitle="Gestiona los usuarios del sistema"
        normalizePersistedSubtitle={(subtitle) => subtitle.replace(/\s*\(\d+ visibles\)$/u, "").trim()}
        subtitleRenderer={(baseSubtitle) => <p>{`${baseSubtitle} (3 visibles)`}</p>}
      />,
    );

    expect(await screen.findByText("Gestiona los usuarios del sistema (3 visibles)")).toBeTruthy();
  });

  it("allows admins to save a new header override", async () => {
    useAuthMock.mockReturnValue({ user: { role: "admin" } });
    readConfigMock.mockResolvedValue({ ok: false, status: 404 });
    upsertConfigMock.mockResolvedValue({ ok: true, status: 200 });

    render(<PageHeader pageSlug="programacion" title="Programación" subtitle="Gestión de grupos y asignación de actividades" />);

    fireEvent.click(await screen.findByRole("button", { name: /editar encabezado/i }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Planificación" } });
    fireEvent.change(screen.getByLabelText("Subtítulo"), { target: { value: "Configuración administrable" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar encabezado/i }));

    await waitFor(() => expect(upsertConfigMock).toHaveBeenCalledTimes(1));

    const payload = upsertConfigMock.mock.calls[0][0];
    expect(payload.key).toBe("page_header:programacion");
    expect(payload.description).toContain("programacion");
    expect(JSON.parse(payload.value)).toMatchObject({
      version: 1,
      title: "Planificación",
      subtitle: "Configuración administrable",
    });

    expect(await screen.findByRole("heading", { name: "Planificación" })).toBeTruthy();
    expect(screen.getByText("Configuración administrable")).toBeTruthy();
  });

  it("allows saving an empty subtitle when the page opts in", async () => {
    useAuthMock.mockReturnValue({ user: { role: "admin" } });
    readConfigMock.mockResolvedValue({ ok: false, status: 404 });
    upsertConfigMock.mockResolvedValue({ ok: true, status: 200 });

    render(
      <PageHeader
        pageSlug="estadisticas"
        title="Estadísticas"
        defaultSubtitle=""
        allowEmptySubtitle
        subtitleRenderer={() => <p>Período Actual</p>}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /editar encabezado/i }));
    fireEvent.change(screen.getByLabelText("Subtítulo"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar encabezado/i }));

    await waitFor(() => expect(upsertConfigMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(upsertConfigMock.mock.calls[0][0].value)).toMatchObject({ subtitle: "" });
    expect(screen.getByText("Período Actual")).toBeTruthy();
  });
});
