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

    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument()
  })

  it('Requirement 2: Bypasses endpoint fetch when IndexedDB has data and countdown has not been reached', async () => {
    const getMaimaiDataSpy = vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockInitialData)
    const saveMaimaiDataSpy = vi.spyOn(dbModule, 'saveMaimaiData').mockResolvedValue(undefined)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockInitialData,
    } as Response)

    const futureCountdown = Date.now() + 60 * 60 * 1000
    localStorage.setItem(COUNTDOWN_KEY, futureCountdown.toString())

    render(<App />)

    await waitFor(() => {
      expect(getMaimaiDataSpy).toHaveBeenCalled()
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(saveMaimaiDataSpy).not.toHaveBeenCalled()
  })

  it('Requirement 3a: Calls endpoint when countdown is reached; if updateTime is SAME, IndexedDB is not updated', async () => {
    vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockInitialData)
    const saveMaimaiDataSpy = vi.spyOn(dbModule, 'saveMaimaiData').mockResolvedValue(undefined)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockInitialData,
    } as Response)

    const pastCountdown = Date.now() - 60 * 60 * 1000
    localStorage.setItem(COUNTDOWN_KEY, pastCountdown.toString())

    render(<App />)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(ENDPOINT_URL)
    })

    expect(saveMaimaiDataSpy).not.toHaveBeenCalled()

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

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network Error / Failed to fetch'))

    localStorage.removeItem(COUNTDOWN_KEY)

    render(<App />)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(ENDPOINT_URL)
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/Category/i)).toBeInTheDocument()
    })
  })
})

