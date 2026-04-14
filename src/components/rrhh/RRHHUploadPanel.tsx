import { AlertCircle, CheckCircle, FileSpreadsheet, Upload } from "lucide-react";

interface RRHHUploadStats {
  created: number;
  updated: number;
}

interface RRHHDeleteBatchOption {
  value: string;
  label: string;
}

interface RRHHUploadPanelProps {
  isReadOnly: boolean;
  dragActive: boolean;
  file: File | null;
  uploadStatus: "idle" | "uploading" | "success" | "error";
  deleteStatus: "idle" | "deleting" | "success" | "error";
  deleteByCreatedAtStatus: "idle" | "loading-options" | "deleting" | "success" | "error";
  deleteByCreatedAtMessage: string | null;
  deleteBatchOptions: RRHHDeleteBatchOption[];
  selectedDeleteBatch: string;
  uploadStats: RRHHUploadStats | null;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onUpload: () => void;
  onDeleteLastAdded: () => void;
  onDeleteBatchChange: (value: string) => void;
  onDeleteByCreatedAt: () => void;
}

export function RRHHUploadPanel({
  isReadOnly,
  dragActive,
  file,
  uploadStatus,
  deleteStatus,
  deleteByCreatedAtStatus,
  deleteByCreatedAtMessage,
  deleteBatchOptions,
  selectedDeleteBatch,
  uploadStats,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileChange,
  onClearFile,
  onUpload,
  onDeleteLastAdded,
  onDeleteBatchChange,
  onDeleteByCreatedAt,
}: RRHHUploadPanelProps) {
  const isDeleteByCreatedAtBusy = deleteByCreatedAtStatus === "loading-options" || deleteByCreatedAtStatus === "deleting";

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

        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
          <button
            onClick={onUpload}
            disabled={!file || uploadStatus === "uploading" || uploadStatus === "success" || deleteStatus === "deleting" || isReadOnly}
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

          <button
            onClick={onDeleteLastAdded}
            disabled={uploadStatus === "uploading" || deleteStatus === "deleting" || isDeleteByCreatedAtBusy || isReadOnly}
            className={`flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-medium transition-all shadow-sm ${
              isReadOnly || uploadStatus === "uploading" || deleteStatus === "deleting" || isDeleteByCreatedAtBusy
                ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                : "bg-red-600 text-white hover:bg-red-700 hover:shadow"
            }`}
          >
            {deleteStatus === "deleting" ? "Eliminando..." : "Eliminar últimos agregados"}
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Eliminar lote por fecha de creación</h4>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Seleccione una fecha disponible del campo <code>created_at</code> para revertir cargas antiguas sin depender del tracking del último lote.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={selectedDeleteBatch}
                onChange={(event) => onDeleteBatchChange(event.target.value)}
                disabled={isReadOnly || isDeleteByCreatedAtBusy || deleteBatchOptions.length === 0}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="" disabled>
                  {deleteByCreatedAtStatus === "loading-options"
                    ? "Cargando fechas reversibles..."
                    : deleteBatchOptions.length > 0
                      ? "Seleccione una fecha de creación"
                      : "No hay fechas reversibles disponibles"}
                </option>
                {deleteBatchOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                onClick={onDeleteByCreatedAt}
                disabled={isReadOnly || uploadStatus === "uploading" || deleteStatus === "deleting" || isDeleteByCreatedAtBusy || !selectedDeleteBatch}
                className={`flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all shadow-sm ${
                  isReadOnly || uploadStatus === "uploading" || deleteStatus === "deleting" || isDeleteByCreatedAtBusy || !selectedDeleteBatch
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
                    : "bg-red-700 text-white hover:bg-red-800 hover:shadow"
                }`}
              >
                {deleteByCreatedAtStatus === "deleting" ? "Eliminando lote..." : "Eliminar por fecha"}
              </button>
            </div>

            {deleteByCreatedAtMessage && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  deleteByCreatedAtStatus === "error"
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                }`}
              >
                {deleteByCreatedAtMessage}
              </div>
            )}
          </div>
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

        {deleteStatus === "success" && (
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900 dark:text-amber-300">Último lote eliminado</h4>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Se revirtió solo el último lote agregado por RRHH para el período seleccionado.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
