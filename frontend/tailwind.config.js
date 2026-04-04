/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand': '#ff6000', // orange glow from prompt
        'darkness': '#0b0c10',
        'panel': 'rgba(11, 12, 16, 0.85)',
      }
    },
  },
  plugins: [],
}
