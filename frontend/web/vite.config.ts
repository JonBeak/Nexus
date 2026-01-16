import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      host: env.VITE_HOST,
      proxy: env.VITE_API_URL ? undefined : {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false
        },
        '/order-images': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false
        },
        '/socket.io': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
          ws: true  // Enable WebSocket proxying
        }
      }
    },
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname || "", "./src"),
      },
    },
    esbuild: {
      target: 'es2020', // Better mobile browser compatibility
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2020',
      },
    },
    build: {
      outDir: env.VITE_OUT_DIR || 'dist',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-pdf': ['pdfjs-dist', 'react-pdf'],
            'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
            'vendor-query': ['@tanstack/react-query'],
          }
        }
      }
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
      css: false
    }
  }
})
