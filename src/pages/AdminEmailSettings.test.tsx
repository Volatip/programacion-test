import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminEmailSettings } from "./AdminEmailSettings";

const smtpSettingsReadMock = vi.fn();
const smtpSettingsUpdateMock = vi.fn();
const smtpSettingsSendTestMock = vi.fn();
const parseJsonResponseMock = vi.fn();
const parseErrorDetailMock = vi.fn();

vi.mock("../lib/api", () => ({
  smtpSettingsApi: {
    read: (...args: unknown[]) => smtpSettingsReadMock(...args),
    update: (...args: unknown[]) => smtpSettingsUpdateMock(...args),
    sendTest: (...args: unknown[]) => smtpSettingsSendTestMock(...args),
  },
  parseJsonResponse: (...args: unknown[]) => parseJsonResponseMock(...args),
  parseErrorDetail: (...args: unknown[]) => parseErrorDetailMock(...args),
}));

vi.mock("../components/contextual-help/ContextualHelpButton", () => ({
  ContextualHelpButton: ({ slug }: { slug: string }) => <div>Help: {slug}</div>,
}));

describe("AdminEmailSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseErrorDetailMock.mockResolvedValue("Error");

    smtpSettingsReadMock.mockResolvedValue({ ok: true });
    parseJsonResponseMock.mockResolvedValueOnce({
      host: "smtp.example.com",
      port: 587,
      username: "mailer",
      from_email: "noreply@example.com",
      from_name: "Programación",
      use_tls: true,
      use_ssl: false,
      password_configured: true,
      review_fix_required_subject: "Arreglar programación: {{funcionario_nombre}}",
      review_fix_required_body: "Observación: {{comentario}}",
    });
  });

  it("carga la configuración SMTP y muestra la plantilla editable", async () => {
    render(
      <MemoryRouter>
        <AdminEmailSettings />
      </MemoryRouter>
    );

    await waitFor(() => expect(smtpSettingsReadMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByDisplayValue("smtp.example.com")).toBeTruthy();
    expect(screen.getByDisplayValue("Arreglar programación: {{funcionario_nombre}}")).toBeTruthy();
    expect(screen.getByText(/panel exclusivo para administradores/i)).toBeTruthy();
    expect(screen.getAllByText(/{{comentario}}/i).length).toBeGreaterThan(0);
  });

  it("guarda seguridad SSL y plantilla actualizada", async () => {
    smtpSettingsUpdateMock.mockResolvedValue({ ok: true });
    parseJsonResponseMock.mockResolvedValueOnce({
      host: "smtp.example.com",
      port: 587,
      username: "mailer",
      from_email: "noreply@example.com",
      from_name: "Programación",
      use_tls: false,
      use_ssl: true,
      password_configured: true,
      review_fix_required_subject: "Nuevo asunto {{funcionario_nombre}}",
      review_fix_required_body: "Nuevo cuerpo {{programming_id}}",
    });

    render(
      <MemoryRouter>
        <AdminEmailSettings />
      </MemoryRouter>
    );

    await screen.findByDisplayValue("smtp.example.com");

    fireEvent.change(screen.getByLabelText(/seguridad/i), { target: { value: "ssl" } });
    fireEvent.change(screen.getByLabelText(/asunto/i), { target: { value: "Nuevo asunto {{funcionario_nombre}}" } });
    fireEvent.change(screen.getByLabelText(/cuerpo/i), { target: { value: "Nuevo cuerpo {{programming_id}}" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar configuración/i }));

    await waitFor(() => expect(smtpSettingsUpdateMock).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      username: "mailer",
      password: "",
      from_email: "noreply@example.com",
      from_name: "Programación",
      use_tls: false,
      use_ssl: true,
      review_fix_required_subject: "Nuevo asunto {{funcionario_nombre}}",
      review_fix_required_body: "Nuevo cuerpo {{programming_id}}",
    }));

    expect(await screen.findByText(/configuración de correo guardada/i)).toBeTruthy();
  });

  it("envía un correo de prueba al destinatario indicado", async () => {
    smtpSettingsSendTestMock.mockResolvedValue({ ok: true });
    parseJsonResponseMock.mockResolvedValueOnce({
      recipient: "destino@example.com",
      message: "Correo de prueba enviado a destino@example.com.",
    });

    render(
      <MemoryRouter>
        <AdminEmailSettings />
      </MemoryRouter>
    );

    await screen.findByDisplayValue("smtp.example.com");

    fireEvent.change(screen.getByLabelText(/correo destino/i), { target: { value: "destino@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /probar/i }));

    await waitFor(() => expect(smtpSettingsSendTestMock).toHaveBeenCalledWith({ recipient: "destino@example.com" }));
    expect(await screen.findByText("Correo de prueba enviado a destino@example.com.")).toBeTruthy();
  });

  it("muestra el error cuando falla el correo de prueba", async () => {
    smtpSettingsSendTestMock.mockResolvedValue({ ok: false });
    parseErrorDetailMock.mockResolvedValueOnce("SMTP offline");

    render(
      <MemoryRouter>
        <AdminEmailSettings />
      </MemoryRouter>
    );

    await screen.findByDisplayValue("smtp.example.com");

    fireEvent.change(screen.getByLabelText(/correo destino/i), { target: { value: "destino@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /probar/i }));

    expect(await screen.findByText("SMTP offline")).toBeTruthy();
  });
});
