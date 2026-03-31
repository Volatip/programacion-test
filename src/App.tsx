import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProviders } from "./components/AppProviders";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/layout/Layout";
import Home from "./pages/Home";
import { Funcionarios } from "./pages/Funcionarios";
import { Login } from "./pages/Login";
import { Periodos } from "./pages/Periodos";

const Users = lazy(() => import("./pages/Users").then((module) => ({ default: module.Users })));
const ContextualHelpAdmin = lazy(() => import("./pages/ContextualHelpAdmin").then((module) => ({ default: module.ContextualHelpAdmin })));
const RRHH = lazy(() => import("./pages/RRHH").then((module) => ({ default: module.RRHH })));
const Carga = lazy(() => import("./pages/Carga").then((module) => ({ default: module.Carga })));
const Programacion = lazy(() => import("./pages/Programacion").then((module) => ({ default: module.Programacion })));
const ProgramacionGrupo = lazy(() => import("./pages/ProgramacionGrupo").then((module) => ({ default: module.ProgramacionGrupo })));
const ProgramacionLista = lazy(() => import("./pages/ProgramacionLista").then((module) => ({ default: module.ProgramacionLista })));

function lazyPage(element: ReactNode) {
  return <Suspense fallback={null}>{element}</Suspense>;
}

function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route path="/usuarios" element={lazyPage(<Users />)} />
                <Route path="/admin/ayudas-contextuales" element={lazyPage(<ContextualHelpAdmin />)} />
                <Route path="/rrhh" element={lazyPage(<RRHH />)} />
                <Route path="/carga" element={lazyPage(<Carga />)} />
              </Route>
              <Route path="/periodos" element={<Periodos />} />
              <Route path="/funcionarios" element={<Funcionarios />} />
              <Route path="/programacion" element={lazyPage(<Programacion />)} />
              <Route path="/programacion/grupo/:groupId" element={lazyPage(<ProgramacionGrupo />)} />
              <Route path="/programacion/programados" element={lazyPage(<ProgramacionLista type="scheduled" />)} />
              <Route path="/programacion/no-programados" element={lazyPage(<ProgramacionLista type="unscheduled" />)} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}

export default App;
