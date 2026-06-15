import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'globalThis',  // sockjs-client cần biến global (Node.js) → polyfill cho browser
  },
  server: {
    // cinex-team port 5174 để chạy song song với cinex (5173)
    port: 5174,
  },
})
