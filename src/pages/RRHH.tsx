import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { RRHHUploadPanel } from "../components/rrhh/RRHHUploadPanel";
import { usePeriods } from "../context/PeriodsContext";
import { PageHeader } from "../components/ui/PageHeader";
import { buildApiUrl, fetchWithAuth } from "../lib/api";
import { ContextualHelpButton } from "../components/contextual-help/ContextualHelpButton";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

interface RRHHDeletionBatchApiItem {
  created_at: string;
  funcionario_count: number;
  tracked_activity_count: number;
  file_names: string[];
}

interface RRHHDeletionBatchOption {
  value: string;
  label: string;
}

const formatCreatedAtLabel = (batch: RRHHDeletionBatchApiItem) => {
  const formattedDate = new Date(batch.created_at).toLocaleString("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const baseLabel = `${formattedDate} · ${batch.funcionario_count} registro${batch.funcionario_count === 1 ? "" : "s"}`;
  if (batch.file_names.length === 1) {
    return `${baseLabel} · ${batch.file_names[0]}`;
  }
  if (batch.tracked_activity_count > 1) {
    return `${baseLabel} · ${batch.tracked_activity_count} cargas`;
  }
  return baseLabel;
};

export function RRHH() {
  const [dragActive, setDragActive] = useState(false);
  const { selectedPeriod, isReadOnly } = usePeriods();
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting" | "success" | "error">("idle");
  const [deleteBatchOptions, setDeleteBatchOptions] = useState<RRHHDeletionBatchOption[]>([]);
  const [selectedDeleteBatch, setSelectedDeleteBatch] = useState("");
  const [deleteByCreatedAtStatus, setDeleteByCreatedAtStatus] = useState<"idle" | "loading-options" | "deleting" | "success" | "error">("idle");
  const [deleteByCreatedAtMessage, setDeleteByCreatedAtMessage] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type.includes("sheet") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      setFile(file);
      setUploadStatus("idle");
    } else {
      alert("Por favor sube un archivo Excel válido (.xlsx, .xls)");
    }
  };

  const [uploadStats, setUploadStats] = useState<{created: number, updated: number} | null>(null);

  const loadDeleteBatchOptions = async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    if (showLoading) {
      setDeleteByCreatedAtStatus("loading-options");
      setDeleteByCreatedAtMessage(null);
    }

    const url = selectedPeriod
      ? buildApiUrl(`/funcionarios/upload/batches?period_id=${selectedPeriod.id}`)
      : buildApiUrl("/funcionarios/upload/batches");

    try {
      const response = await fetchWithAuth(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || "No se pudieron cargar las fechas reversibles de RRHH");
      }

      const data = await response.json() as { batches?: RRHHDeletionBatchApiItem[] };
      const options = (data.batches ?? []).map((batch) => ({
        value: batch.created_at,
        label: formatCreatedAtLabel(batch),
      }));

      setDeleteBatchOptions(options);
      setSelectedDeleteBatch((current) => {
        if (options.some((option) => option.value === current)) {
          return current;
        }
        return options[0]?.value ?? "";
      });
      if (showLoading) {
        setDeleteByCreatedAtStatus("idle");
      }
    } catch (error) {
      console.error("Error cargando lotes RRHH reversibles:", error);
      setDeleteBatchOptions([]);
      setSelectedDeleteBatch("");
      setDeleteByCreatedAtStatus("error");
      setDeleteByCreatedAtMessage(getErrorMessage(error, "No se pudieron cargar las fechas reversibles de RRHH"));
    }
  };

  useEffect(() => {
    void loadDeleteBatchOptions();
  }, [selectedPeriod?.id]);

  const handleUpload = async () => {
    if (!file) return;
    
    setUploadStatus("uploading");
    setUploadStats(null);
    
    const formData = new FormData();
    formData.append("file", file);

    const url = selectedPeriod 
        ? buildApiUrl(`/funcionarios/upload?period_id=${selectedPeriod.id}`)
        : buildApiUrl('/funcionarios/upload');

    try {
      const response = await fetchWithAuth(url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || "Error al subir el archivo");
      }

      const data = await response.json();
      console.log("Respuesta del servidor:", data);
      
      setUploadStats({
        created: data.registros_creados,
        updated: data.registros_actualizados
      });
      setUploadStatus("success");
      setDeleteStatus("idle");
      setDeleteByCreatedAtMessage(null);
      await loadDeleteBatchOptions({ showLoading: false });
    } catch (error) {
      console.error("Error:", error);
      setUploadStatus("error");
      alert(`Error: ${getErrorMessage(error, "Hubo un error al procesar el archivo")}`);
    }
  };

  const handleDeleteLastAdded = async () => {
    if (isReadOnly) return;

    const confirmed = window.confirm("Se eliminará solo el último lote agregado por la carga RRHH seleccionada. ¿Desea continuar?");
    if (!confirmed) return;

    setDeleteStatus("deleting");

    const url = selectedPeriod
      ? buildApiUrl(`/funcionarios/upload/latest?period_id=${selectedPeriod.id}`)
      : buildApiUrl("/funcionarios/upload/latest");

    try {
      const response = await fetchWithAuth(url, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || "No se pudo eliminar el último lote agregado");
      }

      setDeleteStatus("success");
      setUploadStatus("idle");
      setUploadStats(null);
      setFile(null);
      setDeleteByCreatedAtMessage(null);
      await loadDeleteBatchOptions({ showLoading: false });
    } catch (error) {
      console.error("Error eliminando último lote RRHH:", error);
      setDeleteStatus("error");
      alert(`Error: ${getErrorMessage(error, "No se pudo eliminar el último lote agregado")}`);
    }
  };

  const handleDeleteByCreatedAt = async () => {
    if (isReadOnly || !selectedDeleteBatch) return;

    const selectedLabel = deleteBatchOptions.find((option) => option.value === selectedDeleteBatch)?.label ?? selectedDeleteBatch;
    const confirmed = window.confirm(`Se eliminará el lote RRHH creado en ${selectedLabel}. ¿Desea continuar?`);
    if (!confirmed) return;

    setDeleteByCreatedAtStatus("deleting");
    setDeleteByCreatedAtMessage(null);

    const encodedCreatedAt = encodeURIComponent(selectedDeleteBatch);
    const url = selectedPeriod
      ? buildApiUrl(`/funcionarios/upload/by-created-at?period_id=${selectedPeriod.id}&created_at=${encodedCreatedAt}`)
      : buildApiUrl(`/funcionarios/upload/by-created-at?created_at=${encodedCreatedAt}`);

    try {
      const response = await fetchWithAuth(url, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || "No se pudo eliminar el lote RRHH seleccionado");
      }

      const data = await response.json() as { message?: string };
      setDeleteByCreatedAtStatus("success");
      setDeleteByCreatedAtMessage(data.message || "Lote RRHH eliminado correctamente.");
      setDeleteStatus("idle");
      setUploadStatus("idle");
      setUploadStats(null);
      setFile(null);
      await loadDeleteBatchOptions({ showLoading: false });
    } catch (error) {
      console.error("Error eliminando lote RRHH por fecha:", error);
      setDeleteByCreatedAtStatus("error");
      setDeleteByCreatedAtMessage(getErrorMessage(error, "No se pudo eliminar el lote RRHH seleccionado"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Recursos Humanos" 
        subtitle={
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span>Carga y gestión de datos de RRHH</span>
            <div className="flex items-center gap-2">
              {selectedPeriod && (
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-800">
                    Periodo: {selectedPeriod.name}
                </span>
              )}
              {isReadOnly && (
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="w-4 h-4" />
                    Modo Lectura
                </span>
              )}
            </div>
          </div>
        }
      >
        <ContextualHelpButton slug="rrhh" />
      </PageHeader>

      <RRHHUploadPanel
        isReadOnly={isReadOnly}
        dragActive={dragActive}
        file={file}
        uploadStatus={uploadStatus}
        deleteStatus={deleteStatus}
        deleteByCreatedAtStatus={deleteByCreatedAtStatus}
        deleteByCreatedAtMessage={deleteByCreatedAtMessage}
        deleteBatchOptions={deleteBatchOptions}
        selectedDeleteBatch={selectedDeleteBatch}
        uploadStats={uploadStats}
        onDragEnter={!isReadOnly ? handleDrag : undefined}
        onDragLeave={!isReadOnly ? handleDrag : undefined}
        onDragOver={!isReadOnly ? handleDrag : undefined}
        onDrop={!isReadOnly ? handleDrop : undefined}
        onFileChange={handleChange}
        onClearFile={(e) => {
          e.preventDefault();
          setFile(null);
          setUploadStatus("idle");
        }}
        onUpload={handleUpload}
        onDeleteLastAdded={handleDeleteLastAdded}
        onDeleteBatchChange={setSelectedDeleteBatch}
        onDeleteByCreatedAt={handleDeleteByCreatedAt}
      />
    </div>
  );
}
