import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, description, children, size = 'medium', className = '' }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('modal-open')
    requestAnimationFrame(() => dialogRef.current?.focus())
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('modal-open')
      previousFocus?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className={`modal-layer ${className}`} role="presentation">
      <button className="modal-scrim" aria-label="Cerrar diálogo" onClick={onClose} />
      <section className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialogRef} tabIndex="-1">
        <header className="modal__header">
          <div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X /></button>
        </header>
        <div className="modal__body">{children}</div>
      </section>
    </div>
  )
}
