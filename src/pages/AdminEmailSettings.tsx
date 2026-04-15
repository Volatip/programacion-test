import { FormEvent, useEffect, useMemo, useState } from "react";

import { ContextualHelpButton } from "../components/contextual-help/ContextualHelpButton";
import { PageHeader } from "../components/ui/PageHeader";
import { parseErrorDetail, parseJsonResponse, smtpSettingsApi, type SmtpSettingsResponse, type SmtpSettingsUpdate, type SmtpTestEmailResponse } from "../lib/api";

type SecurityMode = "none" | "starttls" | "ssl";

interface FormState {
  host: string;
  port: string;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  securityMode: SecurityMode;
  review_fix_required_subject: string;
  review_fix_required_body: string;
}

const DEFAULT_FORM: FormState = {
  host: "",
  port: "587",
  username: "",
  password: "",
  from_email: "",
  from_name: "",
  securityMode: "starttls",
  review_fix_required_subject: "Arreglar programación: {{funcionario_nombre}}",
  review_fix_required_body: "Se solicitó arreglar la programación de {{funcionario_nombre}}.\nObservación: {{comentario}}\nID programación: {{programming_id}}\nPeríodo: {{periodo_nombre}}",
};

function toFormState(payload: SmtpSettingsResponse): FormState {
  return {
    host: payload.host,
    port: payload.port > 0 ? String(payload.port) : DEFAULT_FORM.port,
    username: payload.username,
    password: "",
    from_email: payload.from_email,
    from_name: payload.from_name,
    securityMode: payload.use_ssl ? "ssl" : payload.use_tls ? "starttls" : "none",
    review_fix_required_subject: payload.review_fix_required_subject || DEFAULT_FORM.review_fix_required_subject,
    review_fix_required_body: payload.review_fix_required_body || DEFAULT_FORM.review_fix_required_body,
  };
}