describe('ImportExport Header Button, Sheet Popover and maimaiB50Charts GRID Requirements', () => {
  const mockB50Data = {
    updateTime: '2026-08-21T01:13:03.602Z',
    difficulties: [{ difficulty: 'expert', name: 'EXPERT', color: '#f64861' }],
    songs: [
      {
        songId: 'song_01',
        title: 'Test Song 1',
        imageName: 'cover_1.png',
        sheets: [
          { type: 'dx', difficulty: 'expert', level: '12', internalLevelValue: 12.3 },
        ],
      },
    ],
  }

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockB50Data)
    const futureCountdown = Date.now() + 60 * 60 * 1000
    localStorage.setItem(COUNTDOWN_KEY, futureCountdown.toString())
  })

  it('Requirement 1: Renders IconButton using @mui/icons-material/ImportExport on header right', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('header-right')).toBeInTheDocument()
    })

    const headerRight = screen.getByTestId('header-right')
    const importExportBtn = screen.getByTestId('import-export-button')
    const importExportIcon = screen.getByTestId('import-export-icon')

    expect(headerRight).toContainElement(importExportBtn)
    expect(importExportBtn).toContainElement(importExportIcon)
  })

  it('Requirement 2 & 3: Pressing sheet button opens popover with 3x2 grid of 6 target score buttons, Target TextField, and confirm button', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('results-container')).toBeInTheDocument()
    })

    const sheetBtn = screen.getByTestId('sheet-button')
    fireEvent.click(sheetBtn)

    await waitFor(() => {
      expect(screen.getByTestId('sheet-popover')).toBeInTheDocument()
    })

    const popoverGrid = screen.getByTestId('popover-grid')
    expect(popoverGrid).toHaveClass('grid')
    expect(popoverGrid).toHaveClass('grid-cols-2')

    expect(screen.getByTestId('score-btn-S')).toHaveTextContent('S')
    expect(screen.getByTestId('score-btn-S+')).toHaveTextContent('S+')
    expect(screen.getByTestId('score-btn-SS')).toHaveTextContent('SS')
    expect(screen.getByTestId('score-btn-SS+')).toHaveTextContent('SS+')
    expect(screen.getByTestId('score-btn-SSS')).toHaveTextContent('SSS')
    expect(screen.getByTestId('score-btn-SSS+')).toHaveTextContent('SSS+')

    expect(screen.getByLabelText('Target')).toBeInTheDocument()
    expect(screen.getByTestId('confirm-btn')).toHaveTextContent('confirm')
  })

  it('Requirement 4: Confirm button appends object to localStorage "maimaiB50Charts" with exact format', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('results-container')).toBeInTheDocument()
    })

    const sheetBtn = screen.getByTestId('sheet-button')
    fireEvent.click(sheetBtn)

    await waitFor(() => {
      expect(screen.getByTestId('score-btn-SS+')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('score-btn-SS+'))

    const targetInput = screen.getByLabelText('Target')
    expect(targetInput).toHaveValue('99.5')

    const confirmBtn = screen.getByTestId('confirm-btn')
    fireEvent.click(confirmBtn)

    const storedChartsStr = localStorage.getItem('maimaiB50Charts')
    expect(storedChartsStr).not.toBeNull()
    const storedCharts = JSON.parse(storedChartsStr!)
    expect(storedCharts).toEqual([
      {
        songId: 'song_01',
        imageName: 'cover_1.png',
        internalLevelValue: 12.3,
        target: 99.5,
        type: 'dx',
        rating: 0,
      },
    ])
  })

  it('Requirement 5: Confirm button is disabled when maimaiB50Charts has 50 objects', async () => {
    const full50 = Array.from({ length: 50 }, (_, i) => ({
      songId: `song_${i}`,
      imageName: `cover_${i}.png`,
      internalLevelValue: 10,
      target: 100,
      type: 'dx',
      rating: 0,
    }))
    localStorage.setItem('maimaiB50Charts', JSON.stringify(full50))

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('results-container')).toBeInTheDocument()
    })

    const sheetBtn = screen.getByTestId('sheet-button')
    fireEvent.click(sheetBtn)

    await waitFor(() => {
      expect(screen.getByTestId('confirm-btn')).toBeInTheDocument()
    })

    expect(screen.getByTestId('confirm-btn')).toBeDisabled()
  })

  it('Requirement 6: In the GRID div, maps maimaiB50Charts with h-[6rem], w-[12rem], top div (songId with truncate className, type img with h-3, no mb-1), bottom div (flex with cover img 3.5rem x 3.5rem, internalLevelValue above target, rating text-xl)', async () => {
    const sampleCharts = [
      {
        songId: 'song_dx_01',
        imageName: 'cover_sample.png',
        internalLevelValue: 13.5,
        target: 100.5,
        type: 'dx',
        rating: 0,
      },
    ]
    localStorage.setItem('maimaiB50Charts', JSON.stringify(sampleCharts))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('display-container')).toBeInTheDocument()
    })

    const chartItems = screen.getAllByTestId('b50-chart-item')
    expect(chartItems.length).toBe(1)

    const item = chartItems[0]
    expect(item).toHaveClass('h-[6rem]')
    expect(item).toHaveClass('w-[12rem]')
    expect(item).toHaveClass('justify-between')
    expect(item).toHaveClass('flex')
    expect(item).toHaveClass('flex-col')

    const topDiv = screen.getByTestId('b50-top-div')
    expect(topDiv).toHaveTextContent('song_dx_01')
    expect(topDiv).not.toHaveClass('mb-1')
    const topSpan = topDiv.querySelector('span')
    expect(topSpan).toHaveClass('truncate')

    const typeImg = screen.getByTestId('b50-type-badge')
    expect(typeImg).toHaveClass('h-3')
    expect(typeImg).toHaveAttribute('src', 'https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/type-dx.png')

    const bottomDiv = screen.getByTestId('b50-bottom-div')
    expect(bottomDiv).toHaveClass('flex')

    const coverImg = screen.getByTestId('b50-chart-img')
    expect(coverImg).toHaveAttribute('src', 'https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover-m/cover_sample.png')
    expect(coverImg).toHaveStyle({ width: '3.5rem', height: '3.5rem' })

    const rightDiv = screen.getByTestId('b50-right-div')
    expect(rightDiv).toHaveTextContent('13.5100.50')
    expect(rightDiv.children[0]).toHaveTextContent('13.5')
    expect(rightDiv.children[1]).toHaveTextContent('100.5')
    const ratingSpan = rightDiv.querySelector('span')
    expect(ratingSpan).toHaveClass('text-xl')
    expect(ratingSpan).toHaveTextContent('0')
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

  it('renders all 4 Autocomplete dropdowns (Category, Difficulty, Type, Version) using maimaiData', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByLabelText(/Category/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Difficulty/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Version/i)).toBeInTheDocument()
    })
  })

  it('allows each Autocomplete dropdown to be selected and unselected independently', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByLabelText(/Category/i)).toBeInTheDocument()
    })

    const categoryInput = screen.getByLabelText(/Category/i)
    fireEvent.focus(categoryInput)
    fireEvent.keyDown(categoryInput, { key: 'ArrowDown' })
    const catOption = await screen.findByText('POPS & ANIME')
    fireEvent.click(catOption)

    expect(categoryInput).toHaveValue('POPS & ANIME')

    // Unselect/Clear Category
    const categoryContainer = screen.getByTestId('category-form-control')
    const clearCatBtn = categoryContainer.querySelector('.MuiAutocomplete-clearIndicator')
    if (clearCatBtn) {
      fireEvent.click(clearCatBtn)
      expect(categoryInput).toHaveValue('')
    }
  })

  it('centers the filters in a div with responsive flex-wrap classes', async () => {
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
    categories: ['POPS & ANIME', 'VOCALOID'],
    songs: [
      { title: 'mearly', category: 'POPS & ANIME', imageName: 'cover1.png' },
      { title: 'ame', category: 'POPS & ANIME', imageName: 'cover2.png' },
      { title: 'hello', category: 'VOCALOID', imageName: 'cover3.png' },
      { title: 'world', category: 'VOCALOID', imageName: 'cover4.png' },
      { title: 'melt', category: 'POPS & ANIME', imageName: 'cover5.png' },
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

  it('Requirement 1: Renders Title and Level MUI TextField inputs with type="search" and working state', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('title-input')).toBeInTheDocument()
      expect(screen.getByTestId('level-input')).toBeInTheDocument()
    })

    const titleInput = screen.getByTestId('title-input').querySelector('input')!
    const levelInput = screen.getByTestId('level-input').querySelector('input')!

    expect(titleInput).toHaveAttribute('type', 'search')
    expect(levelInput).toHaveAttribute('type', 'search')

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

    const titleInput = screen.getByTestId('title-input').querySelector('input')!
    fireEvent.change(titleInput, { target: { value: 'me' } })

    expect(screen.getByText('mearly')).toBeInTheDocument()
    expect(screen.getByText('ame')).toBeInTheDocument()
    expect(screen.getByText('melt')).toBeInTheDocument()
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
    expect(screen.queryByText('world')).not.toBeInTheDocument()
  })

  it('Requirement: Filters RESULTS based on selected Category via Autocomplete', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('category-select')).toBeInTheDocument()
    })

    const categoryInput = screen.getByLabelText(/Category/i)
    fireEvent.focus(categoryInput)
    fireEvent.keyDown(categoryInput, { key: 'ArrowDown' })
    const vocaloidOption = await screen.findByText('VOCALOID')
    fireEvent.click(vocaloidOption)

    expect(screen.getByText('hello')).toBeInTheDocument()
    expect(screen.getByText('world')).toBeInTheDocument()
    expect(screen.queryByText('mearly')).not.toBeInTheDocument()
    expect(screen.queryByText('ame')).not.toBeInTheDocument()
    expect(screen.queryByText('melt')).not.toBeInTheDocument()
  })

  it('Requirement: Renders cover image on the left of song title with CloudFront URL and loading lazy', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('results-container')).toBeInTheDocument()
    })

    const images = screen.getAllByTestId('song-image')
    expect(images.length).toBeGreaterThan(0)
    expect(images[0]).toHaveAttribute('src', 'https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover-m/cover1.png')
    expect(images[0]).toHaveAttribute('loading', 'lazy')
  })
})

