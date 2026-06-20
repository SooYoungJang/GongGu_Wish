/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eaf6ff",
          100: "#d1e9ff",
          200: "#b1d9ff",
          300: "#86c1ff",
          400: "#559eff",
          500: "#1770f9",
          600: "#0059e0",
          700: "#0045be",
          800: "#003597",
          900: "#002875",
          950: "#001f58",
        },
        accent: {
          DEFAULT: "#e1306c",
          light: "#ff5a8a",
        },
        neutral: {
          50: "#f6f9fc",
          100: "#edf2f8",
          200: "#d9dfe5",
          300: "#bfc5ca",
          400: "#9a9fa5",
          500: "#6d7277",
          600: "#51565b",
          700: "#3c4045",
          800: "#23272b",
          900: "#15191d",
          950: "#080c0f",
        },
      },
    },
  },
  plugins: [],
};
