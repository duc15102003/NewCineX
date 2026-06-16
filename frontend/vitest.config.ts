import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Vitest config — tách khỏi vite.config.ts để tránh Tailwind plugin chạy
 * lúc test (không cần CSS pipeline, tăng tốc).
 *
 * <p>Test environment dùng jsdom — DOM API cho React components. happy-dom
 * cũng OK nhưng jsdom phổ biến hơn trong stack React.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,  // expose describe/it/expect mà không cần import (giống Jest)
    setupFiles: ['./src/test/setup.ts'],
    css: false,     // skip CSS — test logic, không cần style
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },
})
