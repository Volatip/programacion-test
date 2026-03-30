import { useState, useEffect, useRef } from "react";
import { UserFormModal } from "../components/users/UserFormModal";
import { UsersFloatingMenu } from "../components/users/UsersFloatingMenu";
import { UsersTable } from "../components/users/UsersTable";
import { UsersToolbar } from "../components/users/UsersToolbar";
import { PageHeader } from "../components/ui/PageHeader";
import { formatRut } from "../lib/utils";
import { buildApiUrl, fetchWithAuth } from "../lib/api";

interface User {
  id: number;
  name: string;
  rut: string;
  email: string;
  role: string;
  status: string;
  last_access?: string;
}

interface UserFormData {
  name: string;
  rut: string;
  email: string;
  role: string;
  status: string;
  password?: string;
}

const initialFormData: UserFormData = {
  name: "",
  rut: "",
  email: "",
  role: "admin",
  status: "activo",
  password: "",
};

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [searchQuery, setSearchQuery] = useState("");
  const buttonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    medical_coordinator: "Coordinador Médico",
    non_medical_coordinator: "Coordinador No Médico",
    user: "Usuario",
  };

  const roleColors: Record<string, string> = {
    admin: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    medical_coordinator: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    non_medical_coordinator: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
    user: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Nunca";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Fecha inválida";

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const fetchUsers = async () => {
    try {
      const response = await fetchWithAuth(buildApiUrl("/users"));
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (openMenuId !== null) setOpenMenuId(null);
    };
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [openMenuId]);

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatRut(rawValue);
    setFormData({ ...formData, rut: formatted });
  };

  const handleOpenAddModal = () => {
    setFormData(initialFormData);
    setIsEditMode(false);
    setSelectedUserId(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setFormData({
      name: user.name,
      rut: user.rut,
      email: user.email,
      role: user.role,
      status: user.status,
      password: "",
    });
    setIsEditMode(true);
    setSelectedUserId(user.id);
    setIsModalOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteUser = async (id: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar este usuario?")) {
      try {
        const response = await fetchWithAuth(buildApiUrl(`/users/${id}`), {
          method: "DELETE",
        });
        if (response.ok) {
          fetchUsers();
        }
      } catch (error) {
        console.error("Error deleting user:", error);
      }
    }
    setOpenMenuId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = isEditMode
      ? buildApiUrl(`/users/${selectedUserId}`)
      : buildApiUrl("/users");
    const method = isEditMode ? "PUT" : "POST";

    const bodyData = { ...formData };
    if (isEditMode && !bodyData.password) {
      delete bodyData.password;
    }

    try {
      const response = await fetchWithAuth(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchUsers();
      } else {
        const errorData = await response.json().catch(() => ({ detail: "Error desconocido" }));
        alert(`Error: ${errorData.detail || "Error al guardar usuario"}`);
      }
    } catch (error) {
      console.error("Error saving user:", error);
      alert("Error de conexión al guardar usuario");
    }
  };

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.rut.includes(searchQuery)
  );

  const toggleMenu = (id: number) => {
    if (openMenuId === id) {
      setOpenMenuId(null);
    } else {
      const button = buttonRefs.current[id];
      if (button) {
        const rect = button.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX - 180 + rect.width,
        });
        setOpenMenuId(id);
      }
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getRandomColor = (id: number) => {
    const colors = [
      "bg-green-500",
      "bg-blue-500",
      "bg-indigo-500",
      "bg-teal-500",
      "bg-emerald-500",
      "bg-cyan-500",
      "bg-yellow-500",
      "bg-red-500",
    ];
    return colors[id % colors.length];
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        subtitle={`Gestiona los usuarios del sistema (${filteredUsers.length} visibles)`}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
        <UsersToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onAddUser={handleOpenAddModal}
        />

        <UsersTable
          users={filteredUsers}
          roleLabels={roleLabels}
          roleColors={roleColors}
          formatDate={formatDate}
          getInitials={getInitials}
          getRandomColor={getRandomColor}
          buttonRefs={buttonRefs}
          onToggleMenu={toggleMenu}
        />
      </div>

      <UsersFloatingMenu
        openMenuId={openMenuId}
        menuPosition={menuPosition}
        users={users}
        onClose={() => setOpenMenuId(null)}
        onEditUser={handleOpenEditModal}
        onDeleteUser={handleDeleteUser}
      />

      <UserFormModal
        isOpen={isModalOpen}
        isEditMode={isEditMode}
        formData={formData}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        onNameChange={(value) => setFormData({ ...formData, name: value })}
        onRutChange={handleRutChange}
        onEmailChange={(value) => setFormData({ ...formData, email: value })}
        onRoleChange={(value) => setFormData({ ...formData, role: value })}
        onStatusChange={(value) => setFormData({ ...formData, status: value })}
        onPasswordChange={(value) => setFormData({ ...formData, password: value })}
      />
    </div>
  );
}
