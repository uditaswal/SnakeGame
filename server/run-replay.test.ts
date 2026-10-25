import { describe, expect, it } from 'vitest'
import { validateRunReplay } from './run-replay'

const config = { columns: 12, rows: 12, initialSpeedMs: 130, minimumSpeedMs: 62, speedStepMs: 3 }

describe('server run replay', () => {
  it('accepts the deterministic result of an untouched game reaching a wall', () => {
    expect(() => validateRunReplay({ score: 0, ticks: 6, durationMs: 780, seed: 42, config, moves: [] })).not.toThrow()
  })

  it('rejects a forged score even when its duration and tick count look plausible', () => {
    expect(() => validateRunReplay({ score: 12, ticks: 6, durationMs: 60_000, seed: 42, config, moves: [] })).toThrow('does not match')
  })
})
