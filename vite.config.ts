import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'  // Import correcto

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()  // AHORA SÍ se usa
  ],
})
