import { ApiError } from './http.js'

const MAX_BOARD_CELL_COUNT = 60 * 40
const INITIAL_SNAKE_LENGTH = 3
const MINIMUM_TICK_MS = 62
const MAX_RUN_MS = 6 * 60 * 60 * 1000

export function validateRun(score: number, durationMs: number, ticks: number): void {
  if (score > MAX_BOARD_CELL_COUNT - INITIAL_SNAKE_LENGTH) {
    throw new ApiError(400, 'IMPLAUSIBLE_RUN', 'The score exceeds the board limit.')
  }
  if (ticks < score || durationMs > MAX_RUN_MS) {
    throw new ApiError(400, 'IMPLAUSIBLE_RUN', 'The run statistics are not plausible.')
  }
  const generousMinimumDuration = ticks * MINIMUM_TICK_MS * 0.45
  if (durationMs < generousMinimumDuration) {
    throw new ApiError(400, 'IMPLAUSIBLE_RUN', 'The run completed faster than the game permits.')
  }
}

