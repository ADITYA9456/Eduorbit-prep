/** @type {import('tailwindcss').Config} */
const rgbVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Legacy colour names now resolve to the theme tokens in globals.css.
      colors: {
        ink: rgbVar("--bg-rgb"),
        panel: rgbVar("--panel-rgb"),
        line: rgbVar("--line-rgb"),
        electric: rgbVar("--accent-rgb"),
        mint: rgbVar("--ok-rgb"),
        danger: rgbVar("--bad-rgb"),
        foreground: "var(--foreground)",
        slate: {
          200: "var(--foreground)",
          300: "var(--text-2)",
          400: "var(--muted)",
          500: "var(--muted)",
          600: "var(--subtle)"
        },
        red: { 200: "var(--bad-fg)", 300: "var(--bad-fg)", 400: rgbVar("--bad-rgb") }
      },
      fontFamily: { sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"] },
      maxWidth: { content: "1120px" },
      borderRadius: { panel: "16px", field: "12px" }
    }
  },
  plugins: []
};
