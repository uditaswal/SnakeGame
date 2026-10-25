import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('app routing', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('moves the viewport to the top and updates metadata after navigation', () => {
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)

    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <App />
      </MemoryRouter>,
    )

    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    scrollTo.mockClear()

    fireEvent.click(screen.getByRole('link', { name: 'Terms' }))

    expect(screen.getByRole('heading', { name: 'Terms of use' })).toBeInTheDocument()
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    expect(document.title).toBe('Terms of use · Snake')
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://snake-game-two-flame.vercel.app/terms',
    )
  })

  it('shows the signed-in username in the shared navigation', async () => {
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('fetch', vi.fn(async (path: string) => ({
      ok: true,
      status: 200,
      json: async () => path === '/api/auth/session'
        ? { user: { id: 'user-1', username: 'PlayerOne', createdAt: new Date().toISOString() } }
        : { entries: [] },
    })))

    render(
      <MemoryRouter initialEntries={['/leaderboard']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('link', { name: 'Account: PlayerOne' })).toHaveTextContent('PlayerOne')
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  it('updates the shared navigation immediately after sign in', async () => {
    vi.stubGlobal('scrollTo', vi.fn())
    const fetchMock = vi.fn(async (path: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => path === '/api/auth/login' && init?.method === 'POST'
        ? { user: { id: 'user-2', username: 'SnakeFan', createdAt: new Date().toISOString() } }
        : { user: null },
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/account']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.change(await screen.findByRole('textbox', { name: 'Username' }), { target: { value: 'SnakeFan' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery staple' } })
    const signInButtons = screen.getAllByRole('button', { name: 'Sign in' })
    fireEvent.click(signInButtons[signInButtons.length - 1])

    expect(await screen.findByRole('link', { name: 'Account: SnakeFan' })).toHaveTextContent('SnakeFan')
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST' }))
  })
})
