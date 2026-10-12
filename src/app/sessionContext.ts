import { createContext, useContext } from 'react'

export type SessionUser = { id: string; email: string; emailConfirmed: boolean; createdAt: string }

export const SessionContext = createContext<SessionUser | null>(null)
export const useSessionUser = () => useContext(SessionContext)

export type PrivacyState = { hidden: boolean; toggle: () => void }
export const PrivacyContext = createContext<PrivacyState>({ hidden: false, toggle: () => undefined })
export const usePrivacy = () => useContext(PrivacyContext)
