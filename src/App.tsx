import { useState, useEffect, useMemo, useRef } from 'react'
import IconButton from '@mui/material/IconButton'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import MenuIcon from '@mui/icons-material/Menu'
import ListIcon from '@mui/icons-material/List'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Popover from '@mui/material/Popover'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { useVirtualizer } from '@tanstack/react-virtual'
import { getMaimaiData, saveMaimaiData } from './utils/db'

export const ENDPOINT_URL = 'https://dp4p6x0xfi5o9.cloudfront.net/maimai/data.json'
export const COUNTDOWN_KEY = 'maimaiCountdown'
export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export const ratingFactor = [
  { minAchv: 100.5, factor: 0.224, title: 'SSS+' },
  { minAchv: 100.0, factor: 0.216, title: 'SSS' },
  { minAchv: 99.5, factor: 0.211, title: 'SS+' },
  { minAchv: 99.0, factor: 0.208, title: 'SS' },
  { minAchv: 98.0, factor: 0.203, title: 'S+' },
  { minAchv: 97.0, factor: 0.2, title: 'S+' },
  { minAchv: 94.0, factor: 0.168, title: 'AAA' },
  { minAchv: 90.0, factor: 0.152, title: 'AA' },
  { minAchv: 80.0, factor: 0.136, title: 'A' },
  { minAchv: 75.0, factor: 0.12, title: 'BBB' },
  { minAchv: 70.0, factor: 0.112, title: 'BB' },
  { minAchv: 60.0, factor: 0.096, title: 'B' },
  { minAchv: 50.0, factor: 0.08, title: 'C' },
  { minAchv: 0.0, factor: 0.016, title: 'D' },
]

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

  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [selectedSong, setSelectedSong] = useState<any>(null)
  const [selectedSheet, setSelectedSheet] = useState<any>(null)
  const [targetScore, setTargetScore] = useState<number | string>('')
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false)
  const [clearModalOpen, setClearModalOpen] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [maimaiB50Charts, setMaimaiB50Charts] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('maimaiB50Charts')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

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

  const handleMenuItemClick = (text: string) => {
    setDrawerOpen(false)
    if (text === 'Clear B50 Data') {
      setClearModalOpen(true)
    } else if (text === 'Export') {
      handleExportData()
    } else if (text === 'Import') {
      fileInputRef.current?.click()
    }
  }

  const handleConfirmClear = () => {
    localStorage.removeItem('maimaiB50Charts')
    setMaimaiB50Charts([])
    setClearModalOpen(false)
  }

  const handleExportData = () => {
    const savedData = localStorage.getItem('maimaiB50Charts') || JSON.stringify(maimaiB50Charts)
    const blob = new Blob([savedData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'maimaiB50Charts.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const parsed = JSON.parse(content)

        if (Array.isArray(parsed)) {
          const requiredKeys = ['difficulty', 'imageName', 'internalLevelValue', 'rating', 'songId', 'target', 'type']
          const isValid = parsed.every(
            (item) =>
              item &&
              typeof item === 'object' &&
              requiredKeys.every((key) => key in item)
          )

          if (isValid) {
            localStorage.setItem('maimaiB50Charts', JSON.stringify(parsed))
            setMaimaiB50Charts(parsed)
          }
        }
      } catch {
        // Invalid JSON
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const handleSheetClick = (event: React.MouseEvent<HTMLButtonElement>, song: any, sheet: any) => {
    setAnchorEl(event.currentTarget)
    setSelectedSong(song)
    setSelectedSheet(sheet)
    setTargetScore('')
  }

  const handleClosePopover = () => {
    setAnchorEl(null)
    setSelectedSong(null)
    setSelectedSheet(null)
  }

  const handleConfirm = () => {
    if (maimaiB50Charts.length >= 50) return

    const targetNum = typeof targetScore === 'number' ? targetScore : parseFloat(targetScore) || 0
    const internalLevel = Number(selectedSheet?.internalLevelValue) || 0
    const matchedFactorObj = ratingFactor.find((rf) => targetNum >= rf.minAchv)
    const factor = matchedFactorObj ? matchedFactorObj.factor : 0
    const calculatedRating = Math.floor(targetNum * factor * internalLevel)

    const newChart = {
      songId: selectedSong?.songId,
      imageName: selectedSong?.imageName,
      internalLevelValue: selectedSheet?.internalLevelValue,
      target: targetScore,
      type: selectedSheet?.type,
      difficulty: selectedSheet?.difficulty,
      rating: calculatedRating,
    }

    const updated = [...maimaiB50Charts, newChart]
    setMaimaiB50Charts(updated)
    localStorage.setItem('maimaiB50Charts', JSON.stringify(updated))
    handleClosePopover()
  }

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
            <IconButton
              onClick={() => setDrawerOpen(true)}
              aria-label="import export"
              data-testid="import-export-button"
              color="inherit"
            >
              <MenuIcon data-testid="import-export-icon" />
            </IconButton>
          </div>
        </header>
        <main className="pt-20 p-5 space-y-6">
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

                  const stdSheets = song?.sheets?.filter((s: any) => s?.type?.toLowerCase() === 'std') || []
                  const dxSheets = song?.sheets?.filter((s: any) => s?.type?.toLowerCase() === 'dx') || []
                  const hasBothTypes = stdSheets.length > 0 && dxSheets.length > 0

                  const renderSheetButton = (sheet: any, idx: number, song: any) => {
                    const color = getDifficultyColor(sheet?.difficulty)
                    return (
                      <button
                        type="button"
                        key={idx}
                        className="w-[3rem] h-[3rem] sm:w-[2.25rem] sm:h-[2.25rem] rounded text-white font-bold flex flex-col items-center justify-center text-base sm:text-sm leading-tight cursor-pointer hover:scale-[1.125] transition-transform"
                        style={{ backgroundColor: color }}
                        data-testid="sheet-button"
                        onClick={(e) => handleSheetClick(e, song, sheet)}
                      >
                        <span>{sheet?.level}</span>
                        {sheet?.type && (
                          <span className="text-xs sm:text-[10px] font-normal leading-none">
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
                      className="min-h-[6rem] flex flex-col sm:flex-row items-start sm:items-center justify-start sm:justify-between p-2 bg-white dark:bg-gray-700/50 rounded shadow-sm gap-2 sm:gap-0"
                      style={{
                        minHeight: '6rem',
                      }}
                    >
                      <div className="relative flex items-center justify-start gap-3 min-w-0 w-full sm:w-auto">
                        {sheetTypes.length > 1 ? (
                          <div className="absolute top-0 left-0 flex items-center z-10" data-testid="type-badges-box">
                            {sheetTypes.map((t) => (
                              <img
                                key={t}
                                src={`https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/type-${t}.png`}
                                alt={t}
                                className="w-[2.5rem]"
                                data-testid="sheet-type-badge"
                              />
                            ))}
                          </div>
                        ) : sheetTypes.length === 1 ? (
                          <img
                            src={`https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/type-${sheetTypes[0]}.png`}
                            alt={sheetTypes[0]}
                            className="absolute top-0 left-0 w-[2.5rem]"
                            data-testid="sheet-type-badge"
                          />
                        ) : null}
                        <div className="w-[5rem] h-[5rem] shrink-0 bg-gray-300 dark:bg-gray-600 rounded overflow-hidden flex items-center justify-center">
                          {song?.imageName && (
                            <img
                              src={`https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover-m/${song.imageName}`}
                              alt={song?.title || ''}
                              loading="lazy"
                              className="w-[5rem] h-[5rem] object-cover"
                              data-testid="song-image"
                            />
                          )}
                        </div>
                        <span className="truncate">{song?.title}</span>
                      </div>
                      {hasBothTypes ? (
                        <div className="flex flex-col gap-2 items-center sm:items-end justify-center sm:justify-end shrink-0 w-full sm:w-auto" data-testid="song-sheets-container">
                          <div className="flex items-center justify-start gap-2">
                            {dxSheets.map((sheet: any, idx: number) => renderSheetButton(sheet, idx, song))}
                          </div>
                          <div className="flex items-center justify-start gap-2">
                            {stdSheets.map((sheet: any, idx: number) => renderSheetButton(sheet, idx, song))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center sm:items-end justify-center sm:justify-end gap-2 shrink-0 w-full sm:w-auto" data-testid="song-sheets-container">
                          {song?.sheets?.map((sheet: any, idx: number) => renderSheetButton(sheet, idx, song))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div
            className="w-full min-h-[60vh] p-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800/50 GRID flex flex-wrap content-start justify-center gap-2"
            data-testid="display-container"
          >
            {maimaiB50Charts.map((item: any, index: number) => {
              const color = getDifficultyColor(item?.difficulty)
              return (
                <div
                  key={index}
                  className="flex flex-col justify-between border border-gray-200 dark:border-gray-700 p-2 rounded bg-white dark:bg-gray-800 h-[6rem] w-[12rem] text-white hover:scale-[1.125] transition-transform"
                  style={{ backgroundColor: color, borderColor: color }}
                  data-testid="b50-chart-item"
                >
                <div className="flex items-center justify-between gap-1 text-xs" data-testid="b50-top-div">
                  <span className="truncate">{item?.songId}</span>
                  {item?.type && (
                    <img
                      src={`https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/type-${item.type.toLowerCase()}.png`}
                      alt={item.type}
                      className="h-3"
                      data-testid="b50-type-badge"
                    />
                  )}
                </div>
                <div className="flex items-center gap-2" data-testid="b50-bottom-div">
                  <div className="shrink-0">
                    {item?.imageName && (
                      <img
                        src={`https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover-m/${item.imageName}`}
                        alt={item?.songId || ''}
                        className="w-[3.5rem] h-[3.5rem] object-cover rounded"
                        style={{ width: '3.5rem', height: '3.5rem' }}
                        data-testid="b50-chart-img"
                      />
                    )}
                  </div>
                  <div className="flex flex-col justify-center text-sm" data-testid="b50-right-div">
                    <div>{item?.internalLevelValue}</div>
                    <div>{item?.target}</div>
                    <span className="text-xl font-bold">{item?.rating}</span>
                  </div>
                </div>
              </div>
            )
          })}
          </div>

          <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={handleClosePopover}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
            data-testid="sheet-popover"
          >
            <div className="p-4 flex flex-col gap-3 min-w-[200px]" data-testid="popover-content">
              <div className="grid grid-cols-2 gap-2" data-testid="popover-grid">
                {[
                  { label: 'S', value: 97 },
                  { label: 'S+', value: 98 },
                  { label: 'SS', value: 99 },
                  { label: 'SS+', value: 99.5 },
                  { label: 'SSS', value: 100 },
                  { label: 'SSS+', value: 100.5 },
                ].map((btn) => (
                  <Button
                    key={btn.label}
                    variant="outlined"
                    size="small"
                    onClick={() => setTargetScore(btn.value)}
                    data-testid={`score-btn-${btn.label}`}
                  >
                    {btn.label}
                  </Button>
                ))}
              </div>
              <TextField
                label="Target"
                size="small"
                value={targetScore}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const val = e.target.value
                  if (val === '') {
                    setTargetScore('')
                    return
                  }
                  if (/^\d*(\.\d{0,4})?$/.test(val)) {
                    if (val === '.') {
                      setTargetScore(val)
                      return
                    }
                    const num = parseFloat(val)
                    if (!isNaN(num) && num >= 0 && num <= 101) {
                      setTargetScore(val)
                    }
                  }
                }}
                data-testid="target-textfield"
              />
              <Button
                variant="contained"
                color="primary"
                disabled={maimaiB50Charts.length >= 50}
                onClick={handleConfirm}
                style={{ textTransform: 'none' }}
                data-testid="confirm-btn"
              >
                confirm
              </Button>
            </div>
          </Popover>

          <Drawer
            anchor="right"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            data-testid="drawer"
          >
            <List>
              {['Import', 'Export', 'Save Image', 'Clear B50 Data'].map((text, index) => (
                <ListItem key={text} disablePadding>
                  <ListItemButton onClick={() => handleMenuItemClick(text)}>
                    <ListItemIcon>
                      <ListIcon />
                    </ListItemIcon>
                    <ListItemText primary={text} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Drawer>

          <Dialog
            open={clearModalOpen}
            onClose={() => setClearModalOpen(false)}
            data-testid="clear-b50-modal"
          >
            <DialogContent>
              <DialogContentText>
                Once this action is done, it cannot be undone. Please export your data if you wish to keep it
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setClearModalOpen(false)} color="inherit" data-testid="modal-cancel-btn">
                Cancel
              </Button>
              <Button onClick={handleConfirmClear} color="error" autoFocus data-testid="modal-confirm-btn">
                Confirm
              </Button>
            </DialogActions>
          </Dialog>

          <input
            type="file"
            accept=".json,application/json"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileImport}
            data-testid="import-file-input"
          />
        </main>
      </div>
    </ThemeProvider>
  )
}

export default App
