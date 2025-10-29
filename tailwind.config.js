/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'gpon-primary': '#1e40af',
        'gpon-secondary': '#3b82f6',
        'gpon-accent': '#60a5fa',
        'gpon-dark': '#1e293b',
        'gpon-light': '#f8fafc',
      },
    },
  },
  plugins: [],
}


