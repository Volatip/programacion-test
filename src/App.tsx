import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProviders } from "./components/AppProviders";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/layout/Layout";
import { APP_BASE_PATH, APP_ROUTES } from "./lib/appPaths";
import Estadisticas from "./pages/Estadisticas";
import Home from "./pages/Home";
import { Funcionarios } from "./pages/Funcionarios";
import { Login } from "./pages/Login";
import { Periodos } from "./pages/Periodos";

const Users = lazy(() => import("./pages/Users").then((module) => ({ default: module.Users })));
const AdminEmailSettings = lazy(() => import("./pages/AdminEmailSettings").then((module) => ({ default: module.AdminEmailSettings })));
const ContextualHelpAdmin = lazy(() => import("./pages/ContextualHelpAdmin").then((module) => ({ default: module.ContextualHelpAdmin })));
const RRHH = lazy(() => import("./pages/RRHH").then((module) => ({ default: module.RRHH })));
const Carga = lazy(() => import("./pages/Carga").then((module) => ({ default: module.Carga })));
const Programacion = lazy(() => import("./pages/Programacion").then((module) => ({ default: module.Programacion })));
const ProgramacionGrupo = lazy(() => import("./pages/ProgramacionGrupo").then((module) => ({ default: module.ProgramacionGrupo })));
const ProgramacionLista = lazy(() => import("./pages/ProgramacionLista").then((module) => ({ default: module.ProgramacionLista })));
const General = lazy(() => import("./pages/General").then((module) => ({ default: module.General })));
const Bajas = lazy(() => import("./pages/Bajas").then((module) => ({ default: module.Bajas })));

function lazyPage(element: ReactNode) {
  return <Suspense fallback={null}>{element}</Suspense>;
}

function App() {
  return (
    <AppProviders>
      <BrowserRouter basename={APP_BASE_PATH || undefined}>
        <Routes>
          <Route path={APP_ROUTES.login} element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route element={<ProtectedRoute allowedRoles={["admin", "medical_coordinator", "non_medical_coordinator", "supervisor", "revisor", "user"]} />}>
                <Route path={APP_ROUTES.home} element={<Home />} />
                <Route path={APP_ROUTES.statistics} element={<Estadisticas />} />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route path={APP_ROUTES.users} element={lazyPage(<Users />)} />
                <Route path={APP_ROUTES.bajas} element={lazyPage(<Bajas />)} />
                <Route path={APP_ROUTES.adminEmail} element={lazyPage(<AdminEmailSettings />)} />
                <Route path={APP_ROUTES.contextualHelpAdmin} element={lazyPage(<ContextualHelpAdmin />)} />
                <Route path={APP_ROUTES.rrhh} element={lazyPage(<RRHH />)} />
                <Route path={APP_ROUTES.carga} element={lazyPage(<Carga />)} />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route path={APP_ROUTES.periods} element={<Periodos />} />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={["admin", "medical_coordinator", "non_medical_coordinator", "supervisor", "revisor", "user"]} />}>
                <Route path={APP_ROUTES.officials} element={<Funcionarios />} />
                <Route element={<ProtectedRoute allowedRoles={["admin", "supervisor", "revisor"]} />}>
                  <Route path={APP_ROUTES.general} element={lazyPage(<General />)} />
                </Route>
                <Route path={APP_ROUTES.programming} element={lazyPage(<Programacion />)} />
                <Route path={APP_ROUTES.programmingGroupPattern} element={lazyPage(<ProgramacionGrupo />)} />
                <Route path={APP_ROUTES.programmingScheduled} element={lazyPage(<ProgramacionLista type="scheduled" />)} />
                <Route path={APP_ROUTES.programmingUnscheduled} element={lazyPage(<ProgramacionLista type="unscheduled" />)} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}

export default App;
