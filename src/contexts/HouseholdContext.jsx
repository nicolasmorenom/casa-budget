import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import {
  subscribeUserDoc,
  subscribeHousehold,
  subscribeAccounts,
  subscribeCategories,
  subscribeTransactions,
  subscribeMembers,
  subscribeGoals,
  subscribeBills,
} from '../lib/firestore'

const HouseholdContext = createContext(null)

export function HouseholdProvider({ children }) {
  const { user } = useAuth()
  const [userDoc, setUserDoc] = useState(undefined)
  const [activeHouseholdId, setActiveHouseholdId] = useState(null)
  const [household, setHousehold] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [members, setMembers] = useState([])
  const [goals, setGoals] = useState([])
  const [bills, setBills] = useState([])

  useEffect(() => {
    if (!user) return
    return subscribeUserDoc(user.uid, (data) => {
      setUserDoc(data)
      setActiveHouseholdId((prev) => prev || data?.householdIds?.[0] || null)
    })
  }, [user])

  useEffect(() => {
    if (!activeHouseholdId) {
      setHousehold(null)
      setAccounts([])
      setCategories([])
      setTransactions([])
      setMembers([])
      setGoals([])
      setBills([])
      return
    }
    const unsubs = [
      subscribeHousehold(activeHouseholdId, setHousehold),
      subscribeAccounts(activeHouseholdId, setAccounts),
      subscribeCategories(activeHouseholdId, setCategories),
      subscribeTransactions(activeHouseholdId, setTransactions),
      subscribeMembers(activeHouseholdId, setMembers),
      subscribeGoals(activeHouseholdId, setGoals),
      subscribeBills(activeHouseholdId, setBills),
    ]
    return () => unsubs.forEach((u) => u())
  }, [activeHouseholdId])

  const value = useMemo(
    () => ({
      loadingUserDoc: userDoc === undefined,
      householdIds: userDoc?.householdIds || [],
      activeHouseholdId,
      setActiveHouseholdId,
      household,
      accounts,
      categories,
      transactions,
      members,
      goals,
      bills,
    }),
    [userDoc, activeHouseholdId, household, accounts, categories, transactions, members, goals, bills]
  )

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider')
  return ctx
}
