import React, { useState } from "react";

interface HoursChartProps {
  data: {
    period: string;
    hours: number;
    shift_hours: number;
  }[];
  title: string;
  color?: string;
  shiftColor?: string;
}

export const HoursChart: React.FC<HoursChartProps> = ({
  data,
  title,
  color = "#4F46E5",
  shiftColor = "#14b8a6",
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex items-center justify-center h-96 transition-colors">
        <p className="text-gray-500 dark:text-gray-400">
          No hay datos disponibles para mostrar el grÃ¡fico.
        </p>
      </div>
    );
  }

  const maxHours = Math.max(...data.map((d) => Math.max(d.hours, d.shift_hours)), 1);

  const getHeight = (hours: number) => {
    return (hours / maxHours) * 100;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-full flex flex-col transition-colors">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-gray-900 dark:text-white text-lg font-semibold">{title}</h3>
        <div className="flex gap-4 text-xs font-medium text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span>Contrato</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: shiftColor }} />
            <span>Turno</span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative min-h-[300px] flex flex-col">
        <div className="flex-1 relative ml-8 mb-8 border-l border-b border-gray-200 dark:border-gray-700">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0">
            {[100, 75, 50, 25, 0].map((percentage) => (
              <div key={percentage} className="w-full flex items-center h-0 relative">
                <div className="w-full border-t border-gray-100 dark:border-gray-700 border-dashed" />
                <span className="absolute -left-8 text-xs text-gray-400 dark:text-gray-500 w-6 text-right transform -translate-y-1/2">
                  {Math.round((maxHours * percentage) / 100)}
                </span>
              </div>
            ))}
          </div>

          <div className="absolute inset-0 flex items-end justify-between gap-2 px-2 pt-4 z-10">
            {data.map((item, index) => (
              <div
                key={index}
                className="relative flex-1 h-full flex items-end justify-center gap-1 group"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {hoveredIndex === index && (
                  <div
                    className="absolute bottom-full mb-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded py-2 px-3 shadow-lg whitespace-nowrap z-20 pointer-events-none"
                    style={{
                      bottom: `${Math.max(getHeight(item.hours), getHeight(item.shift_hours))}%`,
                    }}
                  >
                    <div className="font-semibold text-center mb-1">{item.period}</div>
                    <div className="flex gap-3">
                      <div className="text-center">
                        <span className="block text-[10px] text-gray-400">Contrato</span>
                        {item.hours.toFixed(0)} hrs
                      </div>
                      <div className="text-center border-l border-gray-700 pl-3">
                        <span className="block text-[10px] text-gray-400">Turno</span>
                        {item.shift_hours.toFixed(0)} hrs
                      </div>
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                  </div>
                )}

                <div
                  className="w-full max-w-[20px] relative flex flex-col justify-end transition-all duration-300 ease-out hover:brightness-110"
                  style={{
                    height: `${getHeight(item.hours)}%`,
                    backgroundColor: color,
                  }}
                />

                <div
                  className="w-full max-w-[20px] relative flex flex-col justify-end transition-all duration-300 ease-out hover:brightness-110"
                  style={{
                    height: `${getHeight(item.shift_hours)}%`,
                    backgroundColor: shiftColor,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-8 right-0 h-8 flex justify-between items-start gap-2 px-2">
          {data.map((item, index) => (
            <div key={index} className="flex-1 text-center">
              <span
                className="text-xs text-gray-500 dark:text-gray-400 truncate block w-full px-1"
                title={item.period}
              >
                {item.period}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
