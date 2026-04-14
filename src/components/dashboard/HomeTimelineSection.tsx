import { useEffect, useMemo, useState } from "react";
import { CalendarRange, GripVertical, PencilLine, Plus, Save, Trash2, X } from "lucide-react";

import {
  appConfigApi,
  parseErrorDetail,
  parseJsonResponse,
  type AppConfigResponse,
} from "../../lib/api";
import { ContextualHelpButton } from "../contextual-help/ContextualHelpButton";
import { isAdminRole } from "../../lib/userRoles";
import {
  createEmptyMilestone,
  DEFAULT_HOME_TIMELINE,
  DEFAULT_HOME_TIMELINE_SECTION,
  HOME_TIMELINE_COLORS,
  HOME_TIMELINE_CONFIG_KEY,
  HOME_TIMELINE_DESCRIPTION,
  parseTimelineConfig,
  serializeTimelineConfig,
  type HomeTimelineColor,
  type HomeTimelineConfig,
  type HomeTimelineMilestone,
  type HomeTimelineSectionContent,
} from "../../lib/homeTimeline";

const COLOR_STYLES: Record<HomeTimelineColor, { badge: string; dot: string; line: string; connector: string; activeBorder: string; activeSurface: string; activeLabel: string }> = {
  indigo: {
    badge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200",
    dot: "bg-indigo-500 dark:bg-indigo-400",
    line: "from-indigo-500/20 to-transparent dark:from-indigo-400/30",
    connector: "bg-indigo-200 dark:bg-indigo-400/40",
    activeBorder: "border-indigo-300 border-t-indigo-500 dark:border-indigo-500/60 dark:border-t-indigo-400",
    activeSurface: "bg-indigo-50/70 dark:bg-indigo-950/30",
    activeLabel: "text-indigo-700 dark:text-indigo-200",
  },
  emerald: {
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
    dot: "bg-emerald-500 dark:bg-emerald-400",
    line: "from-emerald-500/20 to-transparent dark:from-emerald-400/30",
    connector: "bg-emerald-200 dark:bg-emerald-400/40",
    activeBorder: "border-emerald-300 border-t-emerald-500 dark:border-emerald-500/60 dark:border-t-emerald-400",
    activeSurface: "bg-emerald-50/70 dark:bg-emerald-950/30",
    activeLabel: "text-emerald-700 dark:text-emerald-200",
  },
  amber: {
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
    dot: "bg-amber-500 dark:bg-amber-400",
    line: "from-amber-500/20 to-transparent dark:from-amber-400/30",
    connector: "bg-amber-200 dark:bg-amber-400/40",
    activeBorder: "border-amber-300 border-t-amber-500 dark:border-amber-500/60 dark:border-t-amber-400",
    activeSurface: "bg-amber-50/70 dark:bg-amber-950/30",
    activeLabel: "text-amber-700 dark:text-amber-200",
  },
  rose: {
    badge: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200",
    dot: "bg-rose-500 dark:bg-rose-400",
    line: "from-rose-500/20 to-transparent dark:from-rose-400/30",
    connector: "bg-rose-200 dark:bg-rose-400/40",
    activeBorder: "border-rose-300 border-t-rose-500 dark:border-rose-500/60 dark:border-t-rose-400",
    activeSurface: "bg-rose-50/70 dark:bg-rose-950/30",
    activeLabel: "text-rose-700 dark:text-rose-200",
  },
  violet: {
    badge: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200",
    dot: "bg-violet-500 dark:bg-violet-400",
    line: "from-violet-500/20 to-transparent dark:from-violet-400/30",
    connector: "bg-violet-200 dark:bg-violet-400/40",
    activeBorder: "border-violet-300 border-t-violet-500 dark:border-violet-500/60 dark:border-t-violet-400",
    activeSurface: "bg-violet-50/70 dark:bg-violet-950/30",
    activeLabel: "text-violet-700 dark:text-violet-200",
  },
};

const DEFAULT_TIMELINE_CONFIG: HomeTimelineConfig = {
  section: DEFAULT_HOME_TIMELINE_SECTION,
  milestones: DEFAULT_HOME_TIMELINE,
};

interface HomeTimelineSectionProps {
  role?: string;
}

