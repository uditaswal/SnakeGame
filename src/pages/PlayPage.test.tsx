import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGame, DEFAULT_CONFIG } from '../game/engine'
import { RUN_STORAGE_KEY, serializeRun } from '../game/persistence'
import { PlayPage } from './PlayPage'
import { CHALLENGE_TIMEOUT_MS, readPendingRun } from '../lib/run-api'

const challengeResponse = {
  challenge: 'a'.repeat(43),
  engineVersion: 2,
  seed: 123,
  columns: 20,
  rows: 20,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
}

describe('PlayPage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => challengeResponse,
    })))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('offers keyboard, swipe, and labeled touch controls without requiring an account', () => {
    render(<MemoryRouter><PlayPage /></MemoryRouter>)

    expect(screen.getByRole('application', { name: 'Snake game board' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('button', { name: 'Move up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move left' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move down' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move right' })).toBeInTheDocument()
    // expect(screen.getByText(/Guest scores stay on this device/)).toBeInTheDocument()
    const food = document.querySelector('.food') as HTMLElement
    expect(food.style.left).toMatch(/%$/)
    expect(food.style.top).toMatch(/%$/)
  })

  it('starts, pauses, and resumes from the keyboard', async () => {
    render(<MemoryRouter><PlayPage /></MemoryRouter>)

    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    await waitFor(() => expect(screen.queryByText('Ready?')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()

    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    expect(screen.getByText('Paused.')).toBeInTheDocument()

    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    expect(screen.queryByText('Paused.')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { code: 'Space', key: ' ', repeat: true })
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('starts a fresh game when Space is pressed after game over', async () => {
    const completedGame = {
      ...createGame(DEFAULT_CONFIG, () => 0),
      status: 'lost' as const,
      lossReason: 'wall' as const,
      ticks: 6,
    }
    sessionStorage.setItem(RUN_STORAGE_KEY, serializeRun({
      state: completedGame,
      config: DEFAULT_CONFIG,
      elapsedMs: 780,
      challenge: null,
      moves: [],
    }))
    render(<MemoryRouter><PlayPage /></MemoryRouter>)

    expect(screen.getByText('Game over.')).toBeInTheDocument()
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument())
  })

  it('pauses an active run when the page becomes hidden', async () => {
    render(<MemoryRouter><PlayPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument())

    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    fireEvent(document, new Event('visibilitychange'))

    expect(screen.getByText('Paused.')).toBeInTheDocument()
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  it('keeps guest play available when the score service cannot issue a challenge', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    render(<MemoryRouter><PlayPage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument())
    expect(screen.queryByText('Preparing board…')).not.toBeInTheDocument()
    expect(screen.getByText(/Playing locally/)).toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem(RUN_STORAGE_KEY)!).challenge).toBeNull()
  })

  it('starts locally after a stalled request and ignores its late response', async () => {
    vi.useFakeTimers()
    let resolveRequest!: (value: unknown) => void
    const fetchMock = vi.fn(() => new Promise(resolve => { resolveRequest = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    render(<MemoryRouter><PlayPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByText('Preparing board…')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(CHALLENGE_TIMEOUT_MS) })
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.queryByText('Preparing board…')).not.toBeInTheDocument()
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true)
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    await act(async () => {
      resolveRequest({ ok: true, status: 201, json: async () => challengeResponse })
    })
    expect(screen.getByText('Paused.')).toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem(RUN_STORAGE_KEY)!).challenge).toBeNull()
  })

  it('keeps a run eligible when a cold challenge responds after two seconds', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(() => new Promise(resolve => {
      setTimeout(() => resolve({ ok: true, status: 201, json: async () => challengeResponse }), 5600)
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<MemoryRouter><PlayPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    await act(async () => { await vi.advanceTimersByTimeAsync(5600) })
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.queryByText(/Playing locally/)).not.toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem(RUN_STORAGE_KEY)!).challenge.seed).toBe(123)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('clears preparation and retains the challenge when the service succeeds', async () => {
    render(<MemoryRouter><PlayPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument())
    expect(screen.queryByText('Preparing board…')).not.toBeInTheDocument()
    expect(screen.queryByText(/Playing locally/)).not.toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem(RUN_STORAGE_KEY)!).challenge.seed).toBe(123)
  })

  it('explains why an offline run cannot be published', async () => {
    const base = createGame(DEFAULT_CONFIG, () => 0)
    sessionStorage.setItem(RUN_STORAGE_KEY, serializeRun({
      state: { ...base, snake: [...base.snake, { x: 7, y: 10 }], food: { x: 0, y: 0 }, score: 1, ticks: 6, status: 'lost', lossReason: 'wall' },
      config: DEFAULT_CONFIG,
      elapsedMs: 780,
      challenge: null,
      moves: [],
    }))
    render(<MemoryRouter><PlayPage /></MemoryRouter>)

    expect(await screen.findByText('This local run cannot be added to the leaderboard.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('offers a retry when saving a challenge-backed score fails', async () => {
    const base = createGame(DEFAULT_CONFIG, () => 0)
    sessionStorage.setItem(RUN_STORAGE_KEY, serializeRun({
      state: { ...base, snake: [...base.snake, { x: 7, y: 10 }], food: { x: 0, y: 0 }, score: 1, ticks: 6, status: 'lost', lossReason: 'wall' },
      config: DEFAULT_CONFIG,
      elapsedMs: 780,
      challenge: { ...challengeResponse, expiresAt: new Date(Date.now() + 120_000).toISOString() },
      moves: [],
    }))
    const fetchMock = vi.fn(async (path: string) => path === '/api/auth/session'
      ? { ok: true, status: 200, json: async () => ({ user: { id: 'test', username: 'Tester', createdAt: new Date().toISOString() } }) }
      : { ok: false, status: 503, json: async () => ({ error: { code: 'UNAVAILABLE', message: 'Try again.' } }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<MemoryRouter><PlayPage /></MemoryRouter>)

    expect(await screen.findByText('Could not save this score. Your local best is safe.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(fetchMock.mock.calls.filter(([path]) => path === '/api/runs/submit')).toHaveLength(2))
  })

  it('automatically saves a challenge-backed score for a signed-in player', async () => {
    const base = createGame(DEFAULT_CONFIG, () => 0)
    sessionStorage.setItem(RUN_STORAGE_KEY, serializeRun({
      state: { ...base, snake: [...base.snake, { x: 7, y: 10 }], food: { x: 0, y: 0 }, score: 1, ticks: 6, status: 'lost', lossReason: 'wall' },
      config: DEFAULT_CONFIG,
      elapsedMs: 780,
      challenge: { ...challengeResponse, expiresAt: new Date(Date.now() + 120_000).toISOString() },
      moves: [],
    }))
    const fetchMock = vi.fn(async (path: string) => path === '/api/auth/session'
      ? { ok: true, status: 200, json: async () => ({ user: { id: 'test', username: 'Tester', createdAt: new Date().toISOString() } }) }
      : { ok: true, status: 201, json: async () => ({ saved: true, score: 1, achievedAt: new Date().toISOString() }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<MemoryRouter><PlayPage /></MemoryRouter>)

    expect(await screen.findByRole('link', { name: 'Score saved — view leaderboard' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/runs/submit', expect.objectContaining({ method: 'POST' }))
    expect(readPendingRun()).toBeNull()
  })
})
