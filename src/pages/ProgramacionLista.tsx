import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Calendar, Clock } from "lucide-react";
import { useOfficials, Funcionario } from "../context/OfficialsContext";
import { ProgrammingModal } from "../components/programacion/ProgrammingModal";
import { useProgrammingClassification } from "../hooks/useProgrammingClassification";
import { ContextualHelpButton } from "../components/contextual-help/ContextualHelpButton";
import { APP_ROUTES } from "../lib/appPaths";
import { useSupervisorScope } from "../context/SupervisorScopeContext";
import { SupervisorScopePanel } from "../components/supervisor/SupervisorScopePanel";

interface ProgramacionListaProps {
  type: "scheduled" | "unscheduled";
}

export function ProgramacionLista({ type }: ProgramacionListaProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSupervisor, isScopeReady } = useSupervisorScope();
  const { officials: myOfficials } = useOfficials();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOfficial, setSelectedOfficial] = useState<Funcionario | null>(null);
  
  const { isProgrammed } = useProgrammingClassification();

  const isScheduled = type === "scheduled";
  const title = isScheduled ? "Funcionarios Programados" : "Funcionarios No Programados";
  const helpSlug = isScheduled ? "programacion-programados" : "programacion-no-programados";
  const Icon = isScheduled ? Calendar : Clock;
  const colorClass = isScheduled ? "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30" : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
  
  // Filter officials based on type
  // AND Filter by Active status as per requirement
  const listOfficials = myOfficials
    .filter(f => (isScheduled ? isProgrammed(f) : (f.status === 'activo' && !isProgrammed(f))))
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    const selectedOfficialId = (location.state as { selectedOfficialId?: number } | null)?.selectedOfficialId;
    if (!selectedOfficialId) {
      return;
    }

    const officialToOpen = listOfficials.find((official) => official.id === selectedOfficialId);
    if (officialToOpen) {
      setSelectedOfficial(officialToOpen);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [listOfficials, location.pathname, location.state, navigate]);
  
  const filteredOfficials = searchQuery
    ? listOfficials.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.rut.includes(searchQuery)
      )
    : listOfficials;

  const selectedOfficialIndex = selectedOfficial
    ? filteredOfficials.findIndex((f) => f.id === selectedOfficial.id)
    : -1;

  const hasPreviousOfficial = selectedOfficialIndex > 0;
  const hasNextOfficial = selectedOfficialIndex !== -1 && selectedOfficialIndex < filteredOfficials.length - 1;

  const handlePreviousOfficial = () => {
    if (!hasPreviousOfficial) return;
    setSelectedOfficial(filteredOfficials[selectedOfficialIndex - 1]);
  };

  const handleNextOfficial = () => {
    if (!hasNextOfficial) {
      setSelectedOfficial(null); // Close if last one
      return;
    }

    setSelectedOfficial(filteredOfficials[selectedOfficialIndex + 1]);
  };

  // Helper to get formatted display text for contract hours
  const getContractHoursDisplay = (func: Funcionario) => {
    // If we have detailed contracts, use them
    if (func.contracts && func.contracts.length > 0) {
        const contractStrings = func.contracts.map(c => `${c.hours} hrs`);
        
        if (contractStrings.length === 1) {
            return contractStrings[0];
        } else if (contractStrings.length > 1) {
            const last = contractStrings.pop();
            return `${contractStrings.join(', ')} y ${last}`;
        }
    }
    
    // Fallback for when no contracts array but we have the string "X hrs y Y hrs"
    if (typeof func.hours === 'string' && func.hours.includes(' y ')) {
        const parts = func.hours.split(' y ');
        if (parts.length > 1) {
             const last = parts.pop();
             return `${parts.join(', ')} y ${last}`;
        }
    }
    
    return typeof func.hours === 'string' ? func.hours : `${func.hours} hrs.`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(APP_ROUTES.programming)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${colorClass}`}>
              <Icon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{title}</h1>
              <p className="text-lg text-gray-500 dark:text-gray-400 mt-1">{listOfficials.length} funcionarios</p>
            </div>
          </div>
        </div>
        <ContextualHelpButton slug={helpSlug} />
      </div>

      <SupervisorScopePanel blocking={isSupervisor && !isScopeReady} />

      {isSupervisor && !isScopeReady ? null : (
        <>
          {/* Search Section */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Buscar en ${title.toLowerCase()}...`}
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-gray-900 dark:text-white dark:placeholder-gray-500"
              />
            </div>
          </div>

          {/* Officials List */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            {filteredOfficials.length > 0 ? (
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {filteredOfficials.map((func) => (
                  <button
                    key={func.id}
                    onClick={() => setSelectedOfficial(func)}
                    className="w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-4 transition-colors text-left group"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${func.color} shrink-0`}>
                      {func.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">{func.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{func.title} • {func.rut}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                        <div className="text-xs text-gray-400 dark:text-gray-500">Horas Contrato</div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{getContractHoursDisplay(func)}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No se encontraron funcionarios en esta lista.
              </div>
            )}
          </div>

          {/* Programming Modal */}
          {selectedOfficial && (
              <ProgrammingModal 
                funcionario={selectedOfficial} 
                onClose={() => setSelectedOfficial(null)}
                onPrevious={hasPreviousOfficial ? handlePreviousOfficial : undefined}
                onNext={hasNextOfficial ? handleNextOfficial : undefined}
              />
            )}
        </>
      )}
    </div>
  );
}
