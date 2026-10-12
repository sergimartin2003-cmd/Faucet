import { createContext, useContext } from 'react'

export type AuthMode = 'login' | 'signup' | 'recovery' | 'update-password'

export type AuthDialogApi = {
  openAuth: (mode: 'login' | 'signup') => void
  signedInEmail: string | null
}

export const AuthDialogContext = createContext<AuthDialogApi>({ openAuth: () => {}, signedInEmail: null })

export function useAuthDialog() {
  return useContext(AuthDialogContext)
}
