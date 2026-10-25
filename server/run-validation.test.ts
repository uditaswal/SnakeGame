// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { validateRun } from './run-validation'

describe('score plausibility validation', () => {
  it('accepts ordinary engine output', () => {
    expect(() => validateRun(12, 18_000, 140)).not.toThrow()
  })

  it('rejects scores larger than the board can contain', () => {
    expect(() => validateRun(2_398, 120_000, 1_000)).toThrow()
  })

  it('rejects runs faster than the engine permits', () => {
    expect(() => validateRun(20, 100, 100)).toThrow()
  })
})

