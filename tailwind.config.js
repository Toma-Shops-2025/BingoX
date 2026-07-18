/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#FF4500",
        secondary: "#bc13fe",
      },
      dropShadow: {
        glow: [
          "0 0 20px rgba(255, 69, 0, 0.35)",
          "0 0 65px rgba(255, 69, 0, 0.2)"
        ]
      }
    },
  },
  plugins: [],
}
