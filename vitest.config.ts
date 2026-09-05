import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./server/core', import.meta.url)),
    },
  },
})
