import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; // Importado según tu configuración

// https://vitejs.dev/config/
export default defineConfig({
  // **CRUCIAL: Define la ruta base para despliegue en GitHub Pages**
  // Usamos el nombre del repositorio ('/Gym-Workout/') como ruta base
  // para que Vite pueda encontrar los assets (CSS, JS) en la URL correcta.
  // Esto soluciona los errores 404 que estás viendo.
  base: '/Gym-Workout/', 
  
  plugins: [
    react(),
    tailwindcss(), // Tu plugin de Tailwind CSS
  ],
});
