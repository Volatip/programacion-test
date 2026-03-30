import React, { useState } from 'react';
import { DashboardStatsSection } from "../components/dashboard/DashboardStatsSection";
import { GroupHoursChart } from "../components/dashboard/GroupHoursChart";
import { PeriodDetailsPanel } from "../components/dashboard/PeriodDetailsPanel";
import { PageHeader } from "../components/ui/PageHeader";
import { usePeriods } from "../context/PeriodsContext";
import { useAuth } from "../context/AuthContext";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { useTheme } from "../hooks/useTheme";
import { HoursChart } from "../components/dashboard/HoursChart";
import { Users, Activity, FileText, AlertCircle, RefreshCw } from "lucide-react";

interface GroupChartItem {
  name: string;
  hours: number;
  shift_hours: number;
  count: number;
  shift_count: number;
}

const Home = () => {
  const { user } = useAuth();
  const { selectedPeriod } = usePeriods();
  const { theme } = useTheme();
  const [hoveredGroup, setHoveredGroup] = useState<GroupChartItem | null>(null);
  const { stats, loading, error, fetchStats } = useDashboardStats({
    periodId: selectedPeriod?.id,
    enabled: Boolean(user),
  });
  const summary = stats?.summary;
  const operationalStats = [
    {
      title: "Funcionarios Activos",
      value: summary?.active_officials || 0,
      icon: Users,
      color: "text-indigo-600 dark:text-indigo-400",
      iconBgColor: "bg-indigo-50 dark:bg-indigo-900/20",
      className: "border-l-4 border-l-indigo-500 dark:border-l-indigo-400",
    },
    {
      title: "Programados",
      value: summary?.programmed || 0,
      icon: FileText,
      color: "text-emerald-600 dark:text-emerald-400",
      iconBgColor: "bg-emerald-50 dark:bg-emerald-900/20",
      className: "border-l-4 border-l-emerald-500 dark:border-l-emerald-400",
    },
    {
      title: "Sin Programación",
      value: summary?.unprogrammed || 0,
      icon: AlertCircle,
      color: "text-amber-600 dark:text-amber-400",
      iconBgColor: "bg-amber-50 dark:bg-amber-900/20",
      className: "border-l-4 border-l-amber-500 dark:border-l-amber-400",
    },
  ];
  const inactiveStats = [
    {
      title: "Total Inactivos",
      value: summary?.inactive_total || 0,
      icon: Users,
      color: "text-gray-600 dark:text-gray-400",
      iconBgColor: "bg-gray-100 dark:bg-gray-800",
      className: "border-l-4 border-l-gray-400 dark:border-l-gray-500 opacity-90 hover:opacity-100",
    },
    {
      title: "Por Renuncia",
      value: summary?.inactive_resignation || 0,
      icon: FileText,
      color: "text-rose-600 dark:text-rose-400",
      iconBgColor: "bg-rose-50 dark:bg-rose-900/20",
      className: "border-l-4 border-l-rose-500 dark:border-l-rose-400 opacity-90 hover:opacity-100",
    },
    {
      title: "Por Movilidad",
      value: summary?.inactive_mobility || 0,
      icon: Activity,
      color: "text-violet-600 dark:text-violet-400",
      iconBgColor: "bg-violet-50 dark:bg-violet-900/20",
      className: "border-l-4 border-l-violet-500 dark:border-l-violet-400 opacity-90 hover:opacity-100",
    },
  ];

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
        title="Resumen de Programación"
        subtitle={`${stats?.summary.period_name || 'Período Actual'}`}
      />

      <div className="space-y-8">
        <DashboardStatsSection
          title="Estado Operativo"
          accentClassName="bg-indigo-500 dark:bg-indigo-400"
          items={operationalStats}
        />

        <DashboardStatsSection
          title="Inactividad y Movimientos"
          accentClassName="bg-rose-500 dark:bg-rose-400"
          items={inactiveStats}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-96">
          <HoursChart
            title="Horas Contrato por Período"
            data={stats?.chart_data || []}
            color={theme === 'dark' ? '#818cf8' : '#4F46E5'}
            shiftColor={theme === 'dark' ? '#2dd4bf' : '#14b8a6'}
          />
        </div>

        <PeriodDetailsPanel
          selectedPeriod={selectedPeriod}
          summary={stats?.summary || { period_name: "", shift_hours: 0, shift_officials_count: 0 }}
          chartData={stats?.chart_data || []}
        />
      </div>

      {stats?.group_chart_data && stats.group_chart_data.length > 0 && (
        <GroupHoursChart
          data={stats.group_chart_data}
          hoveredGroup={hoveredGroup}
          onHoverGroup={setHoveredGroup}
          theme={theme}
        />
      )}
    </div>
  );
};

export default Home;
