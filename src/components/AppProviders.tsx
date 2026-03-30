import type { ReactNode } from "react";
import { OfficialsProvider } from "../context/OfficialsContext";
import { AuthProvider } from "../context/AuthContext";
import { PeriodsProvider } from "../context/PeriodsContext";
import { ProgrammingCacheProvider } from "../context/ProgrammingCacheContext";
import { WebSocketProvider } from "../context/WebSocketContext";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <PeriodsProvider>
          <OfficialsProvider>
            <ProgrammingCacheProvider>
              {children}
            </ProgrammingCacheProvider>
          </OfficialsProvider>
        </PeriodsProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}
