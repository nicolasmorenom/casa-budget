import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Transactions' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/settings', label: 'Settings' },
]

function NavItems({ className, itemClassName }) {
  return (
    <nav className={className}>
      {NAV_ITEMS.map((item) => (
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:shrink-0 border-r border-line bg-paper-raised px-5 py-6">
        <div className="mb-8">
          <p className="font-display text-2xl leading-none">Casa</p>
          <p className="font-display text-2xl leading-none text-amber -mt-1">Budget</p>
        </div>
        <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">Household</p>
        <p className="font-medium mb-8 truncate">{household?.name || '—'}</p>
        <NavItems className="flex flex-col gap-3 text-sm" itemClassName="transition-colors hover:text-ink" />
        <div className="mt-auto pt-6 border-t border-line">
          <p className="text-xs text-ink-soft truncate mb-2">{user?.email}</p>
          <button onClick={signOutUser} className="text-sm text-rust hover:underline">
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-line bg-paper-raised">
        <p className="font-display text-xl">
          Casa <span className="text-amber">Budget</span>
        </p>
        <button onClick={signOutUser} className="text-sm text-rust">
          Sign out
        </button>
      </header>

      <main className="flex-1 px-4 py-6 md:px-10 md:py-10 pb-24 md:pb-10 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <NavItems
        className="md:hidden fixed bottom-0 left-0 right-0 flex justify-between px-2 py-2 border-t border-line bg-paper-raised"
        itemClassName="flex-1 text-center text-xs py-1"
      />
    </div>
  )
}
