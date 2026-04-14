import type { ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Login } from "./Login";
import { APP_ROUTES } from "../lib/appPaths";

const navigateMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("../components/ui/Modal", () => ({
  Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Lock: () => <span>Lock</span>,
  Eye: () => <span>Eye</span>,
  EyeOff: () => <span>EyeOff</span>,
  Github: () => <span>Github</span>,
  Sun: () => <span>Sun</span>,
  Moon: () => <span>Moon</span>,
}));

describe("Login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects authenticated users away from login", async () => {
    useAuthMock.mockReturnValue({
      login: vi.fn(),
      isAuthenticated: true,
    });

    render(<Login />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(APP_ROUTES.home, { replace: true });
    });
  });
});
