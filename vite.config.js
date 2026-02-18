import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path for GitHub Pages is injected by Actions as BASE_PATH.
// For local dev it defaults to '/'
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  plugins: [react()],
  base,
})
