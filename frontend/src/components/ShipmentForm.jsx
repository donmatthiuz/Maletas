import { useEffect, useState } from 'react'
import { Languages, LoaderCircle, MapPin, Save, Shuffle } from 'lucide-react'
import { api } from '../api'

const emptyForm = {
  code: '', bag_number: 1, manifest_id: '', bag_id: '', shipper_name: '', shipper_address: '', consignee_name: '',
  address_number: '', contents: '', attendant: 'DORIAN SANTIZO',
  shipment_date: new Date().toISOString().slice(0, 10), status: 'registrado',
}

export default function ShipmentForm({
  shipment,
  onSaved,
  notify,
  printMode = false,
  manifestId = '',
  bagId = '',
  bagNumber = 1,
  manifestDate = '',
  attendant = 'DORIAN SANTIZO',
}) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translated, setTranslated] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(shipment ? {
      code: shipment.code,
      bag_number: shipment.bag_number,
      manifest_id: shipment.manifest_id || '',
      bag_id: shipment.bag_id || '',
      shipper_name: shipment.shipper_name,
      shipper_address: shipment.shipper_address,
      consignee_name: shipment.consignee_name,
      address_number: shipment.address_number,
      contents: shipment.contents,
      attendant: shipment.attendant,
      shipment_date: shipment.shipment_date,
      status: shipment.status,
    } : {
      ...emptyForm,
      manifest_id: manifestId,
      bag_id: bagId,
      bag_number: bagNumber || 1,
      shipment_date: manifestDate || emptyForm.shipment_date,
      attendant: attendant || emptyForm.attendant,
    })
    setTranslated(Boolean(shipment))
    setError('')
  }, [shipment, manifestId, bagId, bagNumber, manifestDate, attendant])

  const update = (event) => {
    if (event.target.name === 'contents') setTranslated(false)
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const translate = async () => {
    if (!form.contents.trim()) return
    setTranslating(true)
    try {
      const result = await api('/translate', { method: 'POST', body: JSON.stringify({ text: form.contents }) })
      setForm((current) => ({ ...current, contents: result.translated }))
      setTranslated(true)
      notify('Contenido traducido al inglés.')
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
    const { address_number: _addressNumber, ...editableForm } = form
    const payload = {
      ...editableForm,
      bag_number: Number(form.bag_number),
      translate_contents: !translated,
    }
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
      {printMode && <div className="form-context"><span>Maleta #{bagNumber}</span><span>{manifestDate}</span><strong>{attendant}</strong></div>}
      <div className={`form-grid ${printMode ? '' : 'form-grid--3'}`}>
        <label><span>Código del paquete *</span><input name="code" value={form.code} onChange={update} placeholder="Ej. 201K" required autoFocus /></label>
        {!printMode && <label><span>N.º de maleta *</span><input name="bag_number" type="number" min="1" max="999" value={form.bag_number} onChange={update} required /></label>}
        {!printMode && <label><span>Fecha *</span><input name="shipment_date" type="date" value={form.shipment_date} onChange={update} required /></label>}
      </div>
    </fieldset>
    <fieldset>
      <legend>Origen y destino</legend>
      <div className="form-grid form-grid--2">
        <label><span>Nombre de quien envía *</span><input name="shipper_name" value={form.shipper_name} onChange={update} required /></label>
        <label><span>Nombre de quien recibe *</span><input name="consignee_name" value={form.consignee_name} onChange={update} required /></label>
        <label className="form-span"><span>Dirección en Guatemala *</span><input name="shipper_address" value={form.shipper_address} onChange={update} required /></label>
        <div className="address-assignment form-span">
          <span aria-hidden="true">{shipment ? <MapPin /> : <Shuffle />}</span>
          <div>{shipment ? <><strong>Dirección de destino asignada</strong><p>{shipment.consignee_address} · {shipment.phone}</p></> : <><strong>Asignación automática</strong><p>Al guardar se elegirá una dirección aleatoria que todavía no se haya usado en este manifiesto.</p></>}</div>
        </div>
      </div>
    </fieldset>
    <fieldset>
      <legend>Contenido y control</legend>
      <div className="form-grid form-grid--2">
        <label className="form-span"><span>Contenido *</span>
          <div className="input-action"><textarea name="contents" value={form.contents} onChange={update} rows="3" required /><button type="button" className="button button--soft" onClick={translate} disabled={translating}>{translating ? <LoaderCircle className="spin" /> : <Languages />} Traducir</button></div>
          <small>Se traduce al inglés automáticamente; las equivalencias del Excel tienen prioridad.</small>
        </label>
        {!printMode && <label><span>Encargado/a *</span><input name="attendant" value={form.attendant} onChange={update} required /></label>}
        {!printMode && <label><span>Estado</span><select name="status" value={form.status} onChange={update}><option value="registrado">Registrado</option><option value="en_transito">En tránsito</option><option value="entregado">Entregado</option></select></label>}
      </div>
    </fieldset>
    <div className="form-actions"><button className="button button--primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <Save />} {shipment ? 'Guardar cambios' : printMode ? 'Guardar baucher' : 'Registrar envío'}</button></div>
  </form>
}
