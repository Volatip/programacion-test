import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, children }) => {
  return (
    <div className="mb-6 flex flex-col justify-between gap-3 transition-colors md:flex-row md:items-center xl:gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white xl:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 text-base text-gray-500 dark:text-gray-400 xl:text-lg">{subtitle}</div>}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 xl:gap-3">
          {children}
        </div>
      )}
    </div>
  );
};
