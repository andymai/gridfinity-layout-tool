import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate three.js ecosystem into its own chunk (only loaded when 3D preview is used)
          'three': ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei'],
          // Core React runtime
          'react-vendor': ['react', 'react-dom'],
          // State management
          'state': ['zustand', 'immer'],
        },
      },
    },
  },
})
