import { useEffect } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'

export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(onDismiss, 4500)
    return () => window.clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null
  const Icon = toast.tone === 'error' ? AlertCircle : CheckCircle2
  return (
    <div className={`toast toast--${toast.tone}`} role="status" aria-live="polite">
      <Icon size={20} aria-hidden="true" /><span>{toast.message}</span>
      <button className="icon-button" onClick={onDismiss} aria-label="Cerrar notificación"><X size={18} /></button>
    </div>
  )
}