describe('Song Row Layout & Sheet Buttons Requirements', () => {
  const mockDetailedData = {
    updateTime: '2026-08-21T01:13:03.602Z',
    difficulties: [
      { difficulty: 'basic', name: 'BASIC', color: '#22bb5b' },
      { difficulty: 'advanced', name: 'ADVANCED', color: '#fb9c2d' },
      { difficulty: 'expert', name: 'EXPERT', color: '#f64861' },
      { difficulty: 'master', name: 'MASTER', color: '#9e45e2' },
    ],
    songs: [
      {
        title: 'STD Song',
        imageName: 'cover_std.png',
        sheets: [
          { type: 'std', difficulty: 'basic', level: '3' },
          { type: 'std', difficulty: 'advanced', level: '7' },
          { type: 'std', difficulty: 'master', level: '11+' },
        ],
      },
      {
        title: 'DX Song',
        imageName: 'cover_dx.png',
        sheets: [
          { type: 'dx', difficulty: 'basic', level: '4' },
          { type: 'dx', difficulty: 'expert', level: '9' },
        ],
      },
    ],
  }

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockDetailedData)
    const futureCountdown = Date.now() + 60 * 60 * 1000
    localStorage.setItem(COUNTDOWN_KEY, futureCountdown.toString())
  })

  it('Requirement 1: Cover image is 5rem in width and height, container padding is p-2 and min-h is 6rem', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('results-container')).toBeInTheDocument()
    })

    const images = screen.getAllByTestId('song-image')
    expect(images[0]).toHaveClass('w-[5rem]')
    expect(images[0]).toHaveClass('h-[5rem]')

    const rows = screen.getAllByTestId('virtual-row')
    expect(rows[0]).toHaveClass('p-2')
    expect(rows[0]).toHaveClass('min-h-[6rem]')
  })

  it('Requirement 2: Container is justify-between on sm, img and span in first div, maps sheets to responsive buttons with type="button", difficulty color and level text', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('results-container')).toBeInTheDocument()
    })

    const row = screen.getByText('STD Song').closest('[data-testid="virtual-row"]')!
    expect(row).toHaveClass('sm:justify-between')
    expect(row).toHaveClass('justify-start')
    expect(row).toHaveClass('flex-col')
    expect(row).toHaveClass('sm:flex-row')

    const firstDiv = screen.getByText('STD Song').parentElement!
    const imgWrapper = screen.getAllByTestId('song-image')[0].parentElement!
    expect(firstDiv).toContainElement(imgWrapper)
    expect(firstDiv).toContainElement(screen.getByText('STD Song'))

    const sheetContainers = screen.getAllByTestId('song-sheets-container')
    expect(sheetContainers[0]).toHaveClass('gap-2')
    expect(sheetContainers[0]).toHaveClass('items-center')
    expect(sheetContainers[0]).toHaveClass('sm:items-end')
    expect(sheetContainers[0]).toHaveClass('justify-center')
    expect(sheetContainers[0]).toHaveClass('sm:justify-end')
    const stdButtons = sheetContainers[0].querySelectorAll('button')
    expect(stdButtons.length).toBe(3)

    expect(stdButtons[0]).toHaveAttribute('type', 'button')
    expect(stdButtons[0]).toHaveClass('w-[3rem]')
    expect(stdButtons[0]).toHaveClass('h-[3rem]')
    expect(stdButtons[0]).toHaveClass('sm:w-[2.25rem]')
    expect(stdButtons[0]).toHaveClass('sm:h-[2.25rem]')
    expect(stdButtons[0]).toHaveClass('text-base')
    expect(stdButtons[0]).toHaveClass('sm:text-sm')
    expect(stdButtons[0]).toHaveTextContent('3')
    expect(stdButtons[0]).toHaveTextContent('(std)')
    expect(stdButtons[0]).toHaveStyle({ backgroundColor: 'rgb(34, 187, 91)' }) // #22bb5b

    const dxStdSpan = stdButtons[0].querySelector('span:nth-child(2)')!
    expect(dxStdSpan).toHaveClass('text-xs')
    expect(dxStdSpan).toHaveClass('sm:text-[10px]')

    expect(stdButtons[1]).toHaveTextContent('7')
    expect(stdButtons[1]).toHaveStyle({ backgroundColor: 'rgb(251, 156, 45)' }) // #fb9c2d

    expect(stdButtons[2]).toHaveTextContent('11+')
    expect(stdButtons[2]).toHaveStyle({ backgroundColor: 'rgb(158, 69, 226)' }) // #9e45e2
  })

  it('Requirement 3: First div is relative, has top-0 left-0 absolute image with type-std.png or type-dx.png and width 2.5rem', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('results-container')).toBeInTheDocument()
    })

    const stdFirstDiv = screen.getByText('STD Song').parentElement!
    expect(stdFirstDiv).toHaveClass('relative')

    const badges = screen.getAllByTestId('sheet-type-badge')
    expect(badges.length).toBe(2)

    expect(badges[0]).toHaveClass('absolute')
    expect(badges[0]).toHaveClass('top-0')
    expect(badges[0]).toHaveClass('left-0')
    expect(badges[0]).toHaveClass('w-[2.5rem]')
    expect(badges[0]).not.toHaveClass('h-[1rem]')
    expect(badges[0]).toHaveAttribute('src', 'https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/type-std.png')

    expect(badges[1]).toHaveClass('absolute')
    expect(badges[1]).toHaveClass('top-0')
    expect(badges[1]).toHaveClass('left-0')
    expect(badges[1]).toHaveClass('w-[2.5rem]')
    expect(badges[1]).not.toHaveClass('h-[1rem]')
    expect(badges[1]).toHaveAttribute('src', 'https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/type-dx.png')
  })

  it('Requirement 5: Test by typing "Paranoia" into Title input box, verifying 8 sheets and side-by-side badges box', async () => {
    const paranoiaData = {
      updateTime: '2026-08-21T01:13:03.602Z',
      difficulties: [
        { difficulty: 'basic', name: 'BASIC', color: '#22bb5b' },
        { difficulty: 'advanced', name: 'ADVANCED', color: '#fb9c2d' },
        { difficulty: 'expert', name: 'EXPERT', color: '#f64861' },
        { difficulty: 'master', name: 'MASTER', color: '#9e45e2' },
      ],
      songs: [
        {
          title: 'Paranoia',
          category: '東方Project',
          imageName: 'paranoia.png',
          sheets: [
            { type: 'dx', difficulty: 'basic', level: '4' },
            { type: 'dx', difficulty: 'advanced', level: '7' },
            { type: 'dx', difficulty: 'expert', level: '9' },
            { type: 'dx', difficulty: 'master', level: '13' },
            { type: 'std', difficulty: 'basic', level: '3' },
            { type: 'std', difficulty: 'advanced', level: '7' },
            { type: 'std', difficulty: 'expert', level: '10' },
            { type: 'std', difficulty: 'master', level: '13+' },
          ],
        },
      ],
    }

    vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(paranoiaData)

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('title-input')).toBeInTheDocument()
    })

    const titleInput = screen.getByTestId('title-input').querySelector('input')!
    fireEvent.change(titleInput, { target: { value: 'Paranoia' } })

    await waitFor(() => {
      expect(screen.getByText('Paranoia')).toBeInTheDocument()
    })

    const sheetButtons = screen.getAllByTestId('sheet-button')
    expect(sheetButtons.length).toBe(8)

    // Verify dx sheets
    expect(sheetButtons[0]).toHaveTextContent('4')
    expect(sheetButtons[0]).toHaveTextContent('(dx)')
    expect(sheetButtons[0]).toHaveAttribute('type', 'button')
    expect(sheetButtons[0]).toHaveClass('text-base')

    // Verify std sheets
    expect(sheetButtons[4]).toHaveTextContent('3')
    expect(sheetButtons[4]).toHaveTextContent('(std)')
    expect(sheetButtons[4]).toHaveAttribute('type', 'button')

    // Verify type badges box without gap-0.5 and both badges side by side
    const badgesBox = screen.getByTestId('type-badges-box')
    expect(badgesBox).toBeInTheDocument()
    expect(badgesBox).not.toHaveClass('gap-0.5')
    const badges = screen.getAllByTestId('sheet-type-badge')
    expect(badges.length).toBe(2)
    expect(badges[0]).toHaveAttribute('src', 'https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/type-dx.png')
    expect(badges[1]).toHaveAttribute('src', 'https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/type-std.png')
  })

  it('renders dual std and dx sheets in 2 rows with gap-2 and upper row dx / lower row std', async () => {
    const dualData = {
      updateTime: '2026-08-21T01:13:03.602Z',
      difficulties: [{ difficulty: 'basic', name: 'BASIC', color: '#22bb5b' }],
      songs: [
        {
          title: 'Dual Song',
          sheets: [
            { type: 'std', difficulty: 'basic', level: '3' },
            { type: 'dx', difficulty: 'basic', level: '4' },
          ],
        },
      ],
    }

    vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(dualData)

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('results-container')).toBeInTheDocument()
    })

    const container = screen.getByTestId('song-sheets-container')
    expect(container).toHaveClass('flex-col')
    expect(container).toHaveClass('gap-2')
    expect(container).toHaveClass('items-center')
    expect(container).toHaveClass('sm:items-end')
    expect(container).toHaveClass('justify-center')
    expect(container).toHaveClass('sm:justify-end')

    const rows = container.children
    expect(rows.length).toBe(2)
    expect(rows[0]).toHaveTextContent('(dx)')
    expect(rows[1]).toHaveTextContent('(std)')
  })
})

