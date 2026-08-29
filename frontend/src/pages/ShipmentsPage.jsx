import { useCallback, useDeferredValue, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Edit3, MoreHorizontal, Plus, Printer, Search, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { API_URL, api, queryString } from '../api'
import EmptyState from '../components/EmptyState'
import LabelPreview from '../components/LabelPreview'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import ShipmentForm from '../components/ShipmentForm'
import StatusBadge from '../components/StatusBadge'

export default function ShipmentsPage({ notify }) {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 })
  const [addresses, setAddresses] = useState([])
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [bag, setBag] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [label, setLabel] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const formOpen = params.get('new') === '1' || Boolean(editing)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api(`/shipments?${queryString({ search: deferredSearch, bag_number: bag, status, page, limit: 12 })}`)
      setData(result)
    } catch (error) { notify(error.message, 'error') }
    finally { setLoading(false) }
  }, [deferredSearch, bag, status, page, notify])

  useEffect(() => { load() }, [load])
  useEffect(() => { api('/addresses').then(setAddresses).catch((error) => notify(error.message, 'error')) }, [notify])
  useEffect(() => { setPage(1) }, [deferredSearch, bag, status])

  const closeForm = () => { setEditing(null); params.delete('new'); setParams(params, { replace: true }) }
  const saved = () => { closeForm(); notify(editing ? 'Envío actualizado.' : 'Envío registrado.'); load() }
  const remove = async () => {
    try { await api(`/shipments/${deleteTarget.id}`, { method: 'DELETE' }); setDeleteTarget(null); notify('Envío eliminado.'); load() }
    catch (error) { notify(error.message, 'error') }
  }
  const exportUrl = `${API_URL}/shipments/export.csv?${queryString({ search: deferredSearch, bag_number: bag, status })}`

  return <div className="page-stack">
    <section className="toolbar">
      <div className="search-field"><Search aria-hidden="true" /><label className="sr-only" htmlFor="shipment-search">Buscar envíos</label><input id="shipment-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, persona o contenido" /></div>
      <label className="filter-field"><span className="sr-only">Filtrar por maleta</span><select value={bag} onChange={(e) => setBag(e.target.value)}><option value="">Todas las maletas</option>{[1,2,3,4,5,6,7,8,9].map((number) => <option key={number} value={number}>Maleta {number}</option>)}</select></label>
      <label className="filter-field"><span className="sr-only">Filtrar por estado</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos los estados</option><option value="registrado">Registrado</option><option value="en_transito">En tránsito</option><option value="entregado">Entregado</option></select></label>
      <a className="button button--secondary" href={exportUrl}><Download /> Exportar</a>
      <button className="button button--primary" onClick={() => setParams({ new: '1' })}><Plus /> Nuevo envío</button>
    </section>

    <section className="panel table-panel">
      <header className="panel__header compact"><div><h2>Listado de envíos</h2><p>{data.total} registros encontrados</p></div></header>
      {loading ? <Loading rows={7} /> : data.items.length === 0 ? <EmptyState action={<button className="button button--primary" onClick={() => setParams({ new: '1' })}><Plus /> Registrar envío</button>} /> : <>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Código</th><th>Maleta</th><th>Envía</th><th>Recibe</th><th>Contenido</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>
          {data.items.map((shipment) => <tr key={shipment.id}><td><strong className="code-cell">{shipment.code}</strong><small>{shipment.shipment_date}</small></td><td><span className="bag-tag">#{shipment.bag_number}</span></td><td><strong>{shipment.shipper_name}</strong><small>{shipment.shipper_address}</small></td><td><strong>{shipment.consignee_name}</strong><small>{shipment.consignee_address}</small></td><td className="content-cell">{shipment.contents}</td><td><StatusBadge status={shipment.status} /></td><td><div className="row-actions"><button className="icon-button" onClick={() => setLabel(shipment)} aria-label={`Imprimir etiqueta ${shipment.code}`} title="Imprimir etiqueta"><Printer /></button><button className="icon-button" onClick={() => setEditing(shipment)} aria-label={`Editar ${shipment.code}`} title="Editar"><Edit3 /></button><button className="icon-button icon-button--danger" onClick={() => setDeleteTarget(shipment)} aria-label={`Eliminar ${shipment.code}`} title="Eliminar"><Trash2 /></button></div></td></tr>)}
        </tbody></table></div>
        <div className="shipment-cards">{data.items.map((shipment) => <article key={shipment.id} className="shipment-card"><header><span className="package-code">{shipment.code}</span><StatusBadge status={shipment.status} /></header><dl><div><dt>Maleta</dt><dd>#{shipment.bag_number}</dd></div><div><dt>Recibe</dt><dd>{shipment.consignee_name}</dd></div><div><dt>Contenido</dt><dd>{shipment.contents}</dd></div></dl><footer><button className="button button--soft" onClick={() => setLabel(shipment)}><Printer /> Etiqueta</button><button className="button button--soft" onClick={() => setEditing(shipment)}><Edit3 /> Editar</button><button className="icon-button icon-button--danger" onClick={() => setDeleteTarget(shipment)} aria-label={`Eliminar ${shipment.code}`}><Trash2 /></button></footer></article>)}</div>
        <footer className="pagination"><span>Página {data.page} de {data.pages}</span><div><button className="icon-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Página anterior"><ChevronLeft /></button><button className="icon-button" disabled={page >= data.pages} onClick={() => setPage((value) => value + 1)} aria-label="Página siguiente"><ChevronRight /></button></div></footer>
      </>}
    </section>

    <Modal open={formOpen} onClose={closeForm} title={editing ? `Editar ${editing.code}` : 'Registrar nuevo envío'} description="Los datos alimentarán la etiqueta y el manifiesto." size="large"><ShipmentForm shipment={editing} addresses={addresses} onSaved={saved} notify={notify} /></Modal>
    <Modal open={Boolean(label)} onClose={() => setLabel(null)} title="Vista previa de etiqueta" description="Formato listo para imprimir." className="label-modal"><LabelPreview shipment={label} /></Modal>
    <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Eliminar envío" description="Esta acción no se puede deshacer." size="small"><div className="confirm-dialog"><p>¿Eliminar el paquete <strong>{deleteTarget?.code}</strong> del registro?</p><div className="form-actions"><button className="button button--secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button><button className="button button--danger" onClick={remove}><Trash2 /> Eliminar</button></div></div></Modal>
  </div>
}

