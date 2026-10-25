// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { parseUsername } from './username'

describe('username validation', () => {
  it('normalizes case for uniqueness while preserving display case', () => {
    expect(parseUsername('  Player_7 ')).toEqual({ username: 'Player_7', usernameKey: 'player_7' })
  })

  it.each(['ab', '7player', 'player-name', 'pläyer', 'administrator'])(
    'rejects unavailable or unsafe username %s',
    (username) => expect(() => parseUsername(username)).toThrow(),
  )
})

