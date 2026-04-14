import React, { useEffect, useRef, useState } from "react";

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
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex items-center justify-center h-96 transition-colors">
        <p className="text-gray-500 dark:text-gray-400">
          No hay datos disponibles para mostrar el gráfico.
        </p>
      </div>
    );
  }

  const maxHours = Math.max(...data.map((d) => Math.max(d.hours, d.shift_hours)), 1);

  const getHeight = (hours: number) => {
    return (hours / maxHours) * 100;
  };

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;

    const updateSize = () => {
      setChartWidth((current) => {
        const next = element.clientWidth;
        return current === next ? current : next;
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);
    window.addEventListener("resize", updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const isCompact = chartWidth > 0 && chartWidth < 860;
  const chartLabelSize = isCompact ? "text-[11px]" : "text-xs";
  const gridOffsetClass = isCompact ? "ml-6 mb-7" : "ml-8 mb-8";
  const xAxisOffsetClass = isCompact ? "left-6 h-7" : "left-8 h-8";
  const barWidthClass = isCompact ? "max-w-[16px]" : "max-w-[20px]";

  return (
    <div ref={chartRef} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-full flex flex-col transition-colors ${isCompact ? "p-4" : "p-6"}`}>
      <div className={`flex items-start justify-between ${isCompact ? "mb-4 gap-3" : "mb-6 gap-4"}`}>
        <h3 className={`text-gray-900 dark:text-white font-semibold ${isCompact ? "text-base" : "text-lg"}`}>{title}</h3>
        <div className={`flex flex-wrap justify-end font-medium text-gray-600 dark:text-gray-300 ${isCompact ? "gap-2 text-[11px]" : "gap-4 text-xs"}`}>
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

      <div className={`relative flex flex-1 flex-col ${isCompact ? "min-h-[260px]" : "min-h-[300px]"}`}>
        <div className={`relative flex-1 border-l border-b border-gray-200 dark:border-gray-700 ${gridOffsetClass}`}>
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0">
            {[100, 75, 50, 25, 0].map((percentage) => (
              <div key={percentage} className="w-full flex items-center h-0 relative">
                <div className="w-full border-t border-gray-100 dark:border-gray-700 border-dashed" />
                <span className={`absolute w-6 -translate-y-1/2 text-right text-gray-400 dark:text-gray-500 ${isCompact ? "-left-6 text-[10px]" : "-left-8 text-xs"}`}>
                  {Math.round((maxHours * percentage) / 100)}
                </span>
              </div>
            ))}
          </div>

          <div className={`absolute inset-0 z-10 flex items-end justify-between px-2 ${isCompact ? "gap-1 pt-3" : "gap-2 pt-4"}`}>
            {data.map((item, index) => (
              <div
                key={index}
                className="relative flex-1 h-full flex items-end justify-center gap-1 group"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {hoveredIndex === index && (
                  <div
                    className={`absolute bottom-full mb-2 z-20 whitespace-nowrap rounded bg-gray-900 px-3 py-2 text-white shadow-lg pointer-events-none dark:bg-gray-700 ${chartLabelSize}`}
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
                    className={`relative flex w-full flex-col justify-end transition-all duration-300 ease-out hover:brightness-110 ${barWidthClass}`}
                  style={{
                    height: `${getHeight(item.hours)}%`,
                    backgroundColor: color,
                  }}
                />

                <div
                    className={`relative flex w-full flex-col justify-end transition-all duration-300 ease-out hover:brightness-110 ${barWidthClass}`}
                  style={{
                    height: `${getHeight(item.shift_hours)}%`,
                    backgroundColor: shiftColor,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className={`absolute bottom-0 right-0 flex items-start justify-between gap-2 px-2 ${xAxisOffsetClass}`}>
          {data.map((item, index) => (
            <div key={index} className="flex-1 text-center">
              <span
                className={`block w-full truncate px-1 text-gray-500 dark:text-gray-400 ${chartLabelSize}`}
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
