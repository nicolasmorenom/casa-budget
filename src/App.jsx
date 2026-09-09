import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { HouseholdProvider, useHousehold } from './contexts/HouseholdContext'
import { LanguageProvider, useLanguage } from './contexts/LanguageContext'
import { PeriodProvider } from './contexts/PeriodContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Transactions from './pages/Transactions'
import Budgets from './pages/Budgets'
import Goals from './pages/Goals'
import Bills from './pages/Bills'
import Settings from './pages/Settings'

function Gate() {
  const { user, loading } = useAuth()
  const { t } = useLanguage()

  if (loading) return <CenteredNote text={t('common.loading')} />
  if (!user) return <Login />

  return (
    <HouseholdProvider>
      <HouseholdGate />
    </HouseholdProvider>
  )
}

function HouseholdGate() {
  const { loadingUserDoc, householdIds } = useHousehold()
  const { t } = useLanguage()

  if (loadingUserDoc) return <CenteredNote text={t('common.loading')} />
  if (householdIds.length === 0) return <Onboarding />

  return (
    <PeriodProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </PeriodProvider>
  )
}

function CenteredNote({ text }) {
  return <div className="min-h-screen flex items-center justify-center text-ink-soft">{text}</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}
