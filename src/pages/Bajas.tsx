import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import {
  dismissReasonsApi,
  type DismissActionType,
  type DismissReason,
  type DismissReasonCategory,
} from "../lib/dismissReasons";

interface ReasonDraft {
  name: string;
  description: string;
  action_type: DismissActionType;
  reason_category: DismissReasonCategory;
  sort_order: number;
  is_active: boolean;
}

interface SuboptionDraft {
  name: string;
  description: string;
  sort_order: number;
}

const emptyReasonDraft = (): ReasonDraft => ({
  name: "",
  description: "",
  action_type: "dismiss",
  reason_category: "other",
  sort_order: 0,
  is_active: true,
});

const emptySuboptionDraft = (): SuboptionDraft => ({
  name: "",
  description: "",
  sort_order: 0,
});

function toReasonDraft(reason: DismissReason): ReasonDraft {
  return {
    name: reason.name,
    description: reason.description,
    action_type: reason.action_type,
    reason_category: reason.reason_category,
    sort_order: reason.sort_order,
    is_active: reason.is_active,
  };
}

export function Bajas() {
  const [reasons, setReasons] = useState<DismissReason[]>([]);
  const [selectedReasonId, setSelectedReasonId] = useState<number | null>(null);
  const [reasonDraft, setReasonDraft] = useState<ReasonDraft>(emptyReasonDraft());
  const [suboptionDraft, setSuboptionDraft] = useState<SuboptionDraft>(emptySuboptionDraft());
  const [editingSuboptionId, setEditingSuboptionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await dismissReasonsApi.list(false);
        if (cancelled) return;
        setReasons(data);
        if (data.length > 0) {
          setSelectedReasonId((current) => current ?? data[0].id);
          setReasonDraft((current) => (current.name || current.description ? current : toReasonDraft(data[0])));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los motivos de baja.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedReasons = useMemo(
    () => [...reasons].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [reasons],
  );

  const selectedReason = sortedReasons.find((reason) => reason.id === selectedReasonId) ?? null;

  useEffect(() => {
    if (selectedReason) {
      setReasonDraft(toReasonDraft(selectedReason));
      setSuboptionDraft(emptySuboptionDraft());
      setEditingSuboptionId(null);
    }
  }, [selectedReason]);

  const replaceReason = (nextReason: DismissReason) => {
    setReasons((current) => {
      const remaining = current.filter((reason) => reason.id !== nextReason.id);
      return [...remaining, nextReason];
    });
    setSelectedReasonId(nextReason.id);
    setReasonDraft(toReasonDraft(nextReason));
  };

  const handleCreateNewReason = () => {
    setSelectedReasonId(null);
    setReasonDraft(emptyReasonDraft());
    setSuboptionDraft(emptySuboptionDraft());
    setEditingSuboptionId(null);
    setError(null);
    setSuccess(null);
  };

  const handleSaveReason = async () => {
    if (!reasonDraft.name.trim()) {
      setError("Debes indicar el nombre del motivo.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        ...reasonDraft,
        name: reasonDraft.name.trim(),
        description: reasonDraft.description.trim(),
      };

      const saved = selectedReasonId
        ? await dismissReasonsApi.update(selectedReasonId, payload)
        : await dismissReasonsApi.create(payload);
      replaceReason(saved);
      setSuccess(selectedReasonId ? "Motivo actualizado correctamente." : "Motivo creado correctamente.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el motivo.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReason = async () => {
    if (!selectedReason || !window.confirm(`¿Eliminar el motivo "${selectedReason.name}"?`)) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await dismissReasonsApi.remove(selectedReason.id);
      const nextReasons = reasons.filter((reason) => reason.id !== selectedReason.id);
      setReasons(nextReasons);
      if (nextReasons[0]) {
        setSelectedReasonId(nextReasons[0].id);
        setReasonDraft(toReasonDraft(nextReasons[0]));
      } else {
        handleCreateNewReason();
      }
      setSuccess("Motivo eliminado correctamente.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el motivo.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditSuboption = (suboptionId: number) => {
    const suboption = selectedReason?.suboptions.find((item) => item.id === suboptionId);
    if (!suboption) return;
    setEditingSuboptionId(suboption.id);
    setSuboptionDraft({
      name: suboption.name,
      description: suboption.description,
      sort_order: suboption.sort_order,
    });
  };

  const handleSaveSuboption = async () => {
    if (!selectedReasonId) {
      setError("Primero guarda el motivo antes de crear subopciones.");
      return;
    }
    if (!suboptionDraft.name.trim()) {
      setError("Debes indicar el nombre de la subopción.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        ...suboptionDraft,
        name: suboptionDraft.name.trim(),
        description: suboptionDraft.description.trim(),
      };
      const updatedReason = editingSuboptionId
        ? await dismissReasonsApi.updateSuboption(editingSuboptionId, payload)
        : await dismissReasonsApi.addSuboption(selectedReasonId, payload);
      replaceReason(updatedReason);
      setSuboptionDraft(emptySuboptionDraft());
      setEditingSuboptionId(null);
      setSuccess(editingSuboptionId ? "Subopción actualizada correctamente." : "Subopción creada correctamente.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la subopción.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSuboption = async (suboptionId: number) => {
    if (!window.confirm("¿Eliminar esta subopción?")) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updatedReason = await dismissReasonsApi.deleteSuboption(suboptionId);
      replaceReason(updatedReason);
      if (editingSuboptionId === suboptionId) {
        setEditingSuboptionId(null);
        setSuboptionDraft(emptySuboptionDraft());
      }
      setSuccess("Subopción eliminada correctamente.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la subopción.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Bajas" subtitle="Administra motivos, comportamiento y subopciones del flujo de baja de funcionarios" />

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Motivos</h2>
            <button type="button" onClick={handleCreateNewReason} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-primary hover:text-primary">
              <Plus className="h-4 w-4" /> Nuevo
            </button>
          </div>

          <div className="space-y-2">
            {loading && <p className="text-sm text-gray-500">Cargando motivos...</p>}
            {!loading && sortedReasons.map((reason) => (
              <button
                key={reason.id}
                type="button"
                onClick={() => setSelectedReasonId(reason.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${selectedReasonId === reason.id ? "border-primary bg-blue-50 text-primary" : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200 hover:bg-gray-100"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{reason.name}</span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${reason.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    {reason.is_active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">{reason.action_type === "hide" ? "Ocultar del ámbito" : "Dar de baja"}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Nombre</span>
              <input value={reasonDraft.name} onChange={(event) => setReasonDraft((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Orden</span>
              <input type="number" value={reasonDraft.sort_order} onChange={(event) => setReasonDraft((current) => ({ ...current, sort_order: Number(event.target.value) || 0 }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Comportamiento</span>
              <select value={reasonDraft.action_type} onChange={(event) => setReasonDraft((current) => ({ ...current, action_type: event.target.value as DismissActionType }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                <option value="dismiss">Dar de baja (deja al funcionario inactivo)</option>
                <option value="hide">Ocultar del ámbito del usuario</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Categoría para reportes</span>
              <select value={reasonDraft.reason_category} onChange={(event) => setReasonDraft((current) => ({ ...current, reason_category: event.target.value as DismissReasonCategory }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                <option value="resignation">Renuncia</option>
                <option value="mobility">Movilidad</option>
                <option value="other">Otro</option>
              </select>
            </label>
          </div>

          <label className="mt-5 block space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Descripción</span>
            <textarea value={reasonDraft.description} onChange={(event) => setReasonDraft((current) => ({ ...current, description: event.target.value }))} rows={4} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </label>

          <label className="mt-5 inline-flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={reasonDraft.is_active} onChange={(event) => setReasonDraft((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 rounded border-gray-300" />
            Motivo activo para el flujo operativo
          </label>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            {selectedReason && (
              <button type="button" onClick={handleDeleteReason} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60">
                <Trash2 className="h-4 w-4" /> Eliminar motivo
              </button>
            )}
            <button type="button" onClick={handleSaveReason} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-70">
              <Save className="h-4 w-4" /> {saving ? "Guardando..." : selectedReason ? "Guardar cambios" : "Crear motivo"}
            </button>
          </div>

          <div className="mt-8 border-t border-gray-100 pt-6 dark:border-gray-700">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Subopciones</h2>
              {selectedReason && <span className="text-sm text-gray-500">Motivo actual: {selectedReason.name}</span>}
            </div>

            {!selectedReason ? (
              <p className="text-sm text-gray-500">Guarda o selecciona un motivo para administrar sus subopciones.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <input value={suboptionDraft.name} onChange={(event) => setSuboptionDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre subopción" className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                    <input value={suboptionDraft.description} onChange={(event) => setSuboptionDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Descripción" className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                    <input type="number" value={suboptionDraft.sort_order} onChange={(event) => setSuboptionDraft((current) => ({ ...current, sort_order: Number(event.target.value) || 0 }))} placeholder="Orden" className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    {editingSuboptionId && (
                      <button type="button" onClick={() => { setEditingSuboptionId(null); setSuboptionDraft(emptySuboptionDraft()); }} className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100">
                        Cancelar edición
                      </button>
                    )}
                    <button type="button" onClick={handleSaveSuboption} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-70">
                      <Plus className="h-4 w-4" /> {editingSuboptionId ? "Guardar subopción" : "Agregar subopción"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedReason.suboptions.length === 0 ? (
                    <p className="text-sm text-gray-500">Este motivo aún no tiene subopciones.</p>
                  ) : (
                    selectedReason.suboptions
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
                      .map((suboption) => (
                        <div key={suboption.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:flex-row md:items-center md:justify-between dark:border-gray-700 dark:bg-gray-900/20">
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">{suboption.name}</div>
                            <div className="text-sm text-gray-500">{suboption.description || "Sin descripción"}</div>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <button type="button" onClick={() => handleEditSuboption(suboption.id)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100">Editar</button>
                            <button type="button" onClick={() => void handleDeleteSuboption(suboption.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">Eliminar</button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
