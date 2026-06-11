import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          environment: 'node',
          include: ['packages/shared/src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['packages/server/src/**/*.test.ts'],
        },
      },
      {
        plugins: [(await import('@vitejs/plugin-react')).default()],
        test: {
          name: 'client',
          include: ['packages/client/src/**/*.test.{ts,tsx}'],
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
