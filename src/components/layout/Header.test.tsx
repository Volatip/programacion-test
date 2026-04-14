import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Header } from "./Header";

const useAuthMock = vi.fn();
const usePeriodsMock = vi.fn();
const useThemeMock = vi.fn();
const useHeaderInfoBarMock = vi.fn();
const useWebSocketMock = vi.fn();
const notificationsSummaryMock = vi.fn();
const notificationsListMock = vi.fn();
const notificationsMarkReadMock = vi.fn();

vi.mock("../../context/AuthContext", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../../context/PeriodsContext", () => ({ usePeriods: () => usePeriodsMock() }));
vi.mock("../../hooks/useTheme", () => ({ useTheme: () => useThemeMock() }));
vi.mock("../../hooks/useHeaderInfoBar", () => ({ useHeaderInfoBar: () => useHeaderInfoBarMock() }));
vi.mock("../../context/WebSocketContext", () => ({ useWebSocket: () => useWebSocketMock() }));
vi.mock("./HeaderInfoBar", () => ({ HeaderInfoBar: () => <div>Info Bar</div> }));
vi.mock("./HeaderPeriodSelector", () => ({ HeaderPeriodSelector: () => <div>Period Selector</div> }));
vi.mock("./HeaderUserMenu", () => ({ HeaderUserMenu: () => <div>User Menu</div> }));
vi.mock("../ui/Modal", () => ({ Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../lib/api", () => ({
  notificationsApi: {
    summary: (...args: unknown[]) => notificationsSummaryMock(...args),
    list: (...args: unknown[]) => notificationsListMock(...args),
    markRead: (...args: unknown[]) => notificationsMarkReadMock(...args),
  },
  parseJsonResponse: async (response: { json: () => Promise<unknown> }) => response.json(),
}));

describe("Header notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { role: "user", name: "Ana" }, logout: vi.fn() });
    usePeriodsMock.mockReturnValue({ periods: [], selectedPeriod: null, setSelectedPeriod: vi.fn() });
    useThemeMock.mockReturnValue({ theme: "light", toggleTheme: vi.fn() });
    useWebSocketMock.mockReturnValue({ lastMessage: null, sendMessage: vi.fn() });
    useHeaderInfoBarMock.mockReturnValue({
      closeEditModal: vi.fn(),
      error: "",
      handleSaveInfo: vi.fn(),
      infoConfig: {
        version: 1,
        segments: [{ id: "1", text: "Info", color: "default" }],
        countdown: null,
      },
      isEditModalOpen: false,
      isInfoVisible: true,
      openEditModal: vi.fn(),
      setError: vi.fn(),
      setTempInfoConfig: vi.fn(),
      tempInfoConfig: {
        version: 1,
        segments: [{ id: "1", text: "Info", color: "default" }],
        countdown: null,
      },
      toggleInfoVisibility: vi.fn(),
    });
    notificationsSummaryMock.mockResolvedValue({ ok: true, json: async () => ({ unread_count: 2 }) });
    notificationsListMock.mockResolvedValue({ ok: true, json: async () => ([
      { id: 1, title: "Arreglar programación", message: "Revisar observación extensa para validar que el panel soporte mensajes largos sin romper el layout." },
      { id: 2, title: "Completar respaldo", message: "Subir archivo pendiente." },
    ]) });
    notificationsMarkReadMock.mockResolvedValue({ ok: true, json: async () => ({ updated: 1 }) });
  });

  it("renders bell with unread count and marks a single notification as read", async () => {
    render(<Header />);

    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /notificaciones/i }));

    expect(await screen.findByText("Arreglar programación")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /marcar como leído arreglar programación/i }));

    await waitFor(() => expect(notificationsMarkReadMock).toHaveBeenCalledWith({ ids: [1] }));
    await waitFor(() => expect(screen.queryByText("Arreglar programación")).not.toBeInTheDocument());
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("keeps the bulk action to mark all notifications as read", async () => {
    render(<Header />);

    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /notificaciones/i }));

    expect(await screen.findByText("Completar respaldo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /marcar todas/i }));

    await waitFor(() => expect(notificationsMarkReadMock).toHaveBeenCalledWith({ all: true }));
    await waitFor(() => expect(screen.queryByText("Completar respaldo")).not.toBeInTheDocument());
  });
});
