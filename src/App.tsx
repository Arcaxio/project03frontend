import { useState, useEffect, useMemo, useRef } from 'react'
import IconButton from '@mui/material/IconButton'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { useVirtualizer } from '@tanstack/react-virtual'
import { getMaimaiData, saveMaimaiData } from './utils/db'

export const ENDPOINT_URL = 'https://dp4p6x0xfi5o9.cloudfront.net/maimai/data.json'
export const COUNTDOWN_KEY = 'maimaiCountdown'
export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export function getInitialDarkMode(): boolean {
  const saved = localStorage.getItem('darkMode')
  if (saved !== null) {
    return saved === 'true'
  }

  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return true
    }
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return false
    }
  }

  return false
}

export interface MaimaiData {
  updateTime?: string
  categories?: Array<string | { category?: string; name?: string; title?: string }>
  difficulties?: Array<string | { difficulty?: string; name?: string; title?: string }>
  types?: Array<string | { type?: string; name?: string; title?: string }>
  versions?: Array<string | { version?: string; name?: string; title?: string }>
  songs?: Array<{ title?: string; [key: string]: any }>
  [key: string]: any
}

function App() {
  const [darkMode, setDarkMode] = useState<boolean>(getInitialDarkMode)
  const [maimaiData, setMaimaiData] = useState<MaimaiData | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [title, setTitle] = useState<string>('')
  const [level, setLevel] = useState<string>('')

  const parentRef = useRef<HTMLDivElement>(null)

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
        },
      }),
    [darkMode],
  )

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode ? 'true' : 'false')
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  useEffect(() => {
    let isMounted = true

    async function initializeMaimaiData() {
      const existingData = await getMaimaiData()
      const countdownStr = localStorage.getItem(COUNTDOWN_KEY)
      const now = Date.now()

      let hasExpired = true
      if (countdownStr) {
        const countdownTime = Number(countdownStr)
        if (!isNaN(countdownTime) && now < countdownTime) {
          hasExpired = false
        }
      }

      if (existingData && !hasExpired) {
        if (isMounted) {
          setMaimaiData(existingData)
        }
        return
      }

      try {
        const response = await fetch(ENDPOINT_URL)
        if (!response.ok) {
          throw new Error(`HTTP error status: ${response.status}`)
        }
        const newData: MaimaiData = await response.json()

        let dataToUse = newData

        if (existingData) {
          if (existingData.updateTime && newData.updateTime && existingData.updateTime === newData.updateTime) {
            dataToUse = existingData
          } else {
            await saveMaimaiData(newData)
            dataToUse = newData
          }
        } else {
          await saveMaimaiData(newData)
          dataToUse = newData
        }

        const nextCountdown = Date.now() + TWENTY_FOUR_HOURS_MS
        localStorage.setItem(COUNTDOWN_KEY, nextCountdown.toString())

        if (isMounted) {
          setMaimaiData(dataToUse)
        }
      } catch (err) {
        if (existingData && isMounted) {
          setMaimaiData(existingData)
        }
      }
    }

    initializeMaimaiData()

    return () => {
      isMounted = false
    }
  }, [])

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev)
  }

  const extractItems = (raw: any[] | undefined, primaryKey: string): string[] => {
    if (!Array.isArray(raw)) return []
    return raw.map((item) => {
      if (typeof item === 'string') return item
      if (typeof item === 'object' && item !== null) {
        return item[primaryKey] || item.name || item.title || String(item)
      }
      return String(item)
    })
  }

  const categories = extractItems(maimaiData?.categories, 'category')
  const difficulties = extractItems(maimaiData?.difficulties, 'difficulty')
  const types = extractItems(maimaiData?.types, 'type')
  const versions = extractItems(maimaiData?.versions, 'version')

  const songs = maimaiData?.songs || []
  const filteredSongs = songs.filter((song) => {
    if (title) {
      const songTitle = song?.title || ''
      if (!songTitle.toLowerCase().includes(title.toLowerCase())) {
        return false
      }
    }
    if (selectedCategory) {
      if (song?.category !== selectedCategory) {
        return false
      }
    }
    return true
  })

  const rowVirtualizer = useVirtualizer({
    count: filteredSongs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    gap: 4,
    overscan: 5,
  })

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
        <header
          className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-50 shadow-sm"
          style={{ height: '4rem' }}
          data-testid="header"
        >
          <div className="flex items-center justify-start flex-1" data-testid="header-left">
            <IconButton
              onClick={toggleDarkMode}
              aria-label="toggle dark mode"
              data-testid="dark-mode-toggle"
              color="inherit"
            >
              {darkMode ? (
                <LightModeIcon data-testid="light-icon" />
              ) : (
                <DarkModeIcon data-testid="dark-icon" />
              )}
            </IconButton>
          </div>
          <div className="flex items-center justify-center flex-1 text-center font-medium" data-testid="header-center">
            Header Center
          </div>
          <div className="flex items-center justify-end flex-1 text-right" data-testid="header-right">
            Header Right
          </div>
        </header>
        <main className="pt-20 p-6 space-y-6">
          <div
            className="flex flex-wrap justify-center items-center gap-4 w-full max-w-4xl mx-auto FILTERS"
            data-testid="dropdowns-container"
          >
            <TextField
              label="Title"
              type="search"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full sm:w-[calc(50%-0.5rem)] max-w-[400px]"
              data-testid="title-input"
            />

            <TextField
              label="Level"
              type="search"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full sm:w-[calc(50%-0.5rem)] max-w-[400px]"
              data-testid="level-input"
            />

            <Autocomplete
              options={categories}
              value={selectedCategory || null}
              onChange={(_, newValue) => setSelectedCategory(newValue || '')}
              className="w-full sm:w-[calc(50%-0.5rem)] max-w-[400px]"
              data-testid="category-form-control"
              renderInput={(params) => (
                <TextField {...params} label="Category" data-testid="category-select" />
              )}
            />

            <Autocomplete
              options={difficulties}
              value={selectedDifficulty || null}
              onChange={(_, newValue) => setSelectedDifficulty(newValue || '')}
              className="w-full sm:w-[calc(50%-0.5rem)] max-w-[400px]"
              data-testid="difficulty-form-control"
              renderInput={(params) => (
                <TextField {...params} label="Difficulty" data-testid="difficulty-select" />
              )}
            />

            <Autocomplete
              options={types}
              value={selectedType || null}
              onChange={(_, newValue) => setSelectedType(newValue || '')}
              className="w-full sm:w-[calc(50%-0.5rem)] max-w-[400px]"
              data-testid="type-form-control"
              renderInput={(params) => (
                <TextField {...params} label="Type" data-testid="type-select" />
              )}
            />

            <Autocomplete
              options={versions}
              value={selectedVersion || null}
              onChange={(_, newValue) => setSelectedVersion(newValue || '')}
              className="w-full sm:w-[calc(50%-0.5rem)] max-w-[400px]"
              data-testid="version-form-control"
              renderInput={(params) => (
                <TextField {...params} label="Version" data-testid="version-select" />
              )}
            />
          </div>

          <div
            ref={parentRef}
            className="RESULTS h-[16rem] overflow-auto bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 w-full max-w-4xl mx-auto"
            data-testid="results-container"
          >
            <div
              className="w-full relative"
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
              }}
            >
              <div
                className="absolute top-0 left-0 w-full flex flex-col gap-1"
                style={{
                  transform: `translateY(${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px)`,
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const song = filteredSongs[virtualRow.index]
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="h-[4rem] flex items-center px-4 gap-3 bg-white dark:bg-gray-700/50 rounded shadow-sm"
                      style={{
                        height: '4rem',
                      }}
                    >
                      <div className="w-10 h-10 shrink-0 bg-gray-300 dark:bg-gray-600 rounded overflow-hidden flex items-center justify-center">
                        {song?.imageName && (
                          <img
                            src={`https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover-m/${song.imageName}`}
                            alt={song?.title || ''}
                            loading="lazy"
                            className="w-full h-full object-cover"
                            data-testid="song-image"
                          />
                        )}
                      </div>
                      <span className="truncate">{song?.title}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div
            className="w-full min-h-[60vh] p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800/50 GRID"
            data-testid="display-container"
          >
          </div>
        </main>
      </div>
    </ThemeProvider>
  )
}

export default App
