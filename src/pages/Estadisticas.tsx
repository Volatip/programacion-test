import React, { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

import { ContextualHelpButton } from '../components/contextual-help/ContextualHelpButton';
import { ContractStatisticsSection } from '../components/dashboard/ContractStatisticsSection';
import { SupervisorScopePanel } from '../components/supervisor/SupervisorScopePanel';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import { usePeriods } from '../context/PeriodsContext';
import { useSupervisorScope } from '../context/SupervisorScopeContext';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useTheme } from '../hooks/useTheme';

interface GroupChartItem {
  name: string;
  hours: number;
  shift_hours: number;
  count: number;
  shift_count: number;
}

const Estadisticas = () => {
  const { user } = useAuth();
  const { selectedPeriod } = usePeriods();
  const { theme } = useTheme();
  const { isSupervisor, isScopeReady, selectedUser } = useSupervisorScope();
  const [hoveredGroup, setHoveredGroup] = useState<GroupChartItem | null>(null);
  const { stats, loading, error, fetchStats } = useDashboardStats({
    periodId: selectedPeriod?.id,
    userId: isSupervisor ? selectedUser?.id : undefined,
    enabled: Boolean(user) && (!isSupervisor || isScopeReady),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Calculando métricas del período...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center justify-between text-red-700 dark:text-red-300 transition-colors">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
          <button
            onClick={() => fetchStats()}
            className="flex items-center gap-1 px-3 py-1 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        pageSlug="estadisticas"
        title="Estadísticas"
        defaultSubtitle=""
        allowEmptySubtitle
        normalizePersistedSubtitle={(subtitle) => {
          const periodName = stats?.summary.period_name || 'Período Actual';
          const supervisorLabel = selectedUser ? `${periodName} · ${selectedUser.name}` : null;

          if (subtitle.trim() === periodName || (supervisorLabel && subtitle.trim() === supervisorLabel)) {
            return '';
          }

          return subtitle.trim();
        }}
        subtitleRenderer={(baseSubtitle) => {
          const periodName = stats?.summary.period_name || 'Período Actual';

          if (isSupervisor && selectedUser) {
            return <p>{baseSubtitle ? `${baseSubtitle} · ${periodName} · ${selectedUser.name}` : `${periodName} · ${selectedUser.name}`}</p>;
          }

          return <p>{baseSubtitle ? `${baseSubtitle} · ${periodName}` : periodName}</p>;
        }}
      >
        <ContextualHelpButton slug="estadisticas" />
      </PageHeader>

      <SupervisorScopePanel blocking={isSupervisor && !isScopeReady} />

      {isSupervisor && !isScopeReady ? null : (
        <ContractStatisticsSection
          selectedPeriod={selectedPeriod}
          summary={stats?.summary || { period_name: '', shift_hours: 0, shift_officials_count: 0 }}
          chartData={stats?.chart_data || []}
          groupChartData={stats?.group_chart_data}
          hoveredGroup={hoveredGroup}
          onHoverGroup={setHoveredGroup}
          theme={theme}
        />
      )}
    </div>
  );
};

export default Estadisticas;
