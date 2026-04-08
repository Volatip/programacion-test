import type { SortDirection } from "../../lib/tableSorting";

interface SortableHeaderProps {
  label: string;
  className?: string;
  isActive: boolean;
  direction: SortDirection;
  onClick: () => void;
}

export function SortableHeader({
  label,
  className,
  isActive,
  direction,
  onClick,
}: SortableHeaderProps) {
  return (
    <th
      scope="col"
      className={className}
      aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-left transition-colors hover:text-gray-700 dark:hover:text-gray-200"
        aria-label={`Ordenar por ${label}`}
      >
        <span>{label}</span>
        <span aria-hidden="true" className={isActive ? "text-primary dark:text-blue-400" : "text-gray-300 dark:text-gray-500"}>
          {isActive ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
