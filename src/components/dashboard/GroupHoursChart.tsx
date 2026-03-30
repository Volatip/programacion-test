import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartTooltipEntry {
  color: string;
  name: string;
  value?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string;
}

interface GroupChartItem {
  name: string;
  hours: number;
  shift_hours: number;
  count: number;
  shift_count: number;
}

interface GroupHoursChartProps {
  data: GroupChartItem[];
  hoveredGroup: GroupChartItem | null;
  onHoverGroup: (group: GroupChartItem | null) => void;
  theme: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-100 dark:border-gray-700 shadow-lg rounded-xl text-xs transition-colors">
        <p className="font-bold text-gray-800 dark:text-gray-200 mb-1">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, index: number) => (
            <p key={index} style={{ color: entry.color }} className="font-medium">
              {entry.name}: {entry.value?.toLocaleString()} hrs
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function GroupHoursChart({
  data,
  hoveredGroup,
  onHoverGroup,
  theme,
}: GroupHoursChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 400 });

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const nextWidth = Math.max(element.clientWidth, 0);
      const nextHeight = Math.max(element.clientHeight, 400);
      setChartSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(element);
    window.addEventListener("resize", updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-8 transition-all hover:shadow-md transition-colors min-w-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Horas Contrato por Grupo</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Distribución de horas en el período actual</p>
        </div>

        <div className="flex items-center gap-6 bg-indigo-50/50 dark:bg-indigo-900/20 px-6 py-3 rounded-2xl border border-indigo-100 dark:border-indigo-800 transition-colors">
          <div className="text-right">
            <p className="text-xs text-indigo-500 dark:text-indigo-400 uppercase tracking-wider font-semibold">
              {hoveredGroup ? hoveredGroup.name : "Total Grupos"}
            </p>
            <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
              {hoveredGroup
                ? hoveredGroup.hours.toLocaleString()
                : data.reduce((acc, curr) => acc + curr.hours, 0).toLocaleString()}{" "}
              <span className="text-sm font-medium text-indigo-400">hrs</span>
            </p>
          </div>
          <div className="h-10 w-px bg-indigo-200 dark:bg-indigo-700" />
          <div>
            <p className="text-xs text-indigo-500 dark:text-indigo-400 uppercase tracking-wider font-semibold">Funcionarios</p>
            <div className="flex gap-4">
              <div>
                <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                  {hoveredGroup ? hoveredGroup.count : data.reduce((acc, curr) => acc + curr.count, 0)}
                </p>
                <p className="text-[10px] text-indigo-400">Contrato</p>
              </div>
              <div>
                <p className="text-lg font-bold text-teal-700 dark:text-teal-300">
                  {hoveredGroup ? hoveredGroup.shift_count : data.reduce((acc, curr) => acc + (curr.shift_count || 0), 0)}
                </p>
                <p className="text-[10px] text-teal-500 dark:text-teal-400">Turno</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div ref={chartContainerRef} className="h-[400px] w-full min-w-0 min-h-[400px]">
        {chartSize.width > 0 && (
          <BarChart
            width={chartSize.width}
            height={chartSize.height}
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
            onMouseMove={(state) => {
              if (state.activeTooltipIndex !== undefined) {
                onHoverGroup(data[state.activeTooltipIndex] ?? null);
              } else {
                onHoverGroup(null);
              }
            }}
            onMouseLeave={() => onHoverGroup(null)}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#374151" : "#E5E7EB"} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: theme === "dark" ? "#9CA3AF" : "#6B7280", fontSize: 12 }}
              dy={10}
              interval={0}
              tickFormatter={(value) => (value.length > 15 ? `${value.substring(0, 15)}...` : value)}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: theme === "dark" ? "#9CA3AF" : "#6B7280", fontSize: 12 }}
              dx={-10}
            />
            <Tooltip
              cursor={{ fill: theme === "dark" ? "#1F2937" : "#F3F4F6" }}
              content={<CustomTooltip />}
            />
            <Legend />
            <Bar
              name="Contrato"
              dataKey="hours"
              fill={theme === "dark" ? "#818cf8" : "#4f46e5"}
              radius={[4, 4, 0, 0]}
              barSize={20}
              animationDuration={1000}
            />
            <Bar
              name="Turno"
              dataKey="shift_hours"
              fill={theme === "dark" ? "#2dd4bf" : "#14b8a6"}
              radius={[4, 4, 0, 0]}
              barSize={20}
              animationDuration={1000}
            />
          </BarChart>
        )}
      </div>
    </div>
  );
}
