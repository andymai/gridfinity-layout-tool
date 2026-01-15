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
        '**/index.ts', // Barrel files (re-exports only)
        'api/**', // Serverless functions tested separately
        'src/components/collab/**', // Feature-flagged, requires Liveblocks mock
        'src/hooks/usePresence.ts', // Feature-flagged, tested via usePresence.test.ts utilities
      ],
      thresholds: {
        // Thresholds set slightly below current coverage to prevent regression
        // TODO: Incrementally raise these as coverage improves
        lines: 78,
        branches: 67,
        functions: 77,
        statements: 77,
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
