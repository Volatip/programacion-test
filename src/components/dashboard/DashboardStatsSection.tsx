import type { LucideIcon } from "lucide-react";
import { StatsCard } from "./StatsCard";

interface DashboardStatItem {
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
  iconBgColor: string;
  className?: string;
}

interface DashboardStatsSectionProps {
  title: string;
  accentClassName: string;
  items: DashboardStatItem[];
}

export function DashboardStatsSection({
  title,
  accentClassName,
  items,
}: DashboardStatsSectionProps) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 px-1 xl:mb-5">
        <div className={`w-1 h-6 rounded-full ${accentClassName}`} />
        <h2 className="text-base font-semibold text-gray-800 transition-colors dark:text-gray-200 xl:text-lg">{title}</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:gap-6">
        {items.map((item) => (
          <StatsCard
            key={item.title}
            title={item.title}
            value={item.value}
            icon={item.icon}
            color={item.color}
            iconBgColor={item.iconBgColor}
            className={item.className}
          />
        ))}
      </div>
    </div>
  );
}
