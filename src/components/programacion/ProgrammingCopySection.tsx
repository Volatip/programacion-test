import { Copy, Search } from "lucide-react";
import type { Funcionario } from "../../context/OfficialsContext";
import { normalizeText } from "../../lib/normalizeText";

interface ProgrammingCopySectionProps {
  copySearchQuery: string;
  onCopySearchQueryChange: (value: string) => void;
  selectedCopyFuncionario: Funcionario | null;
  onSelectCopyFuncionario: (funcionario: Funcionario) => void;
  onClearSelectedCopyFuncionario: () => void;
  myOfficials: Funcionario[];
  funcionario: Funcionario;
  onCopyProgramming: () => void;
}

export function ProgrammingCopySection({
  copySearchQuery,
  onCopySearchQueryChange,
  selectedCopyFuncionario,
  onSelectCopyFuncionario,
  onClearSelectedCopyFuncionario,
  myOfficials,
  funcionario,
  onCopyProgramming,
}: ProgrammingCopySectionProps) {
  const filteredOfficials = myOfficials.filter(
    (candidate) =>
      (candidate.name.toLowerCase().includes(copySearchQuery.toLowerCase()) ||
        candidate.rut.includes(copySearchQuery)) &&
      candidate.id !== funcionario.id &&
      normalizeText(candidate.title) === normalizeText(funcionario.title),
  );

  return (
    <div className="mb-6 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-100 dark:border-orange-800">
      <label className="block text-sm font-medium text-orange-900 dark:text-orange-200 mb-2 flex items-center gap-2">
        <Copy className="w-4 h-4" />
        Copiar Programación
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={copySearchQuery}
            onChange={(event) => {
              const value = event.target.value;
              onCopySearchQueryChange(value);

              if (value === "") {
                onClearSelectedCopyFuncionario();
              }
            }}
            placeholder="Buscar funcionario para copiar..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-orange-200 dark:border-orange-700 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 outline-none transition-all text-gray-900 dark:text-white dark:placeholder-gray-400"
          />

          {copySearchQuery && !selectedCopyFuncionario && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-100 dark:border-gray-600 z-20 max-h-48 overflow-y-auto">
              {filteredOfficials.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => {
                    onSelectCopyFuncionario(candidate);
                    onCopySearchQueryChange(candidate.name);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-orange-50 dark:hover:bg-orange-900/30 flex items-center gap-2 transition-colors text-sm"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-medium ${candidate.color}`}>
                    {candidate.initial}
                  </div>
                  <div className="truncate">
                    <div className="font-medium text-gray-900 dark:text-white">{candidate.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{candidate.rut}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onCopyProgramming}
          disabled={!selectedCopyFuncionario}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          Copiar Programación
        </button>
      </div>
    </div>
  );
}
