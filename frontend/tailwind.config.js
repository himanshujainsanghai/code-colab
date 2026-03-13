/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vscode: {
          bg: "#1e1e1e",
          panel: "#252526",
          side: "#1f1f1f",
          border: "#2d2d2d",
          text: "#cccccc",
          muted: "#8a8a8a",
          blue: "#007acc",
          green: "#4ec9b0",
          yellow: "#dcdcaa",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(0, 122, 204, 0.35)",
      },
    },
  },
  plugins: [],
}

