import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { reactCspPreamble } from './server/vite-react-csp'

export default defineConfig({
  plugins: [react(), tailwindcss(), reactCspPreamble()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})

