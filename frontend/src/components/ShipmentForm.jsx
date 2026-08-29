import { useEffect, useMemo, useState } from 'react'
import { Languages, LoaderCircle, Save } from 'lucide-react'
import { api } from '../api'

const emptyForm = {
  code: '', bag_number: 1, shipper_name: '', shipper_address: '', consignee_name: '',
  address_number: '', contents: '', attendant: 'DORIAN SANTIZO',
  shipment_date: new Date().toISOString().slice(0, 10), status: 'registrado',
}

export default function ShipmentForm({ shipment, addresses, onSaved, notify }) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(shipment ? {
      code: shipment.code,
      bag_number: shipment.bag_number,
      shipper_name: shipment.shipper_name,
      shipper_address: shipment.shipper_address,
      consignee_name: shipment.consignee_name,
      address_number: shipment.address_number,
      contents: shipment.contents,
      attendant: shipment.attendant,
      shipment_date: shipment.shipment_date,
      status: shipment.status,
    } : emptyForm)
    setError('')
  }, [shipment])

  const selectedAddress = useMemo(
    () => addresses.find((address) => String(address.number) === String(form.address_number)),
    [addresses, form.address_number],
  )

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const translate = async () => {
    if (!form.contents.trim()) return
    setTranslating(true)
    try {
      const result = await api('/translate', { method: 'POST', body: JSON.stringify({ text: form.contents }) })
      setForm((current) => ({ ...current, contents: result.translated }))
      notify('Contenido traducido y normalizado.')
    } catch (requestError) {
      notify(requestError.message, 'error')
    } finally {
      setTranslating(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    const payload = { ...form, bag_number: Number(form.bag_number), address_number: Number(form.address_number) }
    try {
      const result = await api(shipment ? `/shipments/${shipment.id}` : '/shipments', {
        method: shipment ? 'PATCH' : 'POST', body: JSON.stringify(payload),
      })
      onSaved(result)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return <form onSubmit={submit} className="shipment-form">
    {error && <div className="error-summary" role="alert" tabIndex="-1"><strong>No se pudo guardar.</strong> {error}</div>}
    <fieldset>
      <legend>Identificación</legend>
      <div className="form-grid form-grid--3">
        <label><span>Código del paquete *</span><input name="code" value={form.code} onChange={update} placeholder="Ej. 201K" required autoFocus /></label>
        <label><span>N.º de maleta *</span><input name="bag_number" type="number" min="1" max="99" value={form.bag_number} onChange={update} required /></label>
        <label><span>Fecha *</span><input name="shipment_date" type="date" value={form.shipment_date} onChange={update} required /></label>
      </div>
    </fieldset>
    <fieldset>
      <legend>Origen y destino</legend>
      <div className="form-grid form-grid--2">
        <label><span>Nombre de quien envía *</span><input name="shipper_name" value={form.shipper_name} onChange={update} required /></label>
        <label><span>Nombre de quien recibe *</span><input name="consignee_name" value={form.consignee_name} onChange={update} required /></label>
        <label><span>Dirección en Guatemala *</span><input name="shipper_address" value={form.shipper_address} onChange={update} required /></label>
        <label><span>Dirección de destino *</span>
          <select name="address_number" value={form.address_number} onChange={update} required>
            <option value="">Selecciona del directorio</option>
            {addresses.map((address) => <option key={address.id} value={address.number}>{address.number} · {address.address}</option>)}
          </select>
          {selectedAddress && <small>{selectedAddress.phone}</small>}
        </label>
      </div>
    </fieldset>
    <fieldset>
      <legend>Contenido y control</legend>
      <div className="form-grid form-grid--2">
        <label className="form-span"><span>Contenido *</span>
          <div className="input-action"><textarea name="contents" value={form.contents} onChange={update} rows="3" required /><button type="button" className="button button--soft" onClick={translate} disabled={translating}>{translating ? <LoaderCircle className="spin" /> : <Languages />} Traducir</button></div>
          <small>La traducción usa el diccionario recuperado de la macro original.</small>
        </label>
        <label><span>Encargado/a *</span><input name="attendant" value={form.attendant} onChange={update} required /></label>
        <label><span>Estado</span><select name="status" value={form.status} onChange={update}><option value="registrado">Registrado</option><option value="en_transito">En tránsito</option><option value="entregado">Entregado</option></select></label>
      </div>
    </fieldset>
    <div className="form-actions"><button className="button button--primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <Save />} {shipment ? 'Guardar cambios' : 'Registrar envío'}</button></div>
  </form>
}

