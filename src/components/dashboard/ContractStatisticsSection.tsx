import React from 'react';
import { GroupHoursChart } from './GroupHoursChart';
import { PeriodDetailsPanel } from './PeriodDetailsPanel';
import { HoursChart } from './HoursChart';
import type { Period } from '../../context/PeriodsContextDefs';
import type { DashboardStats } from '../../hooks/useDashboardStats';

interface GroupChartItem {
  name: string;
  hours: number;
  shift_hours: number;
  count: number;
  shift_count: number;
}

interface ContractStatisticsSectionProps {
  selectedPeriod: Period | null;
  summary: Pick<DashboardStats['summary'], 'period_name' | 'shift_hours' | 'shift_officials_count'>;
  chartData: DashboardStats['chart_data'];
  groupChartData?: DashboardStats['group_chart_data'];
  hoveredGroup: GroupChartItem | null;
  onHoverGroup: (group: GroupChartItem | null) => void;
  theme: 'light' | 'dark';
}

export function ContractStatisticsSection({
  selectedPeriod,
  summary,
  chartData,
  groupChartData,
  hoveredGroup,
  onHoverGroup,
  theme,
}: ContractStatisticsSectionProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 xl:gap-8">
        <div className="h-[22rem] lg:col-span-2 xl:h-96">
          <HoursChart
            title="Horas Contrato por Período"
            data={chartData}
            color={theme === 'dark' ? '#818cf8' : '#4F46E5'}
            shiftColor={theme === 'dark' ? '#2dd4bf' : '#14b8a6'}
          />
        </div>

        <PeriodDetailsPanel
          selectedPeriod={selectedPeriod}
          summary={summary}
          chartData={chartData}
        />
      </div>

      {groupChartData && groupChartData.length > 0 && (
        <GroupHoursChart
          data={groupChartData}
          hoveredGroup={hoveredGroup}
          onHoverGroup={onHoverGroup}
          theme={theme}
        />
      )}
    </>
  );
}
