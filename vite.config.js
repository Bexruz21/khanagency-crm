import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'https://de7e-95-214-211-12.ngrok-free.app',
      '/media': 'https://de7e-95-214-211-12.ngrok-free.app',
    },
  },
})
