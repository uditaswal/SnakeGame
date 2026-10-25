import { describe, expect, it } from 'vitest'
import { gameConfigForBoard } from './geometry'

describe('gameConfigForBoard', () => {
  it('uses the visible board aspect ratio for collision columns and rows', () => {
    const config = gameConfigForBoard(1920, 960)
    expect(config.columns).toBe(40)
    expect(config.rows).toBe(20)
  })

  it('keeps playable geometry valid on a narrow portrait board', () => {
    const config = gameConfigForBoard(390, 650)
    expect(config.columns).toBeGreaterThanOrEqual(12)
    expect(config.rows).toBeGreaterThanOrEqual(12)
    expect(config.columns).toBeLessThan(config.rows)
  })
})
