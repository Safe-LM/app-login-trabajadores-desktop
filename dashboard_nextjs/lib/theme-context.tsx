'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeCtx {
  theme: Theme
  isDark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'dark', isDark: true, toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  // Cargar tema guardado al montar
  useEffect(() => {
    const saved = localStorage.getItem('sl-theme') as Theme | null
    const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    const initial = saved ?? preferred
    setTheme(initial)
    applyTheme(initial)
  }, [])

  function applyTheme(t: Theme) {
    const html = document.documentElement
    if (t === 'light') {
      html.classList.add('light')
    } else {
      html.classList.remove('light')
    }
  }

  const toggle = () => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('sl-theme', next)
      applyTheme(next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
