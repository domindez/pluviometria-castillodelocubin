import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cambia 'dist' por 'docs' aquí
export default defineConfig({
  build: {
    outDir: 'docs',
  },
  plugins: [react()],
  // Asegúrate de ajustar la base si tu proyecto no está en la raíz del dominio
  base: '/pluviometria-castillodelocubin/'
});
