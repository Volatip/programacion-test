
import { AlertCircle, Settings, Activity, GitMerge, Database, Building2 } from "lucide-react";
import { useState } from "react";
import { CargaOptionsSidebar } from "../components/carga/CargaOptionsSidebar";
import { CargaUploadPanel } from "../components/carga/CargaUploadPanel";
import { usePeriods } from "../context/PeriodsContext";
import { PageHeader } from "../components/ui/PageHeader";
import { buildApiUrl, fetchWithAuth } from "../lib/api";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

type UploadType = "specialties" | "processes" | "activities" | "performance_units" | "other";

interface UploadConfig {
  id: UploadType;
  title: string;
  description: string;
  endpoint: string;
  templateEndpoint: string;
  icon: React.ElementType;
}

const UPLOAD_OPTIONS: UploadConfig[] = [
  {
    id: "specialties",
    title: "Especialidades",
    description: "Carga masiva de especialidades y sus estadísticas (rendimiento, consulta nueva, etc.)",
    endpoint: "/api/config/specialties/upload",
    templateEndpoint: "/api/config/specialties/template",
    icon: Database
  },
  {
    id: "performance_units",
    title: "Unidades de Desempeño",
    description: "Catálogo de unidades de desempeño para Ley 15076",
    endpoint: "/api/config/performance-units/upload",
    templateEndpoint: "/api/config/performance-units/template",
    icon: Building2
  },
  {
    id: "processes",
    title: "Procesos",
    description: "Catálogo de procesos disponibles para la programación",
    endpoint: "/api/config/processes/upload",
    templateEndpoint: "/api/config/processes/template",
    icon: GitMerge
  },
  {
    id: "activities",
    title: "Tipos de Actividad",
    description: "Definición de tipos de actividades para funcionarios",
    endpoint: "/api/config/activities/upload",
    templateEndpoint: "/api/config/activities/template",
    icon: Activity
  },
  {
    id: "other",
    title: "Otros",
    description: "Otras configuraciones del sistema",
    endpoint: "/api/config/other/upload",
    templateEndpoint: "/api/config/other/template",
    icon: Settings
  }
];

export function Carga() {
  const { selectedPeriod, isReadOnly } = usePeriods();
  const [selectedType, setSelectedType] = useState<UploadType>("specialties");
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState<string>("");

  const activeConfig = UPLOAD_OPTIONS.find(o => o.id === selectedType) || UPLOAD_OPTIONS[0];

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
      setUploadMessage("");
    } else {
      alert("Por favor sube un archivo Excel válido (.xlsx, .xls)");
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedPeriod) return;
    
    setUploadStatus("uploading");
    setUploadMessage("");
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetchWithAuth(buildApiUrl(`${activeConfig.endpoint}?period_id=${selectedPeriod.id}`), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || "Error al subir el archivo");
      }

      const data = await response.json();
      setUploadMessage(data.message || "Archivo procesado correctamente");
      setUploadStatus("success");
    } catch (error) {
      console.error("Error:", error);
      setUploadStatus("error");
      setUploadMessage(getErrorMessage(error, "Hubo un error al procesar el archivo"));
    }
  };

  const handleDelete = async () => {
    if (!selectedPeriod) return;
    if (activeConfig.id === "other") return;
    
    if (!confirm(`¿Estás seguro de eliminar todo el listado de ${activeConfig.title} para el periodo ${selectedPeriod.name}? Esta acción no se puede deshacer.`)) {
        return;
    }

    setUploadStatus("uploading");
    setUploadMessage("");

    try {
        const deleteEndpoint = activeConfig.endpoint.replace("/upload", "");
        const response = await fetchWithAuth(buildApiUrl(`${deleteEndpoint}?period_id=${selectedPeriod.id}`), {
            method: "DELETE",
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            throw new Error(errorData.detail || "Error al eliminar el listado");
        }

        const data = await response.json();
        setUploadMessage(data.message || "Listado eliminado correctamente");
        setUploadStatus("success");
        setFile(null); // Reset file if any
    } catch (error) {
        console.error("Error:", error);
        setUploadStatus("error");
        setUploadMessage(getErrorMessage(error, "Hubo un error al eliminar el listado"));
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetchWithAuth(buildApiUrl(activeConfig.templateEndpoint));
      if (!response.ok) throw new Error("Error al descargar la plantilla");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_${activeConfig.id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      alert("Error al descargar la plantilla");
    }
  };

  if (!selectedPeriod) {
    return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center p-6">
            <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No hay periodo seleccionado</h2>
            <p className="text-gray-500 dark:text-gray-400">Por favor selecciona un periodo activo para gestionar la carga de datos.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Carga de Datos" 
        subtitle={
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span>Gestión de catálogos para: <span className="font-medium text-primary dark:text-blue-400">{selectedPeriod?.name}</span></span>
            {isReadOnly && (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-4 h-4" />
                  Modo Lectura - Periodo Histórico
              </span>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <CargaOptionsSidebar
          options={UPLOAD_OPTIONS}
          selectedType={selectedType}
          onSelect={(id) => {
            setSelectedType(id as UploadType);
            setFile(null);
            setUploadStatus("idle");
            setUploadMessage("");
          }}
        />

        <CargaUploadPanel
          activeConfig={activeConfig}
          selectedPeriodName={selectedPeriod.name}
          isReadOnly={isReadOnly}
          dragActive={dragActive}
          file={file}
          uploadStatus={uploadStatus}
          uploadMessage={uploadMessage}
          onDelete={handleDelete}
          onDragEnter={!isReadOnly ? handleDrag : undefined}
          onDragLeave={!isReadOnly ? handleDrag : undefined}
          onDragOver={!isReadOnly ? handleDrag : undefined}
          onDrop={!isReadOnly ? handleDrop : undefined}
          onFileChange={handleChange}
          onClearFile={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setFile(null);
            setUploadStatus("idle");
          }}
          onUpload={handleUpload}
          onDownloadTemplate={handleDownloadTemplate}
        />
      </div>
    </div>
  );
}