describe('Filtering by Version, Type, and Level', () => {
  const mockFilterData = {
    updateTime: '2026-08-21T01:13:03.602Z',
    categories: ['POPS & ANIME'],
    difficulties: ['BASIC', 'EXPERT', 'MASTER'],
    types: ['std', 'dx'],
    versions: ['GreeN', 'ORANGE', 'PRiSM'],
    songs: [
      {
        title: 'GreeN Song STD & DX',
        version: 'GreeN',
        sheets: [
          { type: 'std', difficulty: 'basic', level: '12' },
          { type: 'dx', difficulty: 'master', level: '12+' },
        ],
      },
      {
        title: 'ORANGE Song STD Only',
        version: 'ORANGE',
        sheets: [{ type: 'std', difficulty: 'expert', level: '12' }],
      },
      {
        title: 'PRiSM Song DX Only',
        version: 'PRiSM',
        sheets: [{ type: 'dx', difficulty: 'master', level: '13' }],
      },
    ],
  }

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(dbModule, 'getMaimaiData').mockResolvedValue(mockFilterData)
    const futureCountdown = Date.now() + 60 * 60 * 1000
    localStorage.setItem(COUNTDOWN_KEY, futureCountdown.toString())
  })

  it('filters songs by version when selected in Version autocomplete', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByLabelText(/Version/i)).toBeInTheDocument()
    })

    const versionInput = screen.getByLabelText(/Version/i)
    fireEvent.focus(versionInput)
    fireEvent.keyDown(versionInput, { key: 'ArrowDown' })
    const option = await screen.findByText('GreeN')
    fireEvent.click(option)

    expect(screen.getByText('GreeN Song STD & DX')).toBeInTheDocument()
    expect(screen.queryByText('ORANGE Song STD Only')).not.toBeInTheDocument()
    expect(screen.queryByText('PRiSM Song DX Only')).not.toBeInTheDocument()
  })

  it('filters songs by type when selected in Type autocomplete, including charts with both dx and std', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByLabelText(/Type/i)).toBeInTheDocument()
    })

    const typeInput = screen.getByLabelText(/Type/i)
    fireEvent.focus(typeInput)
    fireEvent.keyDown(typeInput, { key: 'ArrowDown' })
    const dxOption = await screen.findByText('dx')
    fireEvent.click(dxOption)

    // "GreeN Song STD & DX" has dx sheet, so it should be included alongside "PRiSM Song DX Only"
    expect(screen.getByText('GreeN Song STD & DX')).toBeInTheDocument()
    expect(screen.getByText('PRiSM Song DX Only')).toBeInTheDocument()
    expect(screen.queryByText('ORANGE Song STD Only')).not.toBeInTheDocument()
  })

  it('filters songs by level when typing "12" vs typing "12+" into level input', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('level-input')).toBeInTheDocument()
    })

    const levelInput = screen.getByTestId('level-input').querySelector('input')!

    // Typing "12" considers "12" or "12+"
    fireEvent.change(levelInput, { target: { value: '12' } })

    await waitFor(() => {
      expect(screen.getByText('GreeN Song STD & DX')).toBeInTheDocument() // has 12 and 12+
      expect(screen.getByText('ORANGE Song STD Only')).toBeInTheDocument() // has 12
      expect(screen.queryByText('PRiSM Song DX Only')).not.toBeInTheDocument() // has 13
    })

    // Typing "12+" considers ONLY "12+"
    fireEvent.change(levelInput, { target: { value: '12+' } })

    await waitFor(() => {
      expect(screen.getByText('GreeN Song STD & DX')).toBeInTheDocument() // has 12+
      expect(screen.queryByText('ORANGE Song STD Only')).not.toBeInTheDocument() // only has 12
      expect(screen.queryByText('PRiSM Song DX Only')).not.toBeInTheDocument() // has 13
    })
  })
})
