import { Bell, Edit2, X } from "lucide-react";
import {
  buildHeaderInfoBarCountdownText,
  type HeaderInfoBarColor,
  type HeaderInfoBarConfig,
} from "../../lib/headerInfoBar";

const COLOR_CLASSNAMES: Record<HeaderInfoBarColor, string> = {
  default: "text-blue-800 dark:text-blue-200",
  blue: "text-sky-700 dark:text-sky-300",
  emerald: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-700 dark:text-amber-300",
  rose: "text-rose-700 dark:text-rose-300",
  violet: "text-violet-700 dark:text-violet-300",
};

interface HeaderInfoBarProps {
  infoConfig: HeaderInfoBarConfig;
  isAdmin: boolean;
  isInfoVisible: boolean;
  openEditModal: () => void;
  toggleInfoVisibility: () => void;
}

export function HeaderInfoBar({
  infoConfig,
  isAdmin,
  isInfoVisible,
  openEditModal,
  toggleInfoVisibility,
}: HeaderInfoBarProps) {
  const countdownText = buildHeaderInfoBarCountdownText(infoConfig.countdown);

  return (
    <div className="group relative min-w-0 flex-1">
      {isInfoVisible ? (
        <div className="inline-flex w-fit max-w-full items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 transition-all duration-300 dark:border-blue-800 dark:bg-blue-900/30 xl:gap-3 xl:px-4">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="min-w-0 whitespace-normal break-words text-xs font-medium leading-relaxed xl:max-w-[42rem] xl:text-sm 2xl:max-w-[52rem]">
            {infoConfig.segments.map((segment, index) => (
              <span key={segment.id} className={COLOR_CLASSNAMES[segment.color]}>
                {index > 0 ? " " : ""}
                {segment.text}
              </span>
            ))}
            {countdownText ? (
              <span className={COLOR_CLASSNAMES[infoConfig.countdown?.color ?? "amber"]}>
                {infoConfig.segments.length > 0 ? " " : ""}
                {countdownText}
              </span>
            ) : null}
          </p>

          <div className="ml-1 flex shrink-0 items-center gap-1 self-start border-l border-blue-200 pl-2 opacity-0 transition-opacity group-hover:opacity-100 dark:border-blue-700 xl:ml-2 xl:gap-2">
            {isAdmin && (
              <button
                onClick={openEditModal}
                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded text-blue-600 dark:text-blue-400"
                title="Editar mensaje"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={toggleInfoVisibility}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded text-blue-600 dark:text-blue-400"
              title="Ocultar mensaje"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        isAdmin && (
          <button
            onClick={toggleInfoVisibility}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors px-2 py-1 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 rounded-md"
          >
            <Bell className="w-3 h-3" />
            Mostrar barra informativa
          </button>
        )
      )}
    </div>
  );
}
