import { apiRequest } from './api'

const PENDING_RUN_KEY = 'snake.pending-run.v1'

export type RunChallenge = {
  challenge: string
  engineVersion: number
  expiresAt: string
  seed: number
  columns: number
  rows: number
}

export type MoveEvent = {
  tick: number
  direction: 'up' | 'down' | 'left' | 'right'
}

export type PendingRun = {
  version: 1
  challenge: string
  engineVersion: number
  expiresAt: string
  score: number
  durationMs: number
  ticks: number
  columns: number
  rows: number
  moves: MoveEvent[]
}

// A cold serverless function and a resumed Neon compute can take several
// seconds. Keep this bounded so offline guests can still start a local game.
export const CHALLENGE_TIMEOUT_MS = 8000

export async function requestRunChallenge(columns: number, rows: number): Promise<RunChallenge> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Score service timed out.'))
      controller.abort()
    }, CHALLENGE_TIMEOUT_MS)
  })
  try {
    // Bound the entire request, including response parsing. A late response
    // must never replace an already-started local game.
    return await Promise.race([
      apiRequest<RunChallenge>('/api/runs/challenge', {
        method: 'POST', body: JSON.stringify({ columns, rows }), signal: controller.signal,
      }),
      timeout,
    ])
  } finally {
    clearTimeout(timer)
  }
}

export function submitRun(run: PendingRun): Promise<{ saved: true; score: number; achievedAt: string }> {
  return apiRequest('/api/runs/submit', {
    method: 'POST',
    body: JSON.stringify(run),
  })
}

export function storePendingRun(run: PendingRun): void {
  try {
    sessionStorage.setItem(PENDING_RUN_KEY, JSON.stringify(run))
  } catch {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }
}

export function readPendingRun(): PendingRun | null {
  let stored: string | null = null
  try {
    stored = sessionStorage.getItem(PENDING_RUN_KEY)
  } catch {
    return null
  }
  if (!stored) return null
  try {
    const value = JSON.parse(stored) as Partial<PendingRun>
    if (
      value.version !== 1 ||
      typeof value.challenge !== 'string' ||
      !Number.isSafeInteger(value.engineVersion) ||
      typeof value.expiresAt !== 'string' ||
      !Number.isSafeInteger(value.score) ||
      !Number.isSafeInteger(value.durationMs) ||
      !Number.isSafeInteger(value.ticks) ||
      !Number.isSafeInteger(value.columns) ||
      !Number.isSafeInteger(value.rows) ||
      !Array.isArray(value.moves) ||
      !value.moves.every((move) => typeof move === 'object' && move !== null && Number.isSafeInteger(move.tick) && ['up', 'down', 'left', 'right'].includes(String(move.direction)))
    ) return null
    return value as PendingRun
  } catch {
    return null
  }
}

export function clearPendingRun(): void {
  try {
    sessionStorage.removeItem(PENDING_RUN_KEY)
  } catch {
    // The run still works when storage is unavailable.
  }
}

export async function submitPendingRun(): Promise<number | null> {
  const run = readPendingRun()
  if (!run) return null
  if (Number.isNaN(Date.parse(run.expiresAt)) || Date.parse(run.expiresAt) <= Date.now()) {
    throw new Error('This saved game has expired.')
  }
  const result = await submitRun(run)
  clearPendingRun()
  return result.score
}

