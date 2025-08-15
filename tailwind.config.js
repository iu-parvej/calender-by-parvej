// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Scan all React files for classes
  ],
  darkMode: 'class', // Critical: Use 'class' strategy for dark mode
  theme: {
    extend: {},
  },
  plugins: [],
}