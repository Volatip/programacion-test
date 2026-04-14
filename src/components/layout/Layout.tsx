import { Outlet } from "react-router-dom";
import { AlertTriangle, History } from "lucide-react";
import { usePeriods } from "../../context/PeriodsContext";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function Layout() {
  const { isReadOnly, selectedPeriod } = usePeriods();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <Sidebar />
      <Header />
      <main className="min-h-screen pl-64 pt-16">
        <div className="mx-auto w-full max-w-[1920px] px-6 py-7 xl:px-8 xl:py-8 2xl:px-10 2xl:py-8">
          {isReadOnly && selectedPeriod && (
            <div className="mb-6 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-5 py-4 text-amber-900 dark:text-amber-100 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                  <div>
                    <p className="text-sm font-semibold">Está visualizando información histórica</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      El período <span className="font-semibold">{selectedPeriod.name}</span> corresponde a información pasada y no permite modificaciones.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 self-start rounded-full border border-amber-300 dark:border-amber-700 bg-white/70 dark:bg-amber-950/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                  <History className="h-3.5 w-3.5" />
                  Histórico
                </span>
              </div>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
