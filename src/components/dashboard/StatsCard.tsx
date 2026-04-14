import React from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string; // Expecting a color class like "text-blue-600" or "bg-blue-600" context
  iconBgColor?: string; // Background for the icon circle
  className?: string;
  onClick?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  color,
  iconBgColor,
  className = '',
  onClick
}) => {
  return (
    <div 
      className={clsx(
        "group cursor-default rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 ease-in-out hover:shadow-md dark:border-gray-700 dark:bg-gray-800 xl:p-6",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 xl:text-sm">{title}</span>
          <span className="origin-left text-2xl font-bold text-gray-900 transition-transform duration-300 group-hover:scale-105 dark:text-white xl:text-3xl">
            {value}
          </span>
        </div>
        
        <div className={clsx(
          "rounded-xl p-2.5 transition-colors duration-300 xl:p-3",
          iconBgColor || "bg-gray-50 dark:bg-gray-700", 
          "group-hover:bg-opacity-80"
        )}>
          <Icon className={clsx("h-5 w-5 xl:h-6 xl:w-6", color)} />
        </div>
      </div>
    </div>
  );
};
