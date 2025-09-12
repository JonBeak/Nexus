import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: '192.168.2.14'
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname || "", "./src"),
    },
  },
})
