import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

interface ResponsiveTableProps {
  children: ReactNode;
  className?: string;
  tableClassName?: string;
  minWidthClassName?: string;
}

export function ResponsiveTable({
  children,
  className,
  tableClassName,
  minWidthClassName = "min-w-[960px]",
}: ResponsiveTableProps) {
  return (
    <div className={cn("w-full overflow-hidden", className)}>
      <div className="w-full overflow-x-auto overscroll-x-contain">
        <table className={cn("w-full text-left", minWidthClassName, tableClassName)}>
          {children}
        </table>
      </div>
    </div>
  );
}
