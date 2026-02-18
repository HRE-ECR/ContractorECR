
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use a build-time BASE_PATH injected by GitHub Actions for Pages, or default to '/'
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  plugins: [react()],
  base
})
