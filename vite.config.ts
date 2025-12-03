import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; // Importado según tu configuración

// https://vitejs.dev/config/
export default defineConfig({
  // **CRUCIAL: Define la ruta base para Vercel**
  // El uso de './' (relativa) asegura que Vite construya las rutas de CSS y JS 
  // correctamente, resolviendo los errores 404 que viste en la consola.
  base: './', 
  
  plugins: [
    react(),
    tailwindcss(), // Tu plugin de Tailwind CSS
  ],
});
