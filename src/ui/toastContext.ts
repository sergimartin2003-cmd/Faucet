import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'
export type ToastApi = (message: string, kind?: ToastKind) => void

export const ToastContext = createContext<ToastApi>(() => undefined)
export const useToast = () => useContext(ToastContext)
