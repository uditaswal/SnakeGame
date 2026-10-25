import { describe, expect, it, vi } from 'vitest'
import { apiRequest } from './api'

describe('apiRequest', () => {
  it('explains how to start the local account service when the request cannot connect', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network unavailable') }))

    await expect(apiRequest('/api/auth/session')).rejects.toMatchObject({
      code: 'API_UNAVAILABLE',
      status: 0,
    })
    vi.unstubAllGlobals()
  })

  it('does not mistake Vite HTML fallback for an API response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('unexpected HTML') },
    })))

    await expect(apiRequest('/api/auth/session')).rejects.toMatchObject({
      code: 'API_UNAVAILABLE',
      status: 200,
    })
    vi.unstubAllGlobals()
  })
})
