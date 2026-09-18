/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f6fb',
          100: '#e8edf6',
          200: '#cad7ec',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          900: '#1e293b',
        }
      }
    },
  },
  plugins: [],
}
