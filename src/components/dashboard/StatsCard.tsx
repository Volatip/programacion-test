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
        "bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300 ease-in-out cursor-default group",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-gray-500 dark:text-gray-400 text-sm font-medium tracking-wide uppercase">{title}</span>
          <span className="text-3xl font-bold text-gray-900 dark:text-white group-hover:scale-105 transition-transform duration-300 origin-left">
            {value}
          </span>
        </div>
        
        <div className={clsx(
          "p-3 rounded-xl transition-colors duration-300",
          iconBgColor || "bg-gray-50 dark:bg-gray-700", 
          "group-hover:bg-opacity-80"
        )}>
          <Icon className={clsx("w-6 h-6", color)} />
        </div>
      </div>
    </div>
  );
};
