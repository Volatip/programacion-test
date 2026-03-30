import {
  AlertCircle,
  CheckCircle,
  Download,
  FileSpreadsheet,
  Trash2,
  Upload,
} from "lucide-react";

interface UploadConfig {
  id: string;
  title: string;
  description: string;
}

interface CargaUploadPanelProps {
  activeConfig: UploadConfig;
  selectedPeriodName: string;
  isReadOnly: boolean;
  dragActive: boolean;
  file: File | null;
  uploadStatus: "idle" | "uploading" | "success" | "error";
  uploadMessage: string;
  onDelete: () => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onUpload: () => void;
  onDownloadTemplate: () => void;
}

export function CargaUploadPanel({
  activeConfig,
  selectedPeriodName,
  isReadOnly,
  dragActive,
  file,
  uploadStatus,
  uploadMessage,
  onDelete,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileChange,
  onClearFile,
  onUpload,
  onDownloadTemplate,
}: CargaUploadPanelProps) {
  return (
    <div className="lg:col-span-3">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 h-full transition-colors">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {activeConfig.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{activeConfig.description}</p>
          </div>
          {activeConfig.id !== "other" && !isReadOnly && (
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-3 py-1.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-sm font-medium transition-colors"
              title={`Eliminar todo el listado actual de ${activeConfig.title} para ${selectedPeriodName}`}
            >
              <Trash2 className="w-4 h-4" />
              Eliminar Listado
            </button>
          )}
        </div>

        <div
          className={`relative border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center text-center min-h-[300px] ${
            isReadOnly
              ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 cursor-not-allowed"
              : dragActive
                ? "border-primary bg-primary/5 dark:bg-primary/10"
                : "border-gray-300 dark:border-gray-600 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={onFileChange}
            accept=".xlsx, .xls"
            disabled={isReadOnly}
          />

          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isReadOnly ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500" : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"}`}>
            <FileSpreadsheet className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {isReadOnly ? "Carga deshabilitada" : "Carga tu archivo Excel"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
            {isReadOnly
              ? "No se pueden cargar archivos en un periodo histórico."
              : "Arrastra y suelta tu archivo aquí, o haz clic para seleccionar."}
          </p>

          {file && (
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 max-w-full z-10 relative">
              <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                {file.name}
              </span>
              <button
                onClick={onClearFile}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
              >
                <AlertCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            onClick={onUpload}
            disabled={!file || uploadStatus === "uploading" || uploadStatus === "success" || isReadOnly}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-medium transition-all shadow-sm ${
              !file || isReadOnly
                ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                : uploadStatus === "success"
                  ? "bg-green-600 text-white cursor-default"
                  : "bg-primary text-white hover:bg-primary/90 hover:shadow"
            }`}
          >
            {uploadStatus === "uploading" ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : uploadStatus === "success" ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Carga Exitosa
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Procesar Archivo
              </>
            )}
          </button>

          <button
            onClick={onDownloadTemplate}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm flex items-center gap-2 transition-colors px-4 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <Download className="w-4 h-4" />
            Descargar Plantilla
          </button>

          {(uploadStatus === "success" || uploadStatus === "error") && uploadMessage && (
            <div
              className={`w-full p-4 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 ${
                uploadStatus === "success"
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              }`}
            >
              {uploadStatus === "success" ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              )}
              <div>
                <h4 className={`font-medium ${uploadStatus === "success" ? "text-green-900 dark:text-green-300" : "text-red-900 dark:text-red-300"}`}>
                  {uploadStatus === "success" ? "¡Operación completada!" : "Error en la operación"}
                </h4>
                <p className={`text-sm mt-1 ${uploadStatus === "success" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                  {uploadMessage}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
