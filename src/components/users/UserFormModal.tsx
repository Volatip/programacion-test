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
  const formFieldIds = {
    name: "user-form-name",
    rut: "user-form-rut",
    email: "user-form-email",
    role: "user-form-role",
    status: "user-form-status",
    password: "user-form-password",
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? "Editar Usuario" : "Nuevo Usuario"}
      className="max-w-2xl"
    >
      <form onSubmit={onSubmit} className="space-y-4 p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={formFieldIds.name}>Nombre de Usuario</label>
            <input
              id={formFieldIds.name}
              type="text"
              required
              value={formData.name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              placeholder="Ej: Juan Pérez"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={formFieldIds.rut}>RUT</label>
            <input
              id={formFieldIds.rut}
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
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={formFieldIds.email}>Correo Electrónico</label>
          <input
            id={formFieldIds.email}
            type="email"
            required
            value={formData.email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            placeholder="juan@empresa.com"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={formFieldIds.role}>Rol</label>
            <select
              id={formFieldIds.role}
              value={formData.role}
              onChange={(e) => onRoleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="admin">Administrador</option>
              <option value="medical_coordinator">Coordinador Médico</option>
              <option value="non_medical_coordinator">Coordinador No Médico</option>
              <option value="revisor">Revisor</option>
              <option value="supervisor">Supervisor</option>
              <option value="user">Usuario</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={formFieldIds.status}>Estado</label>
            <select
              id={formFieldIds.status}
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
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={formFieldIds.password}>
            {isEditMode ? "Nueva Contraseña (Opcional)" : "Contraseña"}
          </label>
          <input
            id={formFieldIds.password}
            type="password"
            required={!isEditMode}
            value={formData.password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            placeholder="••••••••"
          />
        </div>

        <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
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
