import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      exclude: [
        'node_modules/**',
        'e2e/**',
        'src/test/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types.ts',
        'api/**', // Serverless functions tested separately
      ],
      thresholds: {
        // Thresholds set slightly below current coverage to prevent regression
        // Updated 2026-01-13: Adjusted after adding collection invite UX
        lines: 86,
        branches: 74,
        functions: 85,
        statements: 85,
      },
    },
  },
  resolve: {
    alias: {
      // Mock virtual PWA module for tests
      'virtual:pwa-register/react': path.resolve(__dirname, 'src/test/mocks/pwa-register.ts'),
    },
  },
})
