import { useEffect, useState } from 'react'
import { ArrowRight, BookUser, Box, CheckCircle2, Clock3, Luggage, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import Loading from '../components/Loading'
import StatusBadge from '../components/StatusBadge'

export default function DashboardPage({ notify }) {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api('/stats'), api('/shipments?limit=5')])
      .then(([summary, shipments]) => { setStats(summary); setRecent(shipments.items) })
      .catch((error) => notify(error.message, 'error'))
      .finally(() => setLoading(false))
  }, [notify])

  if (loading) return <Loading rows={6} />
  const maxBag = Math.max(...(stats?.shipments_by_bag.map((item) => item.count) || [1]))

  return <div className="page-stack">
    <section className="welcome-panel">
      <div><span className="eyebrow">Operación del día</span><h2>Todo listo para despachar</h2><p>Registra paquetes, organiza cada maleta y prepara el manifiesto sin volver a duplicar datos.</p></div>
      <Link to="/envios?new=1" className="button button--accent"><Plus /> Nuevo envío</Link>
    </section>

    <section className="stats-grid" aria-label="Indicadores principales">
      <article className="stat-card"><span className="stat-icon stat-icon--blue"><Box /></span><div><span>Envíos totales</span><strong>{stats?.total_shipments || 0}</strong><small>Registros acumulados</small></div></article>
      <article className="stat-card"><span className="stat-icon stat-icon--orange"><Luggage /></span><div><span>Maletas activas</span><strong>{stats?.active_bags || 0}</strong><small>Con envíos asignados</small></div></article>
      <article className="stat-card"><span className="stat-icon stat-icon--amber"><Clock3 /></span><div><span>En tránsito</span><strong>{stats?.in_transit || 0}</strong><small>Pendientes de entrega</small></div></article>
      <article className="stat-card"><span className="stat-icon stat-icon--green"><CheckCircle2 /></span><div><span>Entregados</span><strong>{stats?.delivered || 0}</strong><small>Procesados con éxito</small></div></article>
    </section>

    <div className="dashboard-grid">
      <section className="panel">
        <header className="panel__header"><div><h2>Actividad reciente</h2><p>Últimos envíos registrados</p></div><Link to="/envios" className="text-link">Ver todos <ArrowRight /></Link></header>
        <div className="activity-list">
          {recent.map((shipment) => <article className="activity-item" key={shipment.id}>
            <span className="package-code">{shipment.code}</span>
            <div><strong>{shipment.consignee_name}</strong><span>{shipment.contents}</span></div>
            <span className="bag-tag">Maleta {shipment.bag_number}</span>
            <StatusBadge status={shipment.status} />
          </article>)}
        </div>
      </section>
      <section className="panel">
        <header className="panel__header"><div><h2>Carga por maleta</h2><p>Distribución actual</p></div></header>
        <div className="bag-chart">
          {stats?.shipments_by_bag.map((item) => <div className="bag-row" key={item.bag_number}>
            <span>Maleta {item.bag_number}</span><div className="bar-track"><span style={{ width: `${Math.max(8, item.count / maxBag * 100)}%` }} /></div><strong>{item.count}</strong>
          </div>)}
        </div>
        <Link className="directory-summary" to="/directorio"><BookUser aria-hidden="true" /><div><strong>{stats?.total_addresses || 0} direcciones</strong><span>Disponibles en el directorio</span></div><ArrowRight aria-hidden="true" /></Link>
      </section>
    </div>
  </div>
}
