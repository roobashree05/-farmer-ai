/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1f1a17',
        brass: '#8c6a3d',
        paper: '#f3efe7',
      },
    },
  },
  plugins: [],
};
