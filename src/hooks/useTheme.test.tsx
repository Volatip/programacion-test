import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useTheme } from "./useTheme";

function ThemeHarness() {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <>
      <span data-testid="theme-value">{theme}</span>
      <span data-testid="is-dark">{String(isDark)}</span>
      <button onClick={toggleTheme}>toggle</button>
    </>
  );
}

describe("useTheme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
  });

  it("defaults to light when there is no saved preference", () => {
    render(<ThemeHarness />);

    expect(screen.getByTestId("theme-value").textContent).toBe("light");
    expect(screen.getByTestId("is-dark").textContent).toBe("false");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(window.localStorage.getItem("theme")).toBe("light");
  });

  it("restores a previously saved dark preference", () => {
    window.localStorage.setItem("theme", "dark");

    render(<ThemeHarness />);

    expect(screen.getByTestId("theme-value").textContent).toBe("dark");
    expect(screen.getByTestId("is-dark").textContent).toBe("true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("persists the selected theme when the user toggles it", () => {
    render(<ThemeHarness />);

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));

    expect(screen.getByTestId("theme-value").textContent).toBe("dark");
    expect(screen.getByTestId("is-dark").textContent).toBe("true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(window.localStorage.getItem("theme")).toBe("dark");
  });
});
