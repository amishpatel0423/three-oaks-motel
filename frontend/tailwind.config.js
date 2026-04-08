/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nasa: {
          blue: "#87CEEB",
          light: "#F8F9FA",
          orange: "#FF5C35",
          dark: "#0B3D91" // traditional NASA dark blue for accents
        }
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        montserrat: ['Montserrat', 'sans-serif'],
      },
      animation: {
        'shuttle-launch': 'launch 3s ease-in-out forwards',
        'fade-in': 'fadeIn 1s ease-in forwards',
      },
      keyframes: {
        launch: {
          '0%': { transform: 'translateY(100vh)', opacity: '1' },
          '70%': { opacity: '1' },
          '100%': { transform: 'translateY(-100vh) scale(0.5)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
