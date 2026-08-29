import { PackageOpen } from 'lucide-react'

export default function EmptyState({ title = 'No encontramos registros', message, action }) {
  return <div className="empty-state">
    <span className="empty-state__icon" aria-hidden="true"><PackageOpen /></span>
    <h3>{title}</h3>
    <p>{message || 'Prueba cambiando los filtros o crea un registro nuevo.'}</p>
    {action}
  </div>
}

