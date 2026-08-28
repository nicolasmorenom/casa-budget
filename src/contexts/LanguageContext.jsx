import { createContext, useContext, useMemo, useState } from 'react'
import { translations } from '../lib/i18n'

const LanguageContext = createContext(null)

function detectDefaultLang() {
  const saved = localStorage.getItem('casa-budget-lang')
  if (saved === 'es' || saved === 'en') return saved
  // Default to Spanish, with a nod to the browser's language if it's clearly English.
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es'
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectDefaultLang)

  const setLang = (next) => {
    setLangState(next)
    localStorage.setItem('casa-budget-lang', next)
  }

  const t = useMemo(() => {
    const dict = translations[lang] || translations.es
    return (key) => dict[key] || translations.es[key] || key
  }, [lang])

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
