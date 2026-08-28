import { usePeriod } from '../contexts/PeriodContext'
import { useLanguage } from '../contexts/LanguageContext'
import { periodLabel } from '../lib/format'

export default function PeriodSwitcher() {
  const { period, shiftPeriod, resetToCurrent, isCurrent } = usePeriod()
  const { lang, t } = useLanguage()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => shiftPeriod(-1)}
        aria-label={t('period.previous')}
        className="w-8 h-8 rounded border border-line hover:bg-white/60 flex items-center justify-center text-ink-soft"
      >
        ‹
      </button>
      <button
        onClick={resetToCurrent}
        className={`text-sm font-medium min-w-[9rem] text-center ${isCurrent ? '' : 'text-amber'}`}
        title={t('period.thisMonth')}
      >
        {periodLabel(period, lang)}
      </button>
      <button
        onClick={() => shiftPeriod(1)}
        aria-label={t('period.next')}
        className="w-8 h-8 rounded border border-line hover:bg-white/60 flex items-center justify-center text-ink-soft"
      >
        ›
      </button>
    </div>
  )
}
