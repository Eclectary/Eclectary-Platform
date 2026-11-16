import { statSync } from 'node:fs'
import { isAbsolute } from 'node:path'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function integrationProxy(mode: string) {
  if (mode !== 'integration') return undefined

  const socketPath = process.env.INTEGRATION_API_SOCKET?.trim()

  if (!socketPath) {
    throw new Error('INTEGRATION_API_SOCKET is required in integration mode')
  }

  if (!isAbsolute(socketPath)) {
    throw new Error('INTEGRATION_API_SOCKET must be an absolute path')
  }

  let socketExists = false

  try {
    socketExists = statSync(socketPath).isSocket()
  } catch {
    // Report missing, inaccessible, and non-socket paths with the same safe error.
  }

  if (!socketExists) {
    throw new Error('INTEGRATION_API_SOCKET must reference an existing Unix socket')
  }

  const socketTarget = () => ({
    protocol: 'http:',
    host: 'localhost',
    port: 80,
    socketPath,
  })

  return {
    '/api': { target: socketTarget() },
    '/rails/active_storage': { target: socketTarget() },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const proxy = integrationProxy(mode)

  return {
    plugins: [react()],
    server: proxy ? { proxy } : undefined,
  }
})
