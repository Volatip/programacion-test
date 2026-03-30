import { AlertCircle, CheckCircle, FileSpreadsheet, Upload } from "lucide-react";

interface RRHHUploadStats {
  created: number;
  updated: number;
}

interface RRHHUploadPanelProps {
  isReadOnly: boolean;
  dragActive: boolean;
  file: File | null;
  uploadStatus: "idle" | "uploading" | "success" | "error";
  uploadStats: RRHHUploadStats | null;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onUpload: () => void;
}

export function RRHHUploadPanel({
  isReadOnly,
  dragActive,
  file,
  uploadStatus,
  uploadStats,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileChange,
  onClearFile,
  onUpload,
}: RRHHUploadPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 transition-colors">
      <div className="max-w-2xl mx-auto">
        <div
          className={`relative border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center text-center ${
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
              : "Arrastra y suelta tu archivo aquí, o haz clic para seleccionar. Soporta archivos .xlsx y .xls"}
          </p>

          {file && (
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 max-w-full z-10 relative">
              <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                {file.name}
              </span>
              <button
                onClick={onClearFile}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors z-10"
              >
                <AlertCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-center">
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
                Cargar Datos
              </>
            )}
          </button>
        </div>

        {uploadStatus === "success" && (
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-green-900 dark:text-green-300">¡Archivo procesado correctamente!</h4>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                Los datos de Recursos Humanos han sido actualizados en el sistema.
              </p>
              {uploadStats && (
                <div className="mt-3 text-sm flex gap-4">
                  <span className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 px-2 py-1 rounded-md border border-green-200 dark:border-green-800">
                    Nuevos: <strong>{uploadStats.created}</strong>
                  </span>
                  <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-md border border-blue-200 dark:border-blue-800">
                    Actualizados: <strong>{uploadStats.updated}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
