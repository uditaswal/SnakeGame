import { createGame, createSeededRandom, getTickDelay, queueDirection, startGame, stepGame, type Direction, type GameConfig } from '../src/game/engine.js'
import { ApiError } from './http.js'

export type MoveEvent = Readonly<{ tick: number; direction: Direction }>

export function validateRunReplay({ score, ticks, durationMs, seed, config, moves }: {
  score: number
  ticks: number
  durationMs: number
  seed: number
  config: GameConfig
  moves: readonly MoveEvent[]
}): void {
  if (moves.length > 20_000) throw new ApiError(400, 'INVALID_RUN', 'Too many moves were submitted.')
  let previousTick = -1
  for (const move of moves) {
    if (move.tick < 0 || move.tick > ticks || move.tick < previousTick) {
      throw new ApiError(400, 'INVALID_RUN', 'Moves must be ordered game ticks.')
    }
    previousTick = move.tick
  }

  const random = createSeededRandom(seed)
  let state = startGame(createGame(config, random))
  let moveIndex = 0
  let minimumDurationMs = 0

  while (state.status === 'running' && state.ticks < ticks) {
    while (moves[moveIndex]?.tick === state.ticks) {
      state = queueDirection(state, moves[moveIndex].direction)
      moveIndex += 1
    }
    minimumDurationMs += getTickDelay(state.score, config)
    state = stepGame(state, config, random)
  }

  if (moveIndex !== moves.length || state.ticks !== ticks || state.score !== score || (state.status !== 'lost' && state.status !== 'won')) {
    throw new ApiError(400, 'INVALID_RUN', 'The submitted result does not match this game.')
  }
  if (durationMs < minimumDurationMs * 0.8) {
    throw new ApiError(400, 'IMPLAUSIBLE_RUN', 'The submitted duration is too short.')
  }
}
