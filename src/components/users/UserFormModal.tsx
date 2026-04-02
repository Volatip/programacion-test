import { Modal } from "../ui/Modal";

interface UserFormData {
  name: string;
  rut: string;
  email: string;
  role: string;
  status: string;
  password?: string;
}

interface UserFormModalProps {
  isOpen: boolean;
  isEditMode: boolean;
  formData: UserFormData;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onNameChange: (value: string) => void;
  onRutChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEmailChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}

export function UserFormModal({
  isOpen,
  isEditMode,
  formData,
  onClose,
  onSubmit,
  onNameChange,
  onRutChange,
  onEmailChange,
  onRoleChange,
  onStatusChange,
  onPasswordChange,
}: UserFormModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? "Editar Usuario" : "Nuevo Usuario"}
      className="max-w-lg"
    >
      <form onSubmit={onSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre de Usuario</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              placeholder="Ej: Juan Pérez"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">RUT</label>
            <input
              type="text"
              required
              value={formData.rut}
              onChange={onRutChange}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              placeholder="12345678-9"
              maxLength={12}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">Formato: 12345678-9</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Correo Electrónico</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            placeholder="juan@empresa.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Rol</label>
            <select
              value={formData.role}
              onChange={(e) => onRoleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="admin">Administrador</option>
              <option value="medical_coordinator">Coordinador Médico</option>
              <option value="non_medical_coordinator">Coordinador No Médico</option>
              <option value="supervisor">Supervisor</option>
              <option value="user">Usuario</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
            <select
              value={formData.status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isEditMode ? "Nueva Contraseña (Opcional)" : "Contraseña"}
          </label>
          <input
            type="password"
            required={!isEditMode}
            value={formData.password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            placeholder="••••••••"
          />
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-sm shadow-primary/20"
          >
            {isEditMode ? "Guardar Cambios" : "Crear Usuario"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
