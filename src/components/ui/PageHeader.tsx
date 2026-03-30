import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, children }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 transition-colors">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{title}</h1>
        {subtitle && <div className="text-lg text-gray-500 dark:text-gray-400 mt-1">{subtitle}</div>}
      </div>
      {children && (
        <div className="flex items-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
};
