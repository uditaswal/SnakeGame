import type { GameConfig, GameLossReason, GameState, GameStatus, Point } from './engine'
import type { MoveEvent, RunChallenge } from '../lib/run-api'

export const RUN_STORAGE_KEY = 'snake.run.v2'

export type GameCheckpoint = {
  version: 2
  savedAt: string
  state: GameState
  config: GameConfig
  elapsedMs: number
  challenge: RunChallenge | null
  moves: MoveEvent[]
}

export function serializeRun(checkpoint: Omit<GameCheckpoint, 'version' | 'savedAt'>, now = new Date()): string {
  return JSON.stringify({ ...checkpoint, version: 2, savedAt: now.toISOString() })
}

export function parseRun(value: string): GameCheckpoint | null {
  try {
    const payload: unknown = JSON.parse(value)
    return isStoredRun(payload) ? payload : null
  } catch {
    return null
  }
}

const directions = new Set(['up', 'down', 'left', 'right'])
const statuses = new Set<GameStatus>(['ready', 'running', 'paused', 'lost', 'won'])
const lossReasons = new Set<GameLossReason>(['wall', 'self', null])

function isPoint(value: unknown, config: GameConfig): value is Point {
  if (typeof value !== 'object' || value === null) return false
  const point = value as Partial<Point>
  return Number.isInteger(point.x) && Number.isInteger(point.y) && point.x! >= 0 && point.y! >= 0 && point.x! < config.columns && point.y! < config.rows
}

function isConfig(value: unknown): value is GameConfig {
  if (typeof value !== 'object' || value === null) return false
  const config = value as Partial<GameConfig>
  return Number.isInteger(config.columns) && config.columns! >= 12 && config.columns! <= 60 &&
    Number.isInteger(config.rows) && config.rows! >= 12 && config.rows! <= 40 &&
    config.initialSpeedMs === 130 && config.minimumSpeedMs === 62 && config.speedStepMs === 3
}

function isChallenge(value: unknown, config: GameConfig): value is RunChallenge | null {
  if (value === null) return true
  if (typeof value !== 'object') return false
  const challenge = value as Partial<RunChallenge>
  return typeof challenge.challenge === 'string' && challenge.challenge.length >= 32 && Number.isInteger(challenge.engineVersion) && Number.isInteger(challenge.seed) && challenge.columns === config.columns && challenge.rows === config.rows && typeof challenge.expiresAt === 'string' && !Number.isNaN(Date.parse(challenge.expiresAt))
}

function isStoredRun(value: unknown): value is GameCheckpoint {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Partial<GameCheckpoint>
  if (payload.version !== 2 || typeof payload.savedAt !== 'string' || !isConfig(payload.config) || !Number.isSafeInteger(payload.elapsedMs) || payload.elapsedMs! < 0) return false
  const state = payload.state as Partial<GameState> | undefined
  if (!state || state.version !== 1 || !Array.isArray(state.snake) || state.snake.length < 3 || !state.snake.every((point) => isPoint(point, payload.config!)) || (state.food !== null && !isPoint(state.food, payload.config!)) || !directions.has(state.direction ?? '') || !directions.has(state.queuedDirection ?? '') || !Number.isInteger(state.score) || state.score! < 0 || state.score !== state.snake.length - 3 || !Number.isInteger(state.ticks) || state.ticks! < 0 || !statuses.has(state.status as GameStatus) || !lossReasons.has(state.lossReason as GameLossReason)) return false
  const occupied = new Set(state.snake.map((point) => `${point.x}:${point.y}`))
  if (occupied.size !== state.snake.length || (state.food && occupied.has(`${state.food.x}:${state.food.y}`))) return false
  if (!isChallenge(payload.challenge, payload.config) || !Array.isArray(payload.moves)) return false
  let lastTick = -1
  return payload.moves.every((move) => {
    const valid = Boolean(move && Number.isInteger(move.tick) && move.tick >= lastTick && move.tick <= state.ticks! && directions.has(move.direction))
    if (valid) lastTick = move.tick
    return valid
  })
}
