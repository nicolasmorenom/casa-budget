import { useState } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useLanguage } from '../contexts/LanguageContext'
import SimpleFinConnect from '../components/SimpleFinConnect'

export default function Settings() {
  const { household, members } = useHousehold()
  const { t, lang, setLang } = useLanguage()
  const [copied, setCopied] = useState(false)

  function copyInvite() {
    navigator.clipboard.writeText(household.inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl">{t('settings.title')}</h1>

      <section className="bg-paper-raised border border-line rounded-lg p-4">
        <h2 className="font-display text-xl mb-1">{household?.name}</h2>
        <p className="text-sm text-ink-soft mb-3">
          {members.length} {members.length === 1 ? t('settings.members') : t('settings.membersPlural')}
        </p>

        {members.length > 0 && (
          <ul className="flex flex-wrap gap-2 mb-4">
            {members.map((m) => (
              <li key={m.uid} className="text-sm bg-white/60 border border-line rounded-full px-3 py-1">
                {m.displayName}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">{t('settings.inviteCode')}</p>
        <div className="flex items-center gap-3">
          <code className="font-mono-num text-lg bg-white/60 border border-line rounded px-3 py-1.5">
            {household?.inviteCode}
          </code>
          <button onClick={copyInvite} className="text-amber text-sm font-medium hover:underline">
            {copied ? t('settings.copied') : t('settings.copy')}
          </button>
        </div>
        <p className="text-xs text-ink-soft mt-2">{t('settings.inviteHelp')}</p>
      </section>

      <section className="bg-paper-raised border border-line rounded-lg p-4">
        <p className="text-xs uppercase tracking-wide text-ink-soft mb-2">{t('settings.language')}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setLang('es')}
            className={`px-4 py-2 rounded text-sm border ${lang === 'es' ? 'bg-ink text-paper border-ink' : 'border-line'}`}
          >
            Español
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-4 py-2 rounded text-sm border ${lang === 'en' ? 'bg-ink text-paper border-ink' : 'border-line'}`}
          >
            English
          </button>
        </div>
      </section>

      <SimpleFinConnect />
    </div>
  )
}
