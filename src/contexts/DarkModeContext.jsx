import { createContext, useContext, useEffect, useState } from 'react'

const Ctx = createContext({ dark: false, toggleDark: () => {} })

export function DarkModeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem('dark_mode') === '1')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('dark_mode', dark ? '1' : '0')
  }, [dark])

  return (
    <Ctx.Provider value={{ dark, toggleDark: () => setDark(d => !d) }}>
      {children}
    </Ctx.Provider>
  )
}

export const useDarkMode = () => useContext(Ctx)
