import { NavLink } from "react-router-dom";
import { Home, ChartColumn, Users, Briefcase, Calendar, FileSpreadsheet, Upload, History, Github, CircleHelp, TableProperties, UserMinus, Mail } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import { APP_ROUTES, buildPublicAssetPath } from "../../lib/appPaths";

export function Sidebar() {
  const { user } = useAuth();

  const navItems = [
    { to: APP_ROUTES.home, icon: Home, label: "Inicio", roles: ['admin', 'administrador', 'medical_coordinator', 'non_medical_coordinator', 'supervisor', 'revisor'] },
    { to: APP_ROUTES.users, icon: Users, label: "Usuarios", roles: ['admin', 'administrador'] },
    { to: APP_ROUTES.bajas, icon: UserMinus, label: "Bajas", roles: ['admin', 'administrador'] },
    { to: APP_ROUTES.adminEmail, icon: Mail, label: "Correo", roles: ['admin', 'administrador'] },
    { to: APP_ROUTES.contextualHelpAdmin, icon: CircleHelp, label: "Ayudas", roles: ['admin', 'administrador'] },
    { to: APP_ROUTES.periods, icon: History, label: "Periodos", roles: ['admin', 'administrador'] },
    { to: APP_ROUTES.rrhh, icon: FileSpreadsheet, label: "RRHH", roles: ['admin', 'administrador'] },
    { to: APP_ROUTES.carga, icon: Upload, label: "Carga", roles: ['admin', 'administrador'] },
    { to: APP_ROUTES.officials, icon: Briefcase, label: "Funcionarios", roles: ['admin', 'administrador', 'medical_coordinator', 'non_medical_coordinator', 'supervisor', 'revisor'] },
    { to: APP_ROUTES.programming, icon: Calendar, label: "Programación", roles: ['admin', 'administrador', 'medical_coordinator', 'non_medical_coordinator', 'supervisor', 'revisor'] },
    { to: APP_ROUTES.general, icon: TableProperties, label: "General", roles: ['admin', 'administrador', 'supervisor', 'revisor'] },
    { to: APP_ROUTES.statistics, icon: ChartColumn, label: "Estadísticas", roles: ['admin', 'administrador', 'medical_coordinator', 'non_medical_coordinator', 'supervisor', 'revisor'] },
  ];

  const filteredNavItems = navItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 h-screen fixed left-0 top-0 border-r border-gray-200 dark:border-gray-700 flex flex-col z-20 transition-colors duration-200">
      <div className="p-6 flex items-center gap-3">
        <img src={buildPublicAssetPath("logo.png")} alt="Logo" className="w-10 h-10 object-contain" />
        <div>
          <h1 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">
            Programación
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">de Actividades</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors relative",
                isActive
                  ? "bg-primary text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="w-5 h-5" />
                {item.label}
                {isActive && (
                  <div className="absolute right-3 w-1.5 h-1.5 bg-white rounded-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-6 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-center text-gray-400 dark:text-gray-500">Plataforma de Programación 2026</p>
        <a 
          href="https://github.com/Volatip" 
          target="_blank"         
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 mt-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <Github className="w-4 h-4"/>
          <span className="text-xs">Pedro Castro Cariaga</span>
        </a>
      </div>
    </aside>
  );
}
