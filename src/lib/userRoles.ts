export function getRoleLabel(role: string | undefined): string {
  if (!role) return "";

  const roleMap: Record<string, string> = {
    admin: "Administrador",
    medical_coordinator: "Coordinador Médico",
    non_medical_coordinator: "Coordinador No Médico",
    user: "Usuario",
    guest: "Invitado"
  };

  return roleMap[role] || role;
}

export function isAdminRole(role: string | undefined): boolean {
  return role === "admin" || role === "administrador";
}
