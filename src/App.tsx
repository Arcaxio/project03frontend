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
  difficulties?: Array<string | { difficulty?: string; name?: string; title?: string; color?: string }>
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
        breakpoints: {
          values: {
            xs: 0,
            sm: 640,
            md: 768,
            lg: 1024,
            xl: 1280,
          },
        },
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
    if (selectedDifficulty) {
      const hasDifficulty = song?.sheets?.some(
        (sheet: any) => sheet?.difficulty?.toLowerCase() === selectedDifficulty.toLowerCase()
      )
      if (!hasDifficulty) {
        return false
      }
    }
    if (selectedType) {
      const hasType = song?.sheets?.some(
        (sheet: any) => sheet?.type?.toLowerCase() === selectedType.toLowerCase()
      )
      if (!hasType) {
        return false
      }
    }
    if (selectedVersion) {
      if (song?.version?.toLowerCase() !== selectedVersion.toLowerCase()) {
        return false
      }
    }
    if (level && level.trim()) {
      const targetLevel = level.trim()
      const isPlusTarget = targetLevel.endsWith('+')
      const hasMatchingLevel = song?.sheets?.some((sheet: any) => {
        const sheetLevel = sheet?.level?.toString().trim()
        if (!sheetLevel) return false
        if (isPlusTarget) {
          return sheetLevel === targetLevel
        } else {
          return sheetLevel === targetLevel || sheetLevel === `${targetLevel}+`
        }
      })
      if (!hasMatchingLevel) {
        return false
      }
    }
    return true
  })

  const rowVirtualizer = useVirtualizer({
    count: filteredSongs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
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
            className="RESULTS h-[16rem] overflow-auto bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-lg p-4 w-full max-w-4xl mx-auto"
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

                  const sheetTypes = Array.from(
                    new Set(
                      song?.sheets
                        ?.map((s: any) => s?.type?.toLowerCase())
                        .filter((t: string) => t === 'std' || t === 'dx')
                    )
                  ) as string[]

                  const getDifficultyColor = (diffKey?: string) => {
                    if (!diffKey || !maimaiData?.difficulties) return undefined
                    const target = diffKey.toLowerCase()
                    const found = maimaiData.difficulties.find((d: any) => {
                      if (typeof d === 'string') return d.toLowerCase() === target
                      if (typeof d === 'object' && d !== null) {
                        return (
                          (d.difficulty && String(d.difficulty).toLowerCase() === target) ||
                          (d.name && String(d.name).toLowerCase() === target) ||
                          (d.title && String(d.title).toLowerCase() === target)
                        )
                      }
                      return false
                    })
                    return typeof found === 'object' && found !== null ? found.color : undefined
                  }

                  const stdSheets = song?.sheets?.filter((s: any) => s?.type?.toLowerCase() === 'std') || []
                  const dxSheets = song?.sheets?.filter((s: any) => s?.type?.toLowerCase() === 'dx') || []
                  const hasBothTypes = stdSheets.length > 0 && dxSheets.length > 0

                  const renderSheetButton = (sheet: any, idx: number) => {
                    const color = getDifficultyColor(sheet?.difficulty)
                    return (
                      <button
                        type="button"
                        key={idx}
                        className="w-[2.5rem] h-[2.5rem] rounded text-white font-bold flex flex-col items-center justify-center text-sm leading-tight"
                        style={{ backgroundColor: color }}
                        data-testid="sheet-button"
                      >
                        <span>{sheet?.level}</span>
                        {sheet?.type && (
                          <span className="text-[10px] font-normal leading-none">
                            ({sheet.type.toLowerCase()})
                          </span>
                        )}
                      </button>
                    )
                  }

                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      data-testid="virtual-row"
                      ref={rowVirtualizer.measureElement}
                      className="min-h-[5.5rem] flex flex-col sm:flex-row items-start sm:items-center justify-start sm:justify-between px-2 py-2 sm:py-0 bg-white dark:bg-gray-700/50 rounded shadow-sm gap-2 sm:gap-0"
                      style={{
                        minHeight: '5.5rem',
                      }}
                    >
                      <div className="relative flex items-center justify-start gap-3 min-w-0 w-full sm:w-auto">
                        {sheetTypes.length > 1 ? (
                          <div className="absolute top-0 left-0 flex items-center gap-0.5 z-10" data-testid="type-badges-box">
                            {sheetTypes.map((t) => (
                              <img
                                key={t}
                                src={`https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/type-${t}.png`}
                                alt={t}
                                className="h-[1rem]"
                                data-testid="sheet-type-badge"
                              />
                            ))}
                          </div>
                        ) : sheetTypes.length === 1 ? (
                          <img
                            src={`https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/type-${sheetTypes[0]}.png`}
                            alt={sheetTypes[0]}
                            className="absolute top-0 left-0 h-[1rem]"
                            data-testid="sheet-type-badge"
                          />
                        ) : null}
                        <div className="w-[4.5rem] h-[4.5rem] shrink-0 bg-gray-300 dark:bg-gray-600 rounded overflow-hidden flex items-center justify-center">
                          {song?.imageName && (
                            <img
                              src={`https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover-m/${song.imageName}`}
                              alt={song?.title || ''}
                              loading="lazy"
                              className="w-[4.5rem] h-[4.5rem] object-cover"
                              data-testid="song-image"
                            />
                          )}
                        </div>
                        <span className="truncate">{song?.title}</span>
                      </div>
                      {hasBothTypes ? (
                        <div className="flex flex-col gap-1 justify-start shrink-0 w-full sm:w-auto" data-testid="song-sheets-container">
                          <div className="flex items-center justify-start gap-2">
                            {dxSheets.map((sheet: any, idx: number) => renderSheetButton(sheet, idx))}
                          </div>
                          <div className="flex items-center justify-start gap-2">
                            {stdSheets.map((sheet: any, idx: number) => renderSheetButton(sheet, idx))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-start gap-2 shrink-0 w-full sm:w-auto" data-testid="song-sheets-container">
                          {song?.sheets?.map((sheet: any, idx: number) => renderSheetButton(sheet, idx))}
                        </div>
                      )}
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
