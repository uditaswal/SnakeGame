import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  createGame,
  getTickDelay,
  placeFood,
  queueDirection,
  startGame,
  stepGame,
  type GameState,
} from './engine'

const runningState = (overrides: Partial<GameState> = {}): GameState => ({
  ...createGame(DEFAULT_CONFIG, () => 0),
  status: 'running',
  ...overrides,
})

describe('snake engine', () => {
  it('creates a centered three-cell snake', () => {
    const game = createGame(DEFAULT_CONFIG, () => 0)
    expect(game.snake).toEqual([
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ])
    expect(game.status).toBe('ready')
  })

  it('moves one grid cell per tick', () => {
    const game = stepGame(startGame(createGame(DEFAULT_CONFIG, () => 0)))
    expect(game.snake[0]).toEqual({ x: 11, y: 10 })
    expect(game.ticks).toBe(1)
  })

  it('rejects an immediate reverse direction', () => {
    const game = runningState()
    expect(queueDirection(game, 'left')).toBe(game)
  })

  it('grows and scores after eating food', () => {
    const game = runningState({ food: { x: 11, y: 10 } })
    const next = stepGame(game, DEFAULT_CONFIG, () => 0)
    expect(next.snake).toHaveLength(4)
    expect(next.score).toBe(1)
    expect(next.food).not.toEqual({ x: 11, y: 10 })
  })

  it('ends a run at a wall', () => {
    const game = runningState({
      snake: [{ x: 19, y: 4 }],
      direction: 'right',
      queuedDirection: 'right',
    })
    const next = stepGame(game)
    expect(next.status).toBe('lost')
    expect(next.lossReason).toBe('wall')
  })

  it('detects a self collision', () => {
    const game = runningState({
      snake: [
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
        { x: 1, y: 2 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      direction: 'up',
      queuedDirection: 'left',
      food: { x: 8, y: 8 },
    })
    const next = stepGame(game)
    expect(next.status).toBe('lost')
    expect(next.lossReason).toBe('self')
  })

  it('places food only on empty cells with deterministic randomness', () => {
    const config = { ...DEFAULT_CONFIG, columns: 2, rows: 2 }
    const snake = [{ x: 0, y: 0 }, { x: 1, y: 0 }]
    expect(placeFood(snake, config, () => 0)).toEqual({ x: 0, y: 1 })
    expect(placeFood(snake, config, () => 0.999)).toEqual({ x: 1, y: 1 })
  })

  it('caps speed at the configured minimum', () => {
    expect(getTickDelay(1000)).toBe(DEFAULT_CONFIG.minimumSpeedMs)
  })
})

