import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isAdminRole } from "../lib/userRoles";

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length) {
    const hasAccess = allowedRoles.some((role) => {
      if (role === "admin") {
        return isAdminRole(user?.role);
      }

      return user?.role === role;
    });

    if (!hasAccess) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center p-6">
          <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
            <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-200">Acceso restringido</h2>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
              Tu perfil no tiene permisos para acceder a esta sección. Puedes seguir usando los módulos habilitados para tu rol.
            </p>
          </div>
        </div>
      );
    }
  }

  return <Outlet />;
}
