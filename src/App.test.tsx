import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App, { ENDPOINT_URL, COUNTDOWN_KEY, TWENTY_FOUR_HOURS_MS } from './App'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as dbModule from './utils/db'

describe('App & Header Dark Mode', () => {
  beforeEach(() => {
    sessionStorage.clear()
    document.documentElement.classList.remove('dark')
    vi.restoreAllMocks()
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    // Prevent unhandled async state updates
    vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue({ updateTime: '1', categories: [] })
    const futureCountdown = Date.now() + 60 * 60 * 1000
    sessionStorage.setItem(COUNTDOWN_KEY, futureCountdown.toString())
  })

  it('renders static header with height 4rem and 3 distinct sides (left, center, right)', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })
    const header = screen.getByTestId('header')
    expect(header).toHaveStyle({ height: '4rem' })

    const left = screen.getByTestId('header-left')
    const center = screen.getByTestId('header-center')
    const right = screen.getByTestId('header-right')

    expect(left).toBeInTheDocument()
    expect(center).toBeInTheDocument()
    expect(right).toBeInTheDocument()
  })

  it('places dark mode toggle button on the left side of the header', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('header-left')).toBeInTheDocument()
    })
    const leftSide = screen.getByTestId('header-left')
    const toggleBtn = screen.getByTestId('dark-mode-toggle')

    expect(leftSide).toContainElement(toggleBtn)
  })

  it('defaults to light mode when sessionStorage is empty and OS has no dark preference', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('dark-icon')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('light-icon')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('darkMode')).toBe('false')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('uses OS preference when darkMode is not detected in sessionStorage', async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('light-icon')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('dark-icon')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('darkMode')).toBe('true')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('uses sessionStorage preference over OS preference when darkMode is set in sessionStorage', async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    sessionStorage.setItem('darkMode', 'false')

    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('dark-icon')).toBeInTheDocument()
    })
    expect(sessionStorage.getItem('darkMode')).toBe('false')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('toggles dark mode when clicking the toggle button and updates sessionStorage and icons', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('dark-icon')).toBeInTheDocument()
    })
    const toggleBtn = screen.getByTestId('dark-mode-toggle')

    expect(sessionStorage.getItem('darkMode')).toBe('false')

    fireEvent.click(toggleBtn)
    expect(screen.getByTestId('light-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('dark-icon')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('darkMode')).toBe('true')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    fireEvent.click(toggleBtn)
    expect(screen.getByTestId('dark-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('light-icon')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('darkMode')).toBe('false')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('Maimai Data & Caching Logic & MUI Dropdown', () => {
  const mockInitialData = {
    updateTime: '2026-08-21T01:13:03.602Z',
    categories: ['POPS & ANIME', 'niconico & VOCALOID', 'EASTERN Project'],
  }

  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('Requirement 1: Calls endpoint on first page load, saves to IndexedDB, sets 24h countdown in sessionStorage', async () => {
    const getMaimaiDataSpy = vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(null)
    const saveMaimaiDataSpy = vi.spyOn(dbModule, 'saveMaimaiData').mockResolvedValue(undefined)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockInitialData,
    } as Response)

    const startTime = Date.now()
    render(<App />)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(ENDPOINT_URL)
    })

    await waitFor(() => {
      expect(saveMaimaiDataSpy).toHaveBeenCalledWith(mockInitialData)
    })

    const countdownStr = sessionStorage.getItem(COUNTDOWN_KEY)
    expect(countdownStr).not.toBeNull()
    const countdownTime = Number(countdownStr)
    expect(countdownTime).toBeGreaterThanOrEqual(startTime + TWENTY_FOUR_HOURS_MS - 1000)

    // Verify MUI Dropdown rendered categories
    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument()
  })

  it('Requirement 2: Bypasses endpoint fetch when IndexedDB has data and countdown has not been reached', async () => {
    const getMaimaiDataSpy = vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockInitialData)
    const saveMaimaiDataSpy = vi.spyOn(dbModule, 'saveMaimaiData').mockResolvedValue(undefined)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockInitialData,
    } as Response)

    // Set valid countdown in sessionStorage (1 hour in future)
    const futureCountdown = Date.now() + 60 * 60 * 1000
    sessionStorage.setItem(COUNTDOWN_KEY, futureCountdown.toString())

    render(<App />)

    await waitFor(() => {
      expect(getMaimaiDataSpy).toHaveBeenCalled()
    })

    // fetch should NOT be called
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(saveMaimaiDataSpy).not.toHaveBeenCalled()
  })

  it('Requirement 3a: Calls endpoint when countdown is reached; if updateTime is SAME, IndexedDB is not updated', async () => {
    const getMaimaiDataSpy = vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockInitialData)
    const saveMaimaiDataSpy = vi.spyOn(dbModule, 'saveMaimaiData').mockResolvedValue(undefined)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockInitialData, // Same updateTime
    } as Response)

    // Set expired countdown in sessionStorage (1 hour in past)
    const pastCountdown = Date.now() - 60 * 60 * 1000
    sessionStorage.setItem(COUNTDOWN_KEY, pastCountdown.toString())

    render(<App />)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(ENDPOINT_URL)
    })

    // Since updateTime is same, saveMaimaiData should not be called
    expect(saveMaimaiDataSpy).not.toHaveBeenCalled()

    // Countdown should be updated to 24h in future
    const newCountdown = Number(sessionStorage.getItem(COUNTDOWN_KEY))
    expect(newCountdown).toBeGreaterThan(Date.now())
  })

  it('Requirement 3b: Calls endpoint when countdown is reached; if updateTime is DIFFERENT, replaces old data in IndexedDB', async () => {
    const newFetchedData = {
      updateTime: '2026-08-22T05:00:00.000Z',
      categories: ['POPS & ANIME', 'VARIETY', 'ORIGINAL'],
    }

    const getMaimaiDataSpy = vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockInitialData)
    const saveMaimaiDataSpy = vi.spyOn(dbModule, 'saveMaimaiData').mockResolvedValue(undefined)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => newFetchedData,
    } as Response)

    const pastCountdown = Date.now() - 1000
    sessionStorage.setItem(COUNTDOWN_KEY, pastCountdown.toString())

    render(<App />)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(ENDPOINT_URL)
    })

    await waitFor(() => {
      expect(saveMaimaiDataSpy).toHaveBeenCalledWith(newFetchedData)
    })
  })

  it('Requirement 4 & 6: Falls back to IndexedDB data if endpoint fetch fails, and dropdown still works', async () => {
    const getMaimaiDataSpy = vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockInitialData)

    // Alter endpoint to fail
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network Error / Failed to fetch'))

    // Expired or missing countdown to trigger endpoint call
    sessionStorage.removeItem(COUNTDOWN_KEY)

    render(<App />)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(ENDPOINT_URL)
    })

    // Expect dropdown to still work with IndexedDB data
    await waitFor(() => {
      expect(screen.getByLabelText(/Category/i)).toBeInTheDocument()
    })
  })
})