export function HomeTimelineSection({ role }: HomeTimelineSectionProps) {
  const isAdmin = isAdminRole(role);
  const [sectionContent, setSectionContent] = useState<HomeTimelineSectionContent>(DEFAULT_HOME_TIMELINE_SECTION);
  const [draftSectionContent, setDraftSectionContent] = useState<HomeTimelineSectionContent>(DEFAULT_HOME_TIMELINE_SECTION);
  const [milestones, setMilestones] = useState<HomeTimelineMilestone[]>(DEFAULT_HOME_TIMELINE);
  const [draftMilestones, setDraftMilestones] = useState<HomeTimelineMilestone[]>(DEFAULT_HOME_TIMELINE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTimeline() {
      setLoading(true);
      setError(null);

      try {
        const response = await appConfigApi.read(HOME_TIMELINE_CONFIG_KEY);

        if (response.status === 404) {
          if (!cancelled) {
            setSectionContent(DEFAULT_TIMELINE_CONFIG.section);
            setDraftSectionContent(DEFAULT_TIMELINE_CONFIG.section);
            setMilestones(DEFAULT_TIMELINE_CONFIG.milestones);
            setDraftMilestones(DEFAULT_TIMELINE_CONFIG.milestones);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(await parseErrorDetail(response, "No se pudo cargar la línea de tiempo."));
        }

        const payload = await parseJsonResponse<AppConfigResponse>(response);
        const parsedConfig = parseTimelineConfig(payload.value);
        const resolvedMilestones = parsedConfig.milestones.length > 0 ? parsedConfig.milestones : DEFAULT_HOME_TIMELINE;

        if (!cancelled) {
          setSectionContent(parsedConfig.section);
          setDraftSectionContent(parsedConfig.section);
          setMilestones(resolvedMilestones);
          setDraftMilestones(resolvedMilestones);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la línea de tiempo.");
          setSectionContent(DEFAULT_TIMELINE_CONFIG.section);
          setDraftSectionContent(DEFAULT_TIMELINE_CONFIG.section);
          setMilestones(DEFAULT_TIMELINE_CONFIG.milestones);
          setDraftMilestones(DEFAULT_TIMELINE_CONFIG.milestones);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTimeline();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleMilestones = useMemo(() => (milestones.length > 0 ? milestones : DEFAULT_HOME_TIMELINE), [milestones]);

  function handleOpenEditor() {
    setDraftSectionContent(sectionContent);
    setDraftMilestones(milestones.length > 0 ? milestones : DEFAULT_HOME_TIMELINE);
    setError(null);
    setSuccess(null);
    setIsEditing(true);
  }

  function handleCloseEditor() {
    setDraftSectionContent(sectionContent);
    setDraftMilestones(milestones.length > 0 ? milestones : DEFAULT_HOME_TIMELINE);
    setError(null);
    setIsEditing(false);
  }

  function handleSectionDraftChange(field: keyof HomeTimelineSectionContent, value: string) {
    setDraftSectionContent((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSectionVisibilityChange(field: "showTitle" | "showSubtitle" | "showDescription", checked: boolean) {
    setDraftSectionContent((current) => ({
      ...current,
      [field]: checked,
    }));
  }

  function handleDraftChange(index: number, field: keyof HomeTimelineMilestone, value: string) {
    setDraftMilestones((current) =>
      current.map((milestone, milestoneIndex) =>
        milestoneIndex === index ? { ...milestone, [field]: value } : milestone
      )
    );
  }

  function handleDraftActiveChange(index: number, checked: boolean) {
    setDraftMilestones((current) =>
      current.map((milestone, milestoneIndex) => ({
        ...milestone,
        isActive: milestoneIndex === index ? checked : checked ? false : Boolean(milestone.isActive),
      })),
    );
  }

  function handleAddMilestone() {
    setDraftMilestones((current) => [...current, createEmptyMilestone(current.length)]);
  }

  function handleRemoveMilestone(index: number) {
    setDraftMilestones((current) => current.filter((_, milestoneIndex) => milestoneIndex !== index));
  }

  async function handleSave() {
    const sanitizedSection = {
      title: draftSectionContent.title.trim() || DEFAULT_HOME_TIMELINE_SECTION.title,
      subtitle: draftSectionContent.subtitle.trim() || DEFAULT_HOME_TIMELINE_SECTION.subtitle,
      description: draftSectionContent.description.trim() || DEFAULT_HOME_TIMELINE_SECTION.description,
      showTitle: Boolean(draftSectionContent.showTitle),
      showSubtitle: Boolean(draftSectionContent.showSubtitle),
      showDescription: Boolean(draftSectionContent.showDescription),
    } satisfies HomeTimelineSectionContent;

    const sanitizedMilestones = draftMilestones
      .map((milestone, index) => ({
        ...milestone,
        title: milestone.title.trim(),
        date: milestone.date.trim(),
        description: milestone.description.trim(),
        color: milestone.color || HOME_TIMELINE_COLORS[index % HOME_TIMELINE_COLORS.length],
      }))
      .filter((milestone) => milestone.title && milestone.date);

    if (sanitizedMilestones.length === 0) {
      setError("Debes guardar al menos un hito con título y fecha.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await appConfigApi.upsert({
        key: HOME_TIMELINE_CONFIG_KEY,
        value: serializeTimelineConfig({
          section: sanitizedSection,
          milestones: sanitizedMilestones,
        }),
        description: HOME_TIMELINE_DESCRIPTION,
      });

      if (!response.ok) {
        throw new Error(await parseErrorDetail(response, "No se pudo guardar la línea de tiempo."));
      }

      const savedMilestones = sanitizedMilestones;
      setSectionContent(sanitizedSection);
      setDraftSectionContent(sanitizedSection);
      setMilestones(savedMilestones);
      setDraftMilestones(savedMilestones);
      setIsEditing(false);
      setSuccess("Línea de tiempo guardada.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la línea de tiempo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          {sectionContent.showSubtitle && (
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary dark:bg-blue-500/10 dark:text-blue-300">
              <CalendarRange className="h-4 w-4" />
              {sectionContent.subtitle}
            </div>
          )}
          <div>
            {sectionContent.showTitle && <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{sectionContent.title}</h2>}
            {sectionContent.showDescription && (
              <p className={`${sectionContent.showTitle ? "mt-1" : ""} w-full text-sm leading-6 text-justify text-gray-600 dark:text-gray-300`}>
                {sectionContent.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          <ContextualHelpButton slug="home" />
          {isAdmin && !isEditing && (
            <button
              type="button"
              onClick={handleOpenEditor}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
            >
              <PencilLine className="h-4 w-4" />
              Editar timeline
            </button>
          )}
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200">{error}</div>}
      {success && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-200">{success}</div>}

      <div className="mt-8 overflow-x-auto pb-3">
        <ol className="flex min-w-max gap-4 pr-2 md:min-w-0 md:gap-6" aria-label="Timeline horizontal de hitos">
          {visibleMilestones.map((milestone, index) => {
            const styles = COLOR_STYLES[milestone.color];
            const isLastItem = index === visibleMilestones.length - 1;

            return (
              <li key={milestone.id} className="flex min-w-[17rem] max-w-xs flex-1 flex-col pb-8 md:basis-0 md:max-w-none md:min-w-0">
                <div className="mb-4 flex items-center gap-3 px-1" aria-hidden="true">
                  <span className={`block h-4 w-4 shrink-0 rounded-full border-4 border-white shadow-sm dark:border-gray-800 ${styles.dot}`} />
                  <span className={`h-1 flex-1 rounded-full ${styles.connector} ${isLastItem ? "opacity-70" : ""}`} />
                </div>

                <div className="relative flex flex-1 flex-col">
                  <article className={[
                    "flex h-full flex-col rounded-2xl border border-gray-200 border-t-4 bg-gradient-to-br p-5 shadow-sm transition-colors dark:border-gray-700 dark:bg-gray-900/60",
                    styles.line,
                    milestone.isActive ? `${styles.activeBorder} ${styles.activeSurface} shadow-md` : "border-t-transparent",
                  ].join(" ")}>
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}>
                      <GripVertical className="h-3.5 w-3.5" />
                      {milestone.date}
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">{milestone.title}</h3>
                    {milestone.description && (
                      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{milestone.description}</p>
                    )}
                  </article>
                  {milestone.isActive && (
                    <div className="absolute left-1/2 top-full mt-1 flex -translate-x-1/2 justify-center">
                      <span className={`inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold shadow-sm dark:bg-gray-900/80 ${styles.activeLabel}`}>
                        Actual
                      </span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {loading && <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">Cargando línea de tiempo...</p>}
      </div>

      {isAdmin && isEditing && (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-5 dark:border-gray-600 dark:bg-gray-900/40">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Edición de timeline</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Ajusta los textos de cabecera y luego completa título y fecha para cada hito. También puedes marcar una etapa como activa para destacarla en Inicio.</p>
            </div>

            <button
              type="button"
              onClick={handleAddMilestone}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
            >
              <Plus className="h-4 w-4" />
              Agregar hito
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <span>Título principal</span>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                  value={draftSectionContent.title}
                  onChange={(event) => handleSectionDraftChange("title", event.target.value)}
                  placeholder="Ej. Línea de tiempo"
                  disabled={saving}
                />
                <label className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600">
                  <input
                    type="checkbox"
                    checked={Boolean(draftSectionContent.showTitle)}
                    onChange={(event) => handleSectionVisibilityChange("showTitle", event.target.checked)}
                    disabled={saving}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-normal text-gray-600 dark:text-gray-300">Mostrar título principal</span>
                </label>
              </label>

              <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <span>Subtítulo / etiqueta</span>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                  value={draftSectionContent.subtitle}
                  onChange={(event) => handleSectionDraftChange("subtitle", event.target.value)}
                  placeholder="Ej. Hitos del proceso"
                  disabled={saving}
                />
                <label className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600">
                  <input
                    type="checkbox"
                    checked={Boolean(draftSectionContent.showSubtitle)}
                    onChange={(event) => handleSectionVisibilityChange("showSubtitle", event.target.checked)}
                    disabled={saving}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-normal text-gray-600 dark:text-gray-300">Mostrar subtítulo / etiqueta</span>
                </label>
              </label>

              <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300 md:col-span-2">
                <span>Descripción de la sección</span>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                  value={draftSectionContent.description}
                  onChange={(event) => handleSectionDraftChange("description", event.target.value)}
                  placeholder="Resumen visual del flujo operativo"
                  disabled={saving}
                />
                <label className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600">
                  <input
                    type="checkbox"
                    checked={Boolean(draftSectionContent.showDescription)}
                    onChange={(event) => handleSectionVisibilityChange("showDescription", event.target.checked)}
                    disabled={saving}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-normal text-gray-600 dark:text-gray-300">Mostrar descripción de la sección</span>
                </label>
              </label>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {draftMilestones.map((milestone, index) => (
              <div key={milestone.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <span>Fecha</span>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                      value={milestone.date}
                      onChange={(event) => handleDraftChange(index, "date", event.target.value)}
                      placeholder="Ej. Semana 1"
                      disabled={saving}
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <span>Título</span>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                      value={milestone.title}
                      onChange={(event) => handleDraftChange(index, "title", event.target.value)}
                      placeholder="Nombre del hito"
                      disabled={saving}
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300 md:col-span-2">
                    <span>Descripción</span>
                    <textarea
                      className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                      value={milestone.description}
                      onChange={(event) => handleDraftChange(index, "description", event.target.value)}
                      placeholder="Contexto breve del hito"
                      disabled={saving}
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <span>Color</span>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                      value={milestone.color}
                      onChange={(event) => handleDraftChange(index, "color", event.target.value)}
                      disabled={saving}
                    >
                      <option value="indigo">Índigo</option>
                      <option value="emerald">Esmeralda</option>
                      <option value="amber">Ámbar</option>
                      <option value="rose">Rosado</option>
                      <option value="violet">Violeta</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <span>Estado destacado</span>
                    <label className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600">
                      <input
                        type="checkbox"
                        checked={Boolean(milestone.isActive)}
                        onChange={(event) => handleDraftActiveChange(index, event.target.checked)}
                        disabled={saving}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-normal text-gray-600 dark:text-gray-300">Marcar este hito como activo</span>
                    </label>
                  </label>

                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveMilestone(index)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-900/20"
                      disabled={saving || draftMilestones.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleCloseEditor}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-400 dark:border-gray-600 dark:text-gray-200"
              disabled={saving}
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
            >
              <Save className="h-4 w-4" />
              {saving ? "Guardando..." : "Guardar línea de tiempo"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
