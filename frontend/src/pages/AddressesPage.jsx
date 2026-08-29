import { useDeferredValue, useEffect, useState } from 'react'
import { Edit3, MapPin, Phone, Plus, Save, Search } from 'lucide-react'
import { api, queryString } from '../api'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import Modal from '../components/Modal'

const empty = { number: '', address: '', phone: '' }

export default function AddressesPage({ notify, onChanged }) {
  const [addresses, setAddresses] = useState([])
  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    api(`/addresses?${queryString({ search: deferred })}`).then(setAddresses).catch((e) => notify(e.message, 'error')).finally(() => setLoading(false))
  }
  useEffect(load, [deferred])
  const open = (address = null) => { setEditing(address); setForm(address ? { number: address.number, address: address.address, phone: address.phone } : empty); setError('') }
  const close = () => setEditing(undefined)
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      await api(editing?.id ? `/addresses/${editing.id}` : '/addresses', { method: editing?.id ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, number: Number(form.number) }) })
      notify(editing?.id ? 'Dirección actualizada.' : 'Dirección agregada.'); close(); load(); onChanged?.()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  return <div className="page-stack">
    <section className="toolbar">
      <div className="search-field"><Search aria-hidden="true" /><label className="sr-only" htmlFor="address-search">Buscar dirección</label><input id="address-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número, dirección o teléfono" /></div>
      <button className="button button--primary" onClick={() => open({})}><Plus /> Nueva dirección</button>
    </section>
    <section className="panel">
      <header className="panel__header"><div><h2>Destinatarios frecuentes</h2><p>{addresses.length} direcciones disponibles</p></div></header>
      {loading ? <Loading rows={6} /> : addresses.length === 0 ? <EmptyState title="Sin direcciones" /> : <div className="address-grid">{addresses.map((item) => <article className="address-card" key={item.id}><header><span className="address-number">{String(item.number).padStart(2, '0')}</span><button className="icon-button" onClick={() => open(item)} aria-label={`Editar dirección ${item.number}`}><Edit3 /></button></header><p><MapPin aria-hidden="true" />{item.address}</p><p><Phone aria-hidden="true" /><a href={`tel:${item.phone}`}>{item.phone}</a></p></article>)}</div>}
    </section>
    <Modal open={editing !== undefined && editing !== null} onClose={close} title={editing?.id ? 'Editar dirección' : 'Nueva dirección'} description="Se usará para completar los envíos automáticamente.">
      <form className="shipment-form" onSubmit={submit}>{error && <div className="error-summary" role="alert">{error}</div>}<div className="form-grid form-grid--2"><label><span>Número *</span><input type="number" min="1" value={form.number} onChange={(e) => setForm({...form, number: e.target.value})} required /></label><label><span>Teléfono *</span><input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} required /></label><label className="form-span"><span>Dirección completa *</span><textarea rows="3" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} required /></label></div><div className="form-actions"><button className="button button--primary" disabled={saving}><Save /> {saving ? 'Guardando…' : 'Guardar dirección'}</button></div></form>
    </Modal>
  </div>
}
