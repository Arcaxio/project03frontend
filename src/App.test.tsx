import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App, { ENDPOINT_URL, COUNTDOWN_KEY, TWENTY_FOUR_HOURS_MS } from './App'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as dbModule from './utils/db'

describe('App & Header Dark Mode', () => {
  beforeEach(() => {
    localStorage.clear()
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
    localStorage.setItem(COUNTDOWN_KEY, futureCountdown.toString())
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

  it('defaults to light mode when localStorage is empty and OS has no dark preference', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('dark-icon')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('light-icon')).not.toBeInTheDocument()
    expect(localStorage.getItem('darkMode')).toBe('false')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('uses OS preference when darkMode is not detected in localStorage', async () => {
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
    expect(localStorage.getItem('darkMode')).toBe('true')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('uses localStorage preference over OS preference when darkMode is set in localStorage', async () => {
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

    localStorage.setItem('darkMode', 'false')

    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('dark-icon')).toBeInTheDocument()
    })
    expect(localStorage.getItem('darkMode')).toBe('false')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('toggles dark mode when clicking the toggle button and updates localStorage and icons', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('dark-icon')).toBeInTheDocument()
    })
    const toggleBtn = screen.getByTestId('dark-mode-toggle')

    expect(localStorage.getItem('darkMode')).toBe('false')

    fireEvent.click(toggleBtn)
    expect(screen.getByTestId('light-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('dark-icon')).not.toBeInTheDocument()
    expect(localStorage.getItem('darkMode')).toBe('true')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    fireEvent.click(toggleBtn)
    expect(screen.getByTestId('dark-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('light-icon')).not.toBeInTheDocument()
    expect(localStorage.getItem('darkMode')).toBe('false')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('Maimai Data & Caching Logic & MUI Dropdown', () => {
  const mockInitialData = {
    updateTime: '2026-08-21T01:13:03.602Z',
    categories: ['POPS & ANIME', 'niconico & VOCALOID', 'EASTERN Project'],
  }

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('Requirement 1: Calls endpoint on first page load, saves to IndexedDB, sets 24h countdown in localStorage', async () => {
    vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(null)
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

    const countdownStr = localStorage.getItem(COUNTDOWN_KEY)
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

    // Set valid countdown in localStorage (1 hour in future)
    const futureCountdown = Date.now() + 60 * 60 * 1000
    localStorage.setItem(COUNTDOWN_KEY, futureCountdown.toString())

    render(<App />)

    await waitFor(() => {
      expect(getMaimaiDataSpy).toHaveBeenCalled()
    })

    // fetch should NOT be called
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(saveMaimaiDataSpy).not.toHaveBeenCalled()
  })

  it('Requirement 3a: Calls endpoint when countdown is reached; if updateTime is SAME, IndexedDB is not updated', async () => {
    vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockInitialData)
    const saveMaimaiDataSpy = vi.spyOn(dbModule, 'saveMaimaiData').mockResolvedValue(undefined)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockInitialData, // Same updateTime
    } as Response)

    // Set expired countdown in localStorage (1 hour in past)
    const pastCountdown = Date.now() - 60 * 60 * 1000
    localStorage.setItem(COUNTDOWN_KEY, pastCountdown.toString())

    render(<App />)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(ENDPOINT_URL)
    })

    // Since updateTime is same, saveMaimaiData should not be called
    expect(saveMaimaiDataSpy).not.toHaveBeenCalled()

    // Countdown should be updated to 24h in future
    const newCountdown = Number(localStorage.getItem(COUNTDOWN_KEY))
    expect(newCountdown).toBeGreaterThan(Date.now())
  })

  it('Requirement 3b: Calls endpoint when countdown is reached; if updateTime is DIFFERENT, replaces old data in IndexedDB', async () => {
    const newFetchedData = {
      updateTime: '2026-08-22T05:00:00.000Z',
      categories: ['POPS & ANIME', 'VARIETY', 'ORIGINAL'],
    }

    vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockInitialData)
    const saveMaimaiDataSpy = vi.spyOn(dbModule, 'saveMaimaiData').mockResolvedValue(undefined)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => newFetchedData,
    } as Response)

    const pastCountdown = Date.now() - 1000
    localStorage.setItem(COUNTDOWN_KEY, pastCountdown.toString())

    render(<App />)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(ENDPOINT_URL)
    })

    await waitFor(() => {
      expect(saveMaimaiDataSpy).toHaveBeenCalledWith(newFetchedData)
    })
  })

  it('Requirement 4 & 6: Falls back to IndexedDB data if endpoint fetch fails, and dropdown still works', async () => {
    vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockInitialData)

    // Alter endpoint to fail
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network Error / Failed to fetch'))

    // Expired or missing countdown to trigger endpoint call
    localStorage.removeItem(COUNTDOWN_KEY)

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

describe('Dropdowns and Main Layout Requirements', () => {
  const mockFullData = {
    updateTime: '2026-08-21T01:13:03.602Z',
    categories: ['POPS & ANIME', 'VOCALOID'],
    difficulties: ['BASIC', 'ADVANCED', 'EXPERT', 'MASTER'],
    types: ['STD', 'DX'],
    versions: ['maimai', 'maimai PLUS'],
  }

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockFullData)
    const futureCountdown = Date.now() + 60 * 60 * 1000
    localStorage.setItem(COUNTDOWN_KEY, futureCountdown.toString())
  })

  it('renders all 4 dropdowns (Category, Difficulty, Type, Version) using maimaiData', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByLabelText(/Category/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Difficulty/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Version/i)).toBeInTheDocument()
    })
  })

  it('allows each dropdown to be selected independently', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByLabelText(/Category/i)).toBeInTheDocument()
    })

    // Select Difficulty
    fireEvent.mouseDown(screen.getByLabelText(/Difficulty/i))
    const diffOption = await screen.findByTestId('difficulty-option-1')
    fireEvent.click(diffOption)

    // Select Type
    fireEvent.mouseDown(screen.getByLabelText(/Type/i))
    const typeOption = await screen.findByTestId('type-option-0')
    fireEvent.click(typeOption)

    // Select Version
    fireEvent.mouseDown(screen.getByLabelText(/Version/i))
    const verOption = await screen.findByTestId('version-option-1')
    fireEvent.click(verOption)

    // Select Category
    fireEvent.mouseDown(screen.getByLabelText(/Category/i))
    const catOption = await screen.findByTestId('category-option-0')
    fireEvent.click(catOption)

    // Check displayed values
    expect(screen.getByTestId('difficulty-select')).toHaveTextContent('ADVANCED')
    expect(screen.getByTestId('type-select')).toHaveTextContent('STD')
    expect(screen.getByTestId('version-select')).toHaveTextContent('maimai PLUS')
    expect(screen.getByTestId('category-select')).toHaveTextContent('POPS & ANIME')
  })

  it('centers the 4 dropdowns in a div with responsive flex-wrap classes', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('dropdowns-container')).toBeInTheDocument()
    })

    const container = screen.getByTestId('dropdowns-container')
    expect(container).toHaveClass('flex')
    expect(container).toHaveClass('flex-wrap')
    expect(container).toHaveClass('justify-center')

    const categoryFC = screen.getByTestId('category-form-control')
    const difficultyFC = screen.getByTestId('difficulty-form-control')
    const typeFC = screen.getByTestId('type-form-control')
    const versionFC = screen.getByTestId('version-form-control')

    expect(categoryFC).toHaveClass('sm:w-[calc(50%-0.5rem)]')
    expect(difficultyFC).toHaveClass('sm:w-[calc(50%-0.5rem)]')
    expect(typeFC).toHaveClass('sm:w-[calc(50%-0.5rem)]')
    expect(versionFC).toHaveClass('sm:w-[calc(50%-0.5rem)]')
  })

  it('renders a large display div below the dropdowns taking min 60% innerWindow height with p-4 padding', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('display-container')).toBeInTheDocument()
    })

    const displayDiv = screen.getByTestId('display-container')
    expect(displayDiv).toHaveClass('min-h-[60vh]')
    expect(displayDiv).toHaveClass('p-4')
  })
})

