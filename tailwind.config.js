/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#1a1a1a',
        'bg-secondary': '#2a2a2a',
        'bg-tertiary': '#3a3a3a',
        // Accent color will use CSS variable
        'accent': 'var(--accent-color, #b85a3a)',
      },
    },
  },
  plugins: [],
}
