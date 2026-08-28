import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useLanguage } from '../contexts/LanguageContext'
import QuickAddExpense from './QuickAddExpense'

function useNavItems(t) {
  return [
    { to: '/', label: t('nav.dashboard'), end: true },
    { to: '/transactions', label: t('nav.transactions') },
    { to: '/accounts', label: t('nav.accounts') },
    { to: '/budgets', label: t('nav.budgets') },
    { to: '/settings', label: t('nav.settings') },
  ]
}

function NavItems({ items, className, itemClassName }) {
  return (
    <nav className={className}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `${itemClassName} ${isActive ? 'text-ink font-semibold' : 'text-ink-soft'}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout() {
  const { user, signOutUser } = useAuth()
  const { household } = useHousehold()
  const { t, lang, setLang } = useLanguage()
  const items = useNavItems(t)

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:shrink-0 border-r border-line bg-paper-raised px-5 py-6">
        <div className="mb-8">
          <p className="font-display text-2xl leading-none">Casa</p>
          <p className="font-display text-2xl leading-none text-amber -mt-1">Budget</p>
        </div>
        <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">{t('nav.household')}</p>
        <p className="font-medium mb-8 truncate">{household?.name || '—'}</p>
        <NavItems items={items} className="flex flex-col gap-3 text-sm" itemClassName="transition-colors hover:text-ink" />
        <div className="mt-auto pt-6 border-t border-line flex flex-col gap-3">
          <button
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            className="text-xs border border-line rounded-full px-3 py-1 text-ink-soft hover:bg-white/60 self-start"
          >
            {lang === 'es' ? 'English' : 'Español'}
          </button>
          <p className="text-xs text-ink-soft truncate">{user?.email}</p>
          <button onClick={signOutUser} className="text-sm text-rust hover:underline text-left">
            {t('nav.signOut')}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-line bg-paper-raised">
        <p className="font-display text-xl">
          Casa <span className="text-amber">Budget</span>
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            className="text-xs border border-line rounded-full px-2.5 py-1 text-ink-soft"
          >
            {lang === 'es' ? 'EN' : 'ES'}
          </button>
          <button onClick={signOutUser} className="text-sm text-rust">
            {t('nav.signOut')}
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 md:px-10 md:py-10 pb-24 md:pb-10 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>

      <QuickAddExpense />

      {/* Mobile bottom tab bar */}
      <NavItems
        items={items}
        className="md:hidden fixed bottom-0 left-0 right-0 flex justify-between px-2 py-2 border-t border-line bg-paper-raised z-10"
        itemClassName="flex-1 text-center text-xs py-1"
      />
    </div>
  )
}