export function AdminEmailSettings() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testRecipient, setTestRecipient] = useState("");
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      setError(null);

      try {
        const response = await smtpSettingsApi.read();
        if (!response.ok) {
          throw new Error(await parseErrorDetail(response, "No se pudo cargar la configuración de correo."));
        }

        const payload = await parseJsonResponse<SmtpSettingsResponse>(response);
        if (!cancelled) {
          setForm(toFormState(payload));
          setPasswordConfigured(payload.password_configured);
          setTestRecipient((current) => current || payload.from_email || "");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la configuración de correo.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const securityHelp = useMemo(() => {
    if (form.securityMode === "ssl") {
      return "Usa conexión SSL implícita, normalmente en puerto 465.";
    }
    if (form.securityMode === "starttls") {
      return "Usa SMTP plano con upgrade STARTTLS, normalmente en puerto 587.";
    }
    return "Usa SMTP sin cifrado. Solo recomendado en redes internas controladas.";
  }, [form.securityMode]);

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: SmtpSettingsUpdate = {
      host: form.host.trim(),
      port: Number(form.port),
      username: form.username.trim(),
      password: form.password,
      from_email: form.from_email.trim(),
      from_name: form.from_name.trim(),
      use_tls: form.securityMode === "starttls",
      use_ssl: form.securityMode === "ssl",
      review_fix_required_subject: form.review_fix_required_subject.trim(),
      review_fix_required_body: form.review_fix_required_body.trim(),
    };

    try {
      const response = await smtpSettingsApi.update(payload);
      if (!response.ok) {
        throw new Error(await parseErrorDetail(response, "No se pudo guardar la configuración de correo."));
      }

      const saved = await parseJsonResponse<SmtpSettingsResponse>(response);
      setForm(toFormState(saved));
      setPasswordConfigured(saved.password_configured);
      setSuccess("Configuración de correo guardada.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la configuración de correo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTestEmail() {
    const recipient = testRecipient.trim();
    if (!recipient) {
      setTestSuccess(null);
      setTestError("Ingresa un correo destino para la prueba.");
      return;
    }

    setTesting(true);
    setTestError(null);
    setTestSuccess(null);

    try {
      const response = await smtpSettingsApi.sendTest({ recipient });
      if (!response.ok) {
        throw new Error(await parseErrorDetail(response, "No se pudo enviar el correo de prueba."));
      }

      const payload = await parseJsonResponse<SmtpTestEmailResponse>(response);
      setTestSuccess(payload.message);
    } catch (testEmailError) {
      setTestError(testEmailError instanceof Error ? testEmailError.message : "No se pudo enviar el correo de prueba.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        pageSlug="admin-correo"
        title="Correo"
        subtitle="Panel exclusivo para administradores. Configura SMTP y la plantilla del aviso por correo usado cuando una programación queda con revisión “Arreglar”."
      >
        <ContextualHelpButton slug="admin-correo" />
      </PageHeader>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-200">{success}</div>}

      <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Host SMTP</span>
              <input className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900" value={form.host} onChange={(event) => updateField("host", event.target.value)} disabled={loading || saving} />
            </label>

            <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Puerto</span>
              <input className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900" inputMode="numeric" value={form.port} onChange={(event) => updateField("port", event.target.value)} disabled={loading || saving} />
            </label>

            <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Usuario</span>
              <input className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900" value={form.username} onChange={(event) => updateField("username", event.target.value)} disabled={loading || saving} />
            </label>

            <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Contraseña</span>
              <input className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} placeholder={passwordConfigured ? "•••••••• (dejar vacío para conservar)" : "Ingresar contraseña SMTP"} disabled={loading || saving} />
            </label>

            <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Remitente</span>
              <input className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900" type="email" value={form.from_email} onChange={(event) => updateField("from_email", event.target.value)} disabled={loading || saving} />
            </label>

            <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Nombre remitente</span>
              <input className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900" value={form.from_name} onChange={(event) => updateField("from_name", event.target.value)} disabled={loading || saving} />
            </label>

            <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300 md:col-span-2">
              <span>Seguridad</span>
              <select className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900" value={form.securityMode} onChange={(event) => updateField("securityMode", event.target.value as SecurityMode)} disabled={loading || saving}>
                <option value="starttls">TLS / STARTTLS</option>
                <option value="ssl">SSL implícito</option>
                <option value="none">Sin cifrado</option>
              </select>
              <p className="text-xs font-normal text-gray-500 dark:text-gray-400">{securityHelp}</p>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Correo de prueba</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Envía una prueba usando la configuración SMTP guardada actualmente. Solo disponible para administradores.</p>
            </div>

            {testError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200">{testError}</div>}
            {testSuccess && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-200">{testSuccess}</div>}

            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="flex-1 space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <span>Correo destino</span>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                  type="email"
                  value={testRecipient}
                  onChange={(event) => setTestRecipient(event.target.value)}
                  placeholder="destino@ejemplo.com"
                  disabled={loading || saving || testing}
                />
              </label>

              <button
                type="button"
                className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading || saving || testing}
                onClick={() => void handleSendTestEmail()}
              >
                {testing ? "Probando..." : "Probar"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Plantilla del aviso</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Variables disponibles: {"{{funcionario_nombre}}"}, {"{{comentario}}"}, {"{{programming_id}}"}, {"{{periodo_nombre}}"}.
              </p>
            </div>

            <label className="block space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Asunto</span>
              <input className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900" value={form.review_fix_required_subject} onChange={(event) => updateField("review_fix_required_subject", event.target.value)} disabled={loading || saving} />
            </label>

            <label className="block space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Cuerpo</span>
              <textarea className="min-h-48 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900" value={form.review_fix_required_body} onChange={(event) => updateField("review_fix_required_body", event.target.value)} disabled={loading || saving} />
            </label>
          </div>
        </section>

        <div className="flex items-center justify-end">
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading || saving}>
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      </form>
    </div>
  );
}
