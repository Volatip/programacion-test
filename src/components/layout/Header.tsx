import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePeriods } from "../../context/PeriodsContext";
import { useTheme } from "../../hooks/useTheme";
import { useHeaderInfoBar } from "../../hooks/useHeaderInfoBar";
import { Modal } from "../ui/Modal";
import { useWebSocket } from "../../context/WebSocketContext";
import { HeaderInfoBar } from "./HeaderInfoBar";
import { HeaderPeriodSelector } from "./HeaderPeriodSelector";
import { HeaderUserMenu } from "./HeaderUserMenu";

export function Header() {
  const { user, logout } = useAuth();
  const { periods, selectedPeriod, setSelectedPeriod } = usePeriods();
  const { theme, toggleTheme } = useTheme();
  const { lastMessage, sendMessage } = useWebSocket();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);

  const {
    closeEditModal,
    error,
    handleSaveInfo,
    infoText,
    isEditModalOpen,
    isInfoVisible,
    openEditModal,
    setError,
    setTempInfoText,
    tempInfoText,
    toggleInfoVisibility,
  } = useHeaderInfoBar({
    lastMessage,
    onBroadcast: sendMessage,
    updatedBy: user?.name,
  });
  const isAdmin = user?.role === "admin";

  return (
    <>
      <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 fixed top-0 left-64 right-0 z-10 px-8 flex items-center justify-between transition-colors duration-200">
        <HeaderInfoBar
          infoText={infoText}
          isAdmin={isAdmin}
          isInfoVisible={isInfoVisible}
          openEditModal={openEditModal}
          toggleInfoVisibility={toggleInfoVisibility}
        />

        <div className="flex items-center gap-4">
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
        className="max-w-md"
      >
        <div className="p-6 pt-2">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Texto del Mensaje
              </label>
              <textarea
                value={tempInfoText}
                onChange={(e) => {
                  setTempInfoText(e.target.value);
                  if (error) setError("");
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] resize-none ${
                  error ? "border-red-300 focus:ring-red-200" : "border-gray-300"
                }`}
                placeholder="Escribe el mensaje aquí..."
                maxLength={200}
              />
              <div className="flex justify-between mt-1">
                {error ? (
                  <span className="text-xs text-red-500">{error}</span>
                ) : (
                  <span></span>
                )}
                <span className={`text-xs ${tempInfoText.length > 180 ? "text-amber-500" : "text-gray-400"}`}>
                  {tempInfoText.length}/200
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
