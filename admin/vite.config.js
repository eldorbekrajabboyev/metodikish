import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  server: {
    port: 5174,
    proxy: {
      '/api': process.env.VITE_API_URL || 'http://localhost:3000',
      '/uploads': process.env.VITE_API_URL || 'http://localhost:3000',
    },
  },
})
