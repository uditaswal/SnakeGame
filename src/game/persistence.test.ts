import { describe, expect, it } from 'vitest'
import { createGame, DEFAULT_CONFIG } from './engine'
import { parseRun, serializeRun } from './persistence'

describe('run persistence', () => {
  it('round-trips a versioned game state', () => {
    const checkpoint = { state: createGame(), config: DEFAULT_CONFIG, elapsedMs: 0, challenge: null, moves: [] }
    expect(parseRun(serializeRun(checkpoint))).toMatchObject(checkpoint)
  })

  it('rejects malformed and unsupported data', () => {
    expect(parseRun('not-json')).toBeNull()
    expect(parseRun('{"version":2}')).toBeNull()
  })
})

