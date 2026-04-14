import { useEffect, useState } from "react";
import { Bell, MinusCircle, Moon, PlusCircle, Sun } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePeriods } from "../../context/PeriodsContext";
import { useTheme } from "../../hooks/useTheme";
import { useHeaderInfoBar } from "../../hooks/useHeaderInfoBar";
import { Modal } from "../ui/Modal";
import { useWebSocket } from "../../context/WebSocketContext";
import { HeaderInfoBar } from "./HeaderInfoBar";
import { HeaderPeriodSelector } from "./HeaderPeriodSelector";
import { HeaderUserMenu } from "./HeaderUserMenu";
import { notificationsApi, parseJsonResponse, type NotificationItem, type NotificationSummary } from "../../lib/api";
import {
  buildHeaderInfoBarPlainText,
  createHeaderInfoBarSegment,
  getHeaderInfoBarEditableLength,
  HEADER_INFO_BAR_COLORS,
  HEADER_INFO_BAR_COLOR_LABELS,
  type HeaderInfoBarColor,
} from "../../lib/headerInfoBar";

export function Header() {
  const { user, logout } = useAuth();
  const { periods, selectedPeriod, setSelectedPeriod } = usePeriods();
  const { theme, toggleTheme } = useTheme();
  const { lastMessage, sendMessage } = useWebSocket();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAllNotifications, setMarkingAllNotifications] = useState(false);
  const [markingNotificationIds, setMarkingNotificationIds] = useState<number[]>([]);

  const {
    closeEditModal,
    error,
    handleSaveInfo,
    infoConfig,
    isEditModalOpen,
    isInfoVisible,
    openEditModal,
    setError,
    setTempInfoConfig,
    tempInfoConfig,
    toggleInfoVisibility,
  } = useHeaderInfoBar({
    lastMessage,
    onBroadcast: sendMessage,
    updatedBy: user?.name,
  });
  const isAdmin = user?.role === "admin";
  const editableLength = getHeaderInfoBarEditableLength(tempInfoConfig);

  const handleSegmentChange = (segmentId: string, field: "text" | "color", value: string) => {
    setTempInfoConfig((currentConfig) => ({
      ...currentConfig,
      segments: currentConfig.segments.map((segment) => (
        segment.id === segmentId
          ? {
              ...segment,
              text: field === "text" ? value : segment.text,
              color: field === "color" ? value as HeaderInfoBarColor : segment.color,
            }
          : segment
      )),
    }));
    if (error) setError("");
  };

  const handleAddSegment = () => {
    setTempInfoConfig((currentConfig) => ({
      ...currentConfig,
      segments: [...currentConfig.segments, createHeaderInfoBarSegment(currentConfig.segments.length)],
    }));
    if (error) setError("");
  };

  const handleRemoveSegment = (segmentId: string) => {
    setTempInfoConfig((currentConfig) => ({
      ...currentConfig,
      segments: currentConfig.segments.filter((segment) => segment.id !== segmentId),
    }));
    if (error) setError("");
  };

  const handleCountdownToggle = (enabled: boolean) => {
    setTempInfoConfig((currentConfig) => ({
      ...currentConfig,
      countdown: enabled
        ? currentConfig.countdown ?? {
            enabled: true,
            targetDate: "",
            prefix: "Quedan",
            suffix: "días para terminar el proceso!",
            color: "amber",
          }
        : null,
    }));
    if (error) setError("");
  };

  const handleCountdownChange = (field: "targetDate" | "prefix" | "suffix" | "color", value: string) => {
    setTempInfoConfig((currentConfig) => ({
      ...currentConfig,
      countdown: {
        enabled: true,
        targetDate: field === "targetDate" ? value : currentConfig.countdown?.targetDate ?? "",
        prefix: field === "prefix" ? value : currentConfig.countdown?.prefix ?? "Quedan",
        suffix: field === "suffix" ? value : currentConfig.countdown?.suffix ?? "días para terminar el proceso!",
        color: field === "color" ? value as HeaderInfoBarColor : currentConfig.countdown?.color ?? "amber",
      },
    }));
    if (error) setError("");
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const loadNotifications = async () => {
      try {
        const [summaryResponse, listResponse] = await Promise.all([
          notificationsApi.summary(),
          notificationsApi.list("unread"),
        ]);
        if (!summaryResponse.ok || !listResponse.ok || cancelled) {
          return;
        }
        const summary = await parseJsonResponse<NotificationSummary>(summaryResponse);
        const list = await parseJsonResponse<NotificationItem[]>(listResponse);
        if (cancelled) return;
        setUnreadCount(summary.unread_count);
        setNotifications(list);
      } catch (error) {
        console.error("Error loading notifications:", error);
      }
    };

    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user]);

  const updateNotificationsAfterRead = (ids: number[]) => {
    const idsSet = new Set(ids);
    setNotifications((current) => current.filter((notification) => !idsSet.has(notification.id)));
    setUnreadCount((current) => Math.max(0, current - idsSet.size));
  };

  const handleMarkNotificationsRead = async (payload: { ids?: number[]; all?: boolean }, idsToClear: number[]) => {
    try {
      if (payload.all) {
        setMarkingAllNotifications(true);
      } else {
        setMarkingNotificationIds((current) => [...new Set([...current, ...idsToClear])]);
      }

      const response = await notificationsApi.markRead(payload);
      if (!response.ok) {
        return;
      }

      if (payload.all) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      updateNotificationsAfterRead(idsToClear);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    } finally {
      if (payload.all) {
        setMarkingAllNotifications(false);
      } else {
        setMarkingNotificationIds((current) => current.filter((id) => !idsToClear.includes(id)));
      }
    }
  };

  const handleMarkAllNotificationsRead = async () => handleMarkNotificationsRead({ all: true }, notifications.map((notification) => notification.id));

  const handleMarkNotificationRead = async (notificationId: number) => handleMarkNotificationsRead({ ids: [notificationId] }, [notificationId]);

  return (
    <>
      <header className="fixed left-64 right-0 top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-5 transition-colors duration-200 dark:border-gray-700 dark:bg-gray-800 xl:px-7 2xl:px-8">
        <HeaderInfoBar
          infoConfig={infoConfig}
          isAdmin={isAdmin}
          isInfoVisible={isInfoVisible}
          openEditModal={openEditModal}
          toggleInfoVisibility={toggleInfoVisibility}
        />

        <div className="ml-4 flex shrink-0 items-center gap-2 xl:gap-3 2xl:gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications((current) => !current)}
              className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              aria-label="Notificaciones"
            >
              <Bell size={20} />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </button>
            {showNotifications ? (
              <div className="absolute right-0 top-12 z-20 w-[32rem] max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Notificaciones</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Persisten hasta marcarlas como leídas.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleMarkAllNotificationsRead()}
                    disabled={markingAllNotifications || notifications.length === 0}
                    className="text-xs font-medium text-primary transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Marcar todas
                  </button>
                </div>
                <div className="max-h-80 space-y-3 overflow-auto">
                  {notifications.length > 0 ? notifications.map((notification) => (
                    <div key={notification.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{notification.title}</div>
                          <div className="mt-1 whitespace-pre-line break-words text-sm leading-5 text-gray-600 dark:text-gray-300">{notification.message}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleMarkNotificationRead(notification.id)}
                          disabled={markingNotificationIds.includes(notification.id)}
                          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Marcar como leído ${notification.title}`}
                        >
                          Leído
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      No hay notificaciones pendientes.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            title={`Cambiar a modo ${theme === "dark" ? "claro" : "oscuro"}`}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <HeaderPeriodSelector
            periods={periods}
            selectedPeriod={selectedPeriod}
            setSelectedPeriod={setSelectedPeriod}
            showPeriodMenu={showPeriodMenu}
            setShowPeriodMenu={setShowPeriodMenu}
            user={user}
          />

          <HeaderUserMenu
            logout={logout}
            setShowProfileMenu={setShowProfileMenu}
            showProfileMenu={showProfileMenu}
            user={user}
          />
        </div>
      </header>

      <Modal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        title="Editar Mensaje Informativo"
        className="max-w-2xl"
      >
        <div className="p-6 pt-2">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Segmentos del mensaje
              </label>
              <div className="space-y-3">
                {tempInfoConfig.segments.map((segment, index) => (
                  <div key={segment.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Segmento {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSegment(segment.id)}
                        disabled={tempInfoConfig.segments.length === 1}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-900/20"
                      >
                        <MinusCircle className="h-3.5 w-3.5" />
                        Quitar
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
                      <input
                        type="text"
                        value={segment.text}
                        onChange={(e) => handleSegmentChange(segment.id, "text", e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                          error ? "border-red-300 focus:ring-red-200" : "border-gray-300 dark:border-gray-700"
                        }`}
                        placeholder="Escribe una parte del mensaje..."
                        maxLength={200}
                      />

                      <select
                        value={segment.color}
                        onChange={(e) => handleSegmentChange(segment.id, "color", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
                      >
                        {HEADER_INFO_BAR_COLORS.map((color) => (
                          <option key={color} value={color}>
                            {HEADER_INFO_BAR_COLOR_LABELS[color]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddSegment}
                  className="inline-flex items-center gap-2 rounded-lg border border-dashed border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                >
                  <PlusCircle className="h-4 w-4" />
                  Agregar segmento
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Contador de días
                  </label>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Se calcula automáticamente según la fecha objetivo.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(tempInfoConfig.countdown?.enabled)}
                  onChange={(e) => handleCountdownToggle(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              {tempInfoConfig.countdown?.enabled ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block text-sm text-gray-700 dark:text-gray-200">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Fecha objetivo</span>
                    <input
                      type="date"
                      value={tempInfoConfig.countdown.targetDate}
                      onChange={(e) => handleCountdownChange("targetDate", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
                    />
                  </label>

                  <label className="block text-sm text-gray-700 dark:text-gray-200">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Color del contador</span>
                    <select
                      value={tempInfoConfig.countdown.color}
                      onChange={(e) => handleCountdownChange("color", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
                    >
                      {HEADER_INFO_BAR_COLORS.map((color) => (
                        <option key={color} value={color}>
                          {HEADER_INFO_BAR_COLOR_LABELS[color]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm text-gray-700 dark:text-gray-200">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Texto antes del número</span>
                    <input
                      type="text"
                      value={tempInfoConfig.countdown.prefix}
                      onChange={(e) => handleCountdownChange("prefix", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
                      placeholder="Quedan"
                      maxLength={120}
                    />
                  </label>

                  <label className="block text-sm text-gray-700 dark:text-gray-200">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Texto después del número</span>
                    <input
                      type="text"
                      value={tempInfoConfig.countdown.suffix}
                      onChange={(e) => handleCountdownChange("suffix", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
                      placeholder="días para terminar el proceso!"
                      maxLength={120}
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                Vista previa plana
              </div>
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {buildHeaderInfoBarPlainText(tempInfoConfig) || "Sin contenido"}
              </p>
              <div className="flex justify-between mt-1">
                {error ? (
                  <span className="text-xs text-red-500">{error}</span>
                ) : (
                  <span></span>
                )}
                <span className={`text-xs ${editableLength > 180 ? "text-amber-500" : "text-gray-400"}`}>
                  {editableLength}/200
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveInfo}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
