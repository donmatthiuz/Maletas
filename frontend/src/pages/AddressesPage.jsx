import { useDeferredValue, useEffect, useState } from 'react'
import { Edit3, MapPin, Phone, Plus, Save, Search } from 'lucide-react'
import { api, queryString } from '../api'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import Modal from '../components/Modal'

const empty = { number: '', address: '', phone: '' }
const duplicateFields = ['duplicate_number', 'duplicate_phone', 'duplicate_address']

function checkPayload(form, editing) {
  return {
    number: form.number === '' ? null : Number(form.number),
    phone: form.phone,
    address: form.address,
    exclude_id: editing?.id || null,
  }
}

export default function AddressesPage({ notify, onChanged }) {
  const [addresses, setAddresses] = useState([])
  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [checking, setChecking] = useState(false)
  const [check, setCheck] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    api(`/addresses?${queryString({ search: deferred })}`)
      .then(setAddresses)
      .catch((requestError) => notify(requestError.message, 'error'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [deferred])

  useEffect(() => {
    if (!editing) return undefined
    const controller = new AbortController()
    setChecking(true)
    const timer = window.setTimeout(() => {
      api('/addresses/check', {
        method: 'POST',
        body: JSON.stringify(checkPayload(form, editing)),
        signal: controller.signal,
      })
        .then((result) => { setCheck(result); setError('') })
        .catch((requestError) => {
          if (requestError.name !== 'AbortError') setError(requestError.message)
        })
        .finally(() => { if (!controller.signal.aborted) setChecking(false) })
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [editing, form.number, form.phone, form.address])

  const open = (address = null) => {
    setEditing(address || {})
    setForm(address ? { number: address.number, address: address.address, phone: address.phone } : empty)
    setCheck(null)
    setError('')
  }
  const close = () => setEditing(null)
  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setCheck(null)
  }
  const hasDuplicate = duplicateFields.some((field) => check?.[field])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await api('/addresses/check', {
        method: 'POST',
        body: JSON.stringify(checkPayload(form, editing)),
      })
      setCheck(result)
      if (duplicateFields.some((field) => result[field])) {
        setError('Corrige los datos repetidos antes de guardar.')
        return
      }
      await api(editing?.id ? `/addresses/${editing.id}` : '/addresses', {
        method: editing?.id ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...form, number: Number(form.number) }),
      })
      notify(editing?.id ? 'Dirección actualizada.' : 'Dirección agregada.')
      close()
      load()
      onChanged?.()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="page-stack">
    <section className="toolbar">
      <div className="search-field"><Search aria-hidden="true" /><label className="sr-only" htmlFor="address-search">Buscar dirección</label><input id="address-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por número, dirección o teléfono" /></div>
      <button className="button button--primary" onClick={() => open()}><Plus /> Nueva dirección</button>
    </section>
    <section className="panel">
      <header className="panel__header"><div><h2>Destinatarios frecuentes</h2><p>{addresses.length} direcciones disponibles</p></div></header>
      {loading ? <Loading rows={6} /> : addresses.length === 0 ? <EmptyState title="Sin direcciones" /> : <div className="address-grid">{addresses.map((item) => <article className="address-card" key={item.id}><header><span className="address-number">{String(item.number).padStart(2, '0')}</span><button className="icon-button" onClick={() => open(item)} aria-label={`Editar dirección ${item.number}`}><Edit3 /></button></header><p><MapPin aria-hidden="true" />{item.address}</p><p><Phone aria-hidden="true" /><a href={`tel:${item.phone}`}>{item.phone}</a></p></article>)}</div>}
    </section>
    <Modal open={Boolean(editing)} onClose={close} title={editing?.id ? 'Editar dirección' : 'Nueva dirección'} description="Se usará para completar los envíos automáticamente.">
      <form className="shipment-form" onSubmit={submit}>
        {error && <div className="error-summary" role="alert" tabIndex="-1">{error}</div>}
        <div className="form-grid form-grid--2">
          <div className="address-field">
            <label htmlFor="directory-number">Número *</label>
            <input id="directory-number" type="number" min="1" value={form.number} onChange={(event) => update('number', event.target.value)} aria-invalid={check?.duplicate_number || undefined} aria-describedby={check?.duplicate_number ? 'directory-number-error' : undefined} required />
            {check?.duplicate_number && <small className="address-field__error" id="directory-number-error">Este número ya existe.</small>}
            {!editing?.id && check?.suggested_number && <button type="button" className="address-suggestion" onClick={() => update('number', String(check.suggested_number))}>Usar siguiente número: <strong>{check.suggested_number}</strong></button>}
          </div>
          <div className="address-field">
            <label htmlFor="directory-phone">Teléfono *</label>
            <input id="directory-phone" type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} aria-invalid={check?.duplicate_phone || undefined} aria-describedby={check?.duplicate_phone ? 'directory-phone-error' : undefined} required />
            {check?.duplicate_phone && <small className="address-field__error" id="directory-phone-error">Este teléfono ya existe, aunque tenga otro formato.</small>}
            {!editing?.id && check?.suggested_phone && <button type="button" className="address-suggestion" onClick={() => update('phone', check.suggested_phone)}>Usar teléfono sugerido: <strong>{check.suggested_phone}</strong></button>}
          </div>
          <div className="address-field form-span">
            <label htmlFor="directory-address">Dirección completa *</label>
            <textarea id="directory-address" rows="3" value={form.address} onChange={(event) => update('address', event.target.value)} aria-invalid={check?.duplicate_address || undefined} aria-describedby={check?.duplicate_address ? 'directory-address-error' : undefined} required />
            {check?.duplicate_address && <small className="address-field__error" id="directory-address-error">Esta dirección ya existe, aunque cambien mayúsculas o tildes.</small>}
          </div>
        </div>
        <p className="address-form-note">El teléfono sugerido se calcula para que no se repita. Confirma que corresponde al destinatario antes de guardar.</p>
        <div className="form-actions"><button className="button button--primary" disabled={saving || checking || hasDuplicate}><Save /> {saving ? 'Guardando…' : checking ? 'Comprobando…' : 'Guardar dirección'}</button></div>
      </form>
    </Modal>
  </div>
}
