import { CheckCircle2, CircleDot, Truck } from 'lucide-react'

const config = {
  registrado: { label: 'Registrado', icon: CircleDot },
  en_transito: { label: 'En tránsito', icon: Truck },
  entregado: { label: 'Entregado', icon: CheckCircle2 },
}

export default function StatusBadge({ status }) {
  const item = config[status] || config.registrado
  const Icon = item.icon
  return <span className={`status-badge status-badge--${status}`}><Icon size={14} aria-hidden="true" />{item.label}</span>
}