describe('New Requirements: Title & Level inputs, FILTERS, GRID, RESULTS virtualized list', () => {
  const mockDataWithSongs = {
    updateTime: '2026-08-21T01:13:03.602Z',
    categories: ['POPS & ANIME'],
    songs: [
      { title: 'mearly' },
      { title: 'ame' },
      { title: 'hello' },
      { title: 'world' },
      { title: 'melt' },
    ],
  }

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockDataWithSongs)
    const futureCountdown = Date.now() + 60 * 60 * 1000
    localStorage.setItem(COUNTDOWN_KEY, futureCountdown.toString())
  })

  it('Requirement 1: Renders Title and Level MUI inputs with working state', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('title-input')).toBeInTheDocument()
      expect(screen.getByTestId('level-input')).toBeInTheDocument()
    })

    const titleInput = screen.getByTestId('title-input').querySelector('input')!
    const levelInput = screen.getByTestId('level-input').querySelector('input')!

    fireEvent.change(titleInput, { target: { value: 'me' } })
    expect(titleInput).toHaveValue('me')

    fireEvent.change(levelInput, { target: { value: '12+' } })
    expect(levelInput).toHaveValue('12+')
  })

  it('Requirement 3: Check classnames FILTERS on dropdowns-container and GRID on display-container', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('dropdowns-container')).toBeInTheDocument()
      expect(screen.getByTestId('display-container')).toBeInTheDocument()
    })

    const dropdownsContainer = screen.getByTestId('dropdowns-container')
    const displayContainer = screen.getByTestId('display-container')

    expect(dropdownsContainer).toHaveClass('FILTERS')
    expect(displayContainer).toHaveClass('GRID')
  })

  it('Requirement 4, 5, 6 & 7: Renders RESULTS div between FILTERS and GRID with 16rem height, scrollable, bg-gray-50 dark:bg-gray-800/50, and filters songs by title', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('results-container')).toBeInTheDocument()
    })

    const resultsContainer = screen.getByTestId('results-container')

    expect(resultsContainer).toHaveClass('RESULTS')
    expect(resultsContainer).toHaveClass('h-[16rem]')
    expect(resultsContainer).toHaveClass('overflow-auto')
    expect(resultsContainer).toHaveClass('bg-gray-50')
    expect(resultsContainer).toHaveClass('dark:bg-gray-800/50')

    // Filter by title "me" -> should match "mearly", "ame", "melt"
    const titleInput = screen.getByTestId('title-input').querySelector('input')!
    fireEvent.change(titleInput, { target: { value: 'me' } })

    expect(screen.getByText('mearly')).toBeInTheDocument()
    expect(screen.getByText('ame')).toBeInTheDocument()
    expect(screen.getByText('melt')).toBeInTheDocument()
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
    expect(screen.queryByText('world')).not.toBeInTheDocument()
  })
})
