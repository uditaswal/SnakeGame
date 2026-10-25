import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('app routing', () => {
  afterEach(() => {
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
      'https://snake-game-udit-aswals-projects.vercel.app/terms',
    )
  })
})
