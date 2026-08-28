import { createContext, useContext, useState } from 'react'
import { currentPeriod } from '../lib/format'

const PeriodContext = createContext(null)

export function PeriodProvider({ children }) {
  const [period, setPeriod] = useState(currentPeriod())

  function shiftPeriod(delta) {
    const [year, month] = period.split('-').map(Number)
    const d = new Date(year, month - 1 + delta, 1)
    setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function resetToCurrent() {
    setPeriod(currentPeriod())
  }

  return (
    <PeriodContext.Provider
      value={{ period, setPeriod, shiftPeriod, resetToCurrent, isCurrent: period === currentPeriod() }}
    >
      {children}
    </PeriodContext.Provider>
  )
}

export function usePeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('usePeriod must be used within PeriodProvider')
  return ctx
}
