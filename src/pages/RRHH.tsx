import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { RRHHUploadPanel } from "../components/rrhh/RRHHUploadPanel";
import { usePeriods } from "../context/PeriodsContext";
import { PageHeader } from "../components/ui/PageHeader";
import { buildApiUrl, fetchWithAuth } from "../lib/api";
import { ContextualHelpButton } from "../components/contextual-help/ContextualHelpButton";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function RRHH() {
  const [dragActive, setDragActive] = useState(false);
  const { selectedPeriod, isReadOnly } = usePeriods();
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");

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
    } catch (error) {
      console.error("Error:", error);
      setUploadStatus("error");
      alert(`Error: ${getErrorMessage(error, "Hubo un error al procesar el archivo")}`);
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
      />
    </div>
  );
}
