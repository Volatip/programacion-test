import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ContextualHelpButton } from "../components/contextual-help/ContextualHelpButton";
import { PageHeader } from "../components/ui/PageHeader";
import { contextualHelpApi, type ContextualHelpPage } from "../lib/contextualHelp";

interface ContextualHelpDraft {
  slug: string;
  page_name: string;
  description: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
}

const emptyDraft = (): ContextualHelpDraft => ({
  slug: "",
  page_name: "",
  description: "",
  sections: [{ title: "", content: "" }],
});

function toDraft(page: ContextualHelpPage): ContextualHelpDraft {
  return {
    slug: page.slug,
    page_name: page.page_name,
    description: page.description || "",
    sections: page.sections.length
      ? page.sections.map((section) => ({ title: section.title, content: section.content }))
      : [{ title: "", content: "" }],
  };
}

const NEW_HELP_QUERY_VALUE = "__new__";

export function ContextualHelpAdmin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pages, setPages] = useState<ContextualHelpPage[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContextualHelpDraft>(emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPages = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await contextualHelpApi.list();
        if (!isMounted) return;

        setPages(response);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las ayudas contextuales.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadPages();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!pages.length) {
      if (searchParams.get("slug") === NEW_HELP_QUERY_VALUE) {
        setSelectedSlug(null);
        setDraft(emptyDraft());
      }
      return;
    }

    const preferredSlug = searchParams.get("slug");
    if (preferredSlug === NEW_HELP_QUERY_VALUE) {
      setSelectedSlug(null);
      setDraft(emptyDraft());
      return;
    }

    const targetPage = (preferredSlug && pages.find((page) => page.slug === preferredSlug)) || pages[0] || null;

    if (!targetPage) {
      return;
    }

    setSelectedSlug(targetPage.slug);
    setDraft(toDraft(targetPage));
  }, [pages, searchParams]);

  const sortedPages = useMemo(
    () => [...pages].sort((a, b) => a.page_name.localeCompare(b.page_name)),
    [pages]
  );

  const handleSelectPage = (page: ContextualHelpPage) => {
    setSelectedSlug(page.slug);
    setDraft(toDraft(page));
    setSuccessMessage(null);
    setSearchParams({ slug: page.slug });
  };

  const handleCreateNew = () => {
    setSelectedSlug(null);
    setDraft(emptyDraft());
    setSuccessMessage(null);
    setSearchParams({ slug: NEW_HELP_QUERY_VALUE });
  };

  const handleSave = async () => {
    const normalizedSlug = draft.slug.trim().toLowerCase();
    if (!normalizedSlug || !draft.page_name.trim()) {
      setError("Debes indicar slug y nombre de página.");
      return;
    }

    const sanitizedSections = draft.sections
      .map((section) => ({ title: section.title.trim(), content: section.content.trim() }))
      .filter((section) => section.title && section.content);

    if (!sanitizedSections.length) {
      setError("Debes registrar al menos una sección con título y contenido.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const saved = await contextualHelpApi.upsert(normalizedSlug, {
        page_name: draft.page_name.trim(),
        description: draft.description.trim(),
        sections: sanitizedSections,
      });

      setPages((currentPages) => {
        const nextPages = currentPages.filter((page) => page.slug !== saved.slug);
        nextPages.push(saved);
        return nextPages;
      });
      setSelectedSlug(saved.slug);
      setDraft(toDraft(saved));
      setSuccessMessage("Ayuda contextual guardada correctamente.");
      setSearchParams({ slug: saved.slug });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la ayuda contextual.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        pageSlug="ayudas-contextuales"
        title="Ayudas Contextuales"
        subtitle="Administra el contenido mostrado en los modales de ayuda por página"
      >
        <ContextualHelpButton slug="ayudas-contextuales" />
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Páginas</h2>
            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-200"
            >
              <Plus className="h-4 w-4" /> Nueva
            </button>
          </div>

          <div className="space-y-2">
            {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Cargando páginas...</p>}

            {!loading && sortedPages.map((page) => (
              <button
                key={page.slug}
                type="button"
                onClick={() => handleSelectPage(page)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${selectedSlug === page.slug ? "border-primary bg-blue-50 text-primary dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-200" : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:bg-gray-900/70"}`}
              >
                <div className="font-semibold">{page.page_name}</div>
                <div className="mt-1 text-xs uppercase tracking-wide opacity-70">{page.slug}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Slug de página</span>
              <input
                value={draft.slug}
                disabled={Boolean(selectedSlug)}
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, slug: event.target.value }))}
                placeholder="ej. funcionarios"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-700"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Nombre visible</span>
              <input
                value={draft.page_name}
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, page_name: event.target.value }))}
                placeholder="Nombre de la página"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </label>
          </div>

          <label className="mt-5 block space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Descripción general</span>
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, description: event.target.value }))}
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </label>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Secciones explicativas</h2>
              <button
                type="button"
                onClick={() => setDraft((currentDraft) => ({
                  ...currentDraft,
                  sections: [...currentDraft.sections, { title: "", content: "" }],
                }))}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-200"
              >
                <Plus className="h-4 w-4" /> Agregar sección
              </button>
            </div>

            {draft.sections.map((section, index) => (
              <div key={`${selectedSlug ?? "new"}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Sección {index + 1}</h3>
                  <button
                    type="button"
                    disabled={draft.sections.length === 1}
                    onClick={() => setDraft((currentDraft) => ({
                      ...currentDraft,
                      sections: currentDraft.sections.filter((_, sectionIndex) => sectionIndex !== index),
                    }))}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="h-4 w-4" /> Quitar
                  </button>
                </div>

                <div className="space-y-3">
                  <input
                    value={section.title}
                    onChange={(event) => setDraft((currentDraft) => ({
                      ...currentDraft,
                      sections: currentDraft.sections.map((currentSection, sectionIndex) =>
                        sectionIndex === index ? { ...currentSection, title: event.target.value } : currentSection
                      ),
                    }))}
                    placeholder="Título de la sección"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                  <textarea
                    value={section.content}
                    onChange={(event) => setDraft((currentDraft) => ({
                      ...currentDraft,
                      sections: currentDraft.sections.map((currentSection, sectionIndex) =>
                        sectionIndex === index ? { ...currentSection, content: event.target.value } : currentSection
                      ),
                    }))}
                    rows={4}
                    placeholder="Explica qué hace esta parte de la página y cómo debe interpretarse."
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar ayuda"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
