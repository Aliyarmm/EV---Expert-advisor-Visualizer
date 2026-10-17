/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Inter Tight", "system-ui", "sans-serif"],
        mono: ["SF Mono", "Monaco", "Consolas", "monospace"],
        display: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Inter Tight", "system-ui", "sans-serif"],
      },
      colors: {
        // Apple-esque dark palette
        bg: "#0a0a0c",
        "bg-secondary": "#121216",
        "bg-tertiary": "#1a1a20",
        "bg-elevated": "#1f1f26",
        border: "#2a2a32",
        "border-hover": "#3a3a44",
        text: "#f0f0f0",
        "text-secondary": "#b0b0b8",
        "text-tertiary": "#7a7a86",
        accent: "#007aff",
        "accent-hover": "#0062cc",
        green: "#28c774",
        red: "#ff5252",
        amber: "#ffc107",
      },
      spacing: {
        // 8pt grid system
        0.5: "2px",
        1: "4px",
        1.5: "6px",
        2: "8px",
        2.5: "10px",
        3: "12px",
        3.5: "14px",
        4: "16px",
        5: "20px",
        6: "24px",
        7: "28px",
        8: "32px",
        9: "36px",
        10: "40px",
        12: "48px",
        14: "56px",
        16: "64px",
        20: "80px",
        24: "96px",
        28: "112px",
        32: "128px",
      },
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        DEFAULT: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
      },
      boxShadow: {
        "glass": "0 4px 16px rgba(0, 0, 0, 0.3)",
        "glass-strong": "0 8px 32px rgba(0, 0, 0, 0.4)",
        "elevated": "0 4px 24px rgba(0, 0, 0, 0.35)",
      },
      animation: {
        "spring-in": "spring-in 0.5s cubic-bezier(0.17, 0.67, 0.67, 1) forwards",
        "fade-in": "fade-in 0.2s ease-out forwards",
        "pulse-subtle": "pulse-subtle 2s ease-in-out infinite",
      },
      keyframes: {
        "spring-in": {
          "0%": { opacity: 0, transform: "translateY(-10px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.6 },
        },
      },
    },
  },
  plugins: [],
};
