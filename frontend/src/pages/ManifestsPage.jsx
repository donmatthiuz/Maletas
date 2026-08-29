import { useEffect, useState } from 'react'
import { ClipboardList, Printer, RefreshCw } from 'lucide-react'
import { api, queryString } from '../api'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'

export default function ManifestsPage({ notify }) {
  const [bag, setBag] = useState(1)
  const [date, setDate] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api(`/manifests?${queryString({ bag_number: bag, shipment_date: date })}`).then(setItems).catch((e) => notify(e.message, 'error')).finally(() => setLoading(false))
  }
  useEffect(load, [bag, date])
  const print = () => { document.body.classList.add('printing-manifest'); window.print(); window.setTimeout(() => document.body.classList.remove('printing-manifest'), 200) }

  return <div className="page-stack">
    <section className="manifest-controls">
      <div><span className="eyebrow">Documento aduanero</span><h2>Generar manifiesto</h2><p>Selecciona una maleta y, si lo necesitas, limita los registros por fecha.</p></div>
      <div className="manifest-filters"><label><span>Maleta</span><select value={bag} onChange={(e) => setBag(Number(e.target.value))}>{[1,2,3,4,5,6,7,8,9].map((n) => <option key={n} value={n}>Maleta #{n}</option>)}</select></label><label><span>Fecha opcional</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><button className="button button--soft" onClick={load}><RefreshCw /> Actualizar</button></div>
    </section>

    <section className="panel manifest-panel">
      <header className="panel__header"><div><h2>Vista previa</h2><p>{items.length} paquetes en la maleta #{bag}</p></div><button className="button button--primary" onClick={print} disabled={!items.length}><Printer /> Imprimir manifiesto</button></header>
      {loading ? <Loading rows={8} /> : items.length === 0 ? <EmptyState title="Esta maleta está vacía" message="Asigna envíos a esta maleta o cambia el filtro de fecha." /> : <article className="manifest-sheet print-manifest">
        <header><div><span className="manifest-logo"><ClipboardList aria-hidden="true" /></span><div><strong>MANIFIESTO DE ENVÍO</strong><small>NOR ORIENTE</small></div></div><div><strong>BAG #{bag}</strong><span>{date || items[0]?.shipment_date}</span></div></header>
        <div className="manifest-meta"><span>ENCARGADO</span><strong>{items[0]?.attendant}</strong><span>TIPO</span><strong>UNSOLICITED</strong></div>
        <div className="manifest-table-wrap"><table className="manifest-table"><thead><tr><th>No.</th><th>Shipper / Address</th><th>Consignee / Address</th><th>Contents</th><th>Type</th><th>Price</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.code}</strong></td><td><strong>{item.shipper_name}</strong><span>{item.shipper_address}</span></td><td><strong>{item.consignee_name}</strong><span>{item.consignee_address}</span></td><td>{item.contents}</td><td>{item.customs_type}</td><td>${item.quantity}</td></tr>)}</tbody></table></div>
        <footer><span>Generado por Maletas · Centro de operaciones</span><strong>{items.length} registros</strong></footer>
      </article>}
    </section>
  </div>
}
