import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <Sidebar />
      <Header />
      <main className="pl-64 pt-16 min-h-screen">
        <div className="w-full px-12 py-8 max-w-[1920px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}