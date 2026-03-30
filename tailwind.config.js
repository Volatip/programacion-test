/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "#f8fafc", // Very light blue/gray for main bg
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#198754", // Green
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#10B981", // Green
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#f3f4f6",
          foreground: "#6b7280",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#000000",
        },
      },
    },
  },
  plugins: [],
};