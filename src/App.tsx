import { useState, useEffect } from 'react'
import IconButton from '@mui/material/IconButton'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { getMaimaiData, saveMaimaiData } from './utils/db'

export const ENDPOINT_URL = 'https://dp4p6x0xfi5o9.cloudfront.net/maimai/data.json'
export const COUNTDOWN_KEY = 'maimaiCountdown'
export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export function getInitialDarkMode(): boolean {
  const saved = sessionStorage.getItem('darkMode')
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
  [key: string]: any
}

function App() {
  const [darkMode, setDarkMode] = useState<boolean>(getInitialDarkMode)
  const [maimaiData, setMaimaiData] = useState<MaimaiData | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  useEffect(() => {
    sessionStorage.setItem('darkMode', darkMode ? 'true' : 'false')
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
      const countdownStr = sessionStorage.getItem(COUNTDOWN_KEY)
      const now = Date.now()

      let hasExpired = true
      if (countdownStr) {
        const countdownTime = Number(countdownStr)
        if (!isNaN(countdownTime) && now < countdownTime) {
          hasExpired = false
        }
      }

      // Step 2: Next time user enters app, IndexedDB has data, and hasn't reached countdown time -> do not call endpoint
      if (existingData && !hasExpired) {
        if (isMounted) {
          setMaimaiData(existingData)
        }
        return
      }

      // Step 1, 3, 4: First page load OR countdown reached OR error fallback
      try {
        const response = await fetch(ENDPOINT_URL)
        if (!response.ok) {
          throw new Error(`HTTP error status: ${response.status}`)
        }
        const newData: MaimaiData = await response.json()

        let dataToUse = newData

        if (existingData) {
          // Step 3: Countdown time reached -> compare updateTime with IndexedDB
          if (existingData.updateTime && newData.updateTime && existingData.updateTime === newData.updateTime) {
            // Same updateTime: do nothing to IndexedDB
            dataToUse = existingData
          } else {
            // Different updateTime: replace old data with new one
            await saveMaimaiData(newData)
            dataToUse = newData
          }
        } else {
          // Step 1: First page load -> store in IndexedDB
          await saveMaimaiData(newData)
          dataToUse = newData
        }

        // Set datetime countdown in sessionStorage for 24 hours in the future
        const nextCountdown = Date.now() + TWENTY_FOUR_HOURS_MS
        sessionStorage.setItem(COUNTDOWN_KEY, nextCountdown.toString())

        if (isMounted) {
          setMaimaiData(dataToUse)
        }
      } catch (err) {
        // Step 4: Endpoint call fails -> use data from IndexedDB
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

  const rawCategories = Array.isArray(maimaiData?.categories) ? maimaiData!.categories : []
  const categories: string[] = rawCategories.map((item) => {
    if (typeof item === 'string') return item
    if (typeof item === 'object' && item !== null) {
      return item.category || item.name || item.title || String(item)
    }
    return String(item)
  })

  return (
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
      <main className="pt-[4rem] p-6">
        <FormControl fullWidth style={{ maxWidth: 400 }} data-testid="category-form-control">
          <InputLabel id="category-select-label">Category</InputLabel>
          <Select
            labelId="category-select-label"
            id="category-select"
            data-testid="category-select"
            value={selectedCategory}
            label="Category"
            onChange={(e) => setSelectedCategory(e.target.value as string)}
          >
            {categories.map((cat, idx) => (
              <MenuItem key={`${cat}-${idx}`} value={cat} data-testid={`category-option-${idx}`}>
                {cat}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </main>
    </div>
  )
}

export default App
