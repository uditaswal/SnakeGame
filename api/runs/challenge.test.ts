// @vitest-environment node

import { expect, it } from 'vitest'
import { createChallengeSeed } from './challenge.js'

it('keeps generated seeds within the signed Postgres integer range', () => {
  for (let index = 0; index < 128; index += 1) {
    const seed = createChallengeSeed()
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThanOrEqual(2_147_483_647)
  }
})
