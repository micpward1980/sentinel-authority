import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
        }
      }
    },
    chunkSizeWarningLimit: 600,
  },
  preview: {
    allowedHosts: ['sincere-respect-production.up.railway.app', 'localhost']
  }
})
