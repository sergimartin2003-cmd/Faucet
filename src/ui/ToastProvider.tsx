import { useCallback, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, CircleAlert, Info } from 'lucide-react'
import { ToastContext, type ToastKind } from './toastContext'

type Toast = { id: number; message: string; kind: ToastKind }

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const push = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextId.current++
    setToasts((current) => [...current.slice(-3), { id, message, kind }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500)
  }, [])

  return <ToastContext.Provider value={push}>
    {children}
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'error' ? CircleAlert : Info
        return <div key={toast.id} className={`toast toast-${toast.kind}`}><Icon size={16} /><span>{toast.message}</span></div>
      })}
    </div>
  </ToastContext.Provider>
}
