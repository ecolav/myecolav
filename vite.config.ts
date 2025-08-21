import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri executa em uma WebView e define variáveis TAURI_.
  // Ajustes recomendados para desenvolvimento desktop.
  server: {
    port: 5173,
    strictPort: true,
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
