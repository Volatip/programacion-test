import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

function normalizeBasePath(value?: string): string {
  const trimmedValue = value?.trim();

  if (!trimmedValue || trimmedValue === "." || trimmedValue === "./" || trimmedValue === "/") {
    return "/";
  }

  const withLeadingSlash = trimmedValue.startsWith("/") ? trimmedValue : `/${trimmedValue}`;
  const withoutTrailingSlashes = withLeadingSlash.replace(/\/+$/, "");
  return `${withoutTrailingSlashes}/`;
}

function getAppBasePathFromApiBasePath(apiBasePath?: string): string {
  const normalizedApiBasePath = normalizeBasePath(apiBasePath);

  if (normalizedApiBasePath === "/" || normalizedApiBasePath === "/api/") {
    return "/";
  }

  return normalizedApiBasePath.endsWith("/api/")
    ? `${normalizedApiBasePath.slice(0, -5)}/`
    : normalizedApiBasePath;
}

export function resolveViteBase(command: "serve" | "build", mode: string): string {
  if (command === "serve") {
    return "/";
  }

  const env = loadEnv(mode, process.cwd(), "");
  const explicitBasePath = normalizeBasePath(env.VITE_APP_BASE_PATH);

  if (explicitBasePath !== "/") {
    return explicitBasePath;
  }

  const inferredBasePath = getAppBasePathFromApiBasePath(env.VITE_API_BASE_PATH);
  if (inferredBasePath !== "/") {
    return inferredBasePath;
  }

  return "/programacion/";
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  base: resolveViteBase(command, mode),
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  plugins: [
    react(),
    tsconfigPaths(),
  ],
}))
