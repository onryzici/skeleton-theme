/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './layout/*.liquid',
    './sections/*.liquid',
    './snippets/*.liquid',
    './templates/*.liquid',
    './templates/**/*.liquid',
    './blocks/*.liquid',
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Mont', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'mont': ['Mont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
