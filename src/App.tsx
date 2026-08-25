import { useState, useEffect } from 'react'
import IconButton from '@mui/material/IconButton'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'

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

function App() {
  const [darkMode, setDarkMode] = useState<boolean>(getInitialDarkMode)

  useEffect(() => {
    sessionStorage.setItem('darkMode', darkMode ? 'true' : 'false')
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev)
  }

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
      </main>
    </div>
  )
}

export default App
