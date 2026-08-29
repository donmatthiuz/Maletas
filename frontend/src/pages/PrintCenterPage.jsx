import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  FileSpreadsheet,
  FolderPlus,
  Luggage,
  MapPinned,
  PackagePlus,
  Plus,
  Printer,
  Search,
  TicketCheck,
} from 'lucide-react'
import { api } from '../api'
import ExcelManifest from '../components/ExcelManifest'
import ExcelVoucher from '../components/ExcelVoucher'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import ShipmentForm from '../components/ShipmentForm'
import AddressesPage from './AddressesPage'

const today = new Date().toISOString().slice(0, 10)

export default function PrintCenterPage({ notify }) {
  const [section, setSection] = useState('documents')
  const [manifests, setManifests] = useState([])
  const [bags, setBags] = useState([])
  const [shipments, setShipments] = useState([])
  const [addresses, setAddresses] = useState([])
  const [selectedManifestId, setSelectedManifestId] = useState('')
  const [selectedBagId, setSelectedBagId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [preview, setPreview] = useState('manifest')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [manifestOpen, setManifestOpen] = useState(false)
  const [bagOpen, setBagOpen] = useState(false)
  const [savingStructure, setSavingStructure] = useState(false)
  const [structureError, setStructureError] = useState('')
  const [manifestForm, setManifestForm] = useState({ name: '', manifest_date: today, attendant: 'DORIAN SANTIZO' })
  const [bagForm, setBagForm] = useState({ number: 1, name: '' })
  const [manifestPrintSheets, setManifestPrintSheets] = useState([])

  const selectedManifest = manifests.find((item) => item.id === selectedManifestId)
  const selectedBag = bags.find((item) => item.id === selectedBagId)
  const selectedShipment = shipments.find((item) => item.id === selectedId) || shipments[0]

  const loadAddresses = () => api('/addresses').then(setAddresses).catch((error) => notify(error.message, 'error'))

  const loadManifests = async (preferredId = '') => {
    try {
      const result = await api('/manifests')
      setManifests(result)
      setSelectedManifestId((current) => {
        const requested = preferredId || current
        return result.some((item) => item.id === requested) ? requested : (result[0]?.id || '')
      })
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const loadBags = async (manifestId, preferredId = '') => {
    if (!manifestId) {
      setBags([])
      setSelectedBagId('')
      return
    }
    try {
      const result = await api(`/manifests/${manifestId}/bags`)
      setBags(result)
      setSelectedBagId((current) => {
        const requested = preferredId || current
        return result.some((item) => item.id === requested) ? requested : (result[0]?.id || '')
      })
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const loadShipments = async (bagId) => {
    if (!bagId) {
      setShipments([])
      setSelectedId('')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await api(`/bags/${bagId}/shipments`)
      setShipments(result)
      setSelectedId((current) => result.some((item) => item.id === current) ? current : (result[0]?.id || ''))
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadManifests(); loadAddresses() }, [])
  useEffect(() => { setBags([]); setSelectedBagId(''); loadBags(selectedManifestId) }, [selectedManifestId])
  useEffect(() => { loadShipments(selectedBagId) }, [selectedBagId])

  const visibleShipments = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase()
    if (!term) return shipments
    return shipments.filter((item) => [item.code, item.shipper_name, item.consignee_name]
      .some((value) => String(value || '').toLowerCase().includes(term)))
  }, [shipments, deferredSearch])

  const openPrintDialog = (className, pageRule) => {
    const pageStyle = document.createElement('style')
    pageStyle.id = 'active-print-page'
    pageStyle.textContent = `@page { ${pageRule} }`
    document.head.appendChild(pageStyle)
    document.body.classList.add(className)
    const cleanup = () => {
      document.body.classList.remove(className)
      pageStyle.remove()
    }
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }

  const printManifest = async () => {
    if (!bags.length) return
    try {
      const sheets = await Promise.all(bags.map(async (bag) => ({
        bag,
        shipments: bag.id === selectedBagId ? shipments : await api(`/bags/${bag.id}/shipments`),
      })))
      setManifestPrintSheets(sheets)
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        openPrintDialog('print-manifest-document', 'size: A4 landscape !important; margin: 5mm !important;')
      }))
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const printVouchers = () => {
    if (shipments.length) openPrintDialog('print-vouchers-document', 'size: A4 portrait !important; margin: 13mm !important;')
  }

  const printSingleVoucher = () => {
    if (selectedShipment) openPrintDialog('print-single-voucher', 'size: A4 portrait !important; margin: 13mm !important;')
  }

  const onSaved = async () => {
    setFormOpen(false)
    notify('Baucher agregado a la maleta.')
    await Promise.all([loadShipments(selectedBagId), loadBags(selectedManifestId), loadManifests(selectedManifestId)])
  }

  const createManifest = async (event) => {
    event.preventDefault()
    setSavingStructure(true)
    setStructureError('')
    try {
      const created = await api('/manifests', { method: 'POST', body: JSON.stringify(manifestForm) })
      setManifestOpen(false)
      setManifestForm({ name: '', manifest_date: today, attendant: 'DORIAN SANTIZO' })
      await loadManifests(created.id)
      setSelectedManifestId(created.id)
      setBagForm({ number: 1, name: '' })
      setBagOpen(true)
      notify('Manifiesto creado. Ahora agrega su primera maleta.')
    } catch (error) {
      setStructureError(error.message)
    } finally {
      setSavingStructure(false)
    }
  }

  const openBagForm = () => {
    const nextNumber = Math.max(0, ...bags.map((bag) => bag.number)) + 1
    setBagForm({ number: nextNumber, name: '' })
    setStructureError('')
    setBagOpen(true)
  }

  const createBag = async (event) => {
    event.preventDefault()
    setSavingStructure(true)
    setStructureError('')
    try {
      const created = await api(`/manifests/${selectedManifestId}/bags`, {
        method: 'POST',
        body: JSON.stringify({ ...bagForm, number: Number(bagForm.number), name: bagForm.name || null }),
      })
      setBagOpen(false)
      await loadBags(selectedManifestId, created.id)
      setSelectedBagId(created.id)
      notify('Maleta agregada. Ya puedes registrar sus bauchers.')
    } catch (error) {
      setStructureError(error.message)
    } finally {
      setSavingStructure(false)
    }
  }

  return (
    <div className="print-center">
      <header className="print-center__header">
        <div className="print-brand"><span aria-hidden="true"><Luggage /></span><div><strong>Maletas</strong><small>Nor Oriente</small></div></div>
        <nav className="print-nav" aria-label="Secciones principales">
          <button className={section === 'documents' ? 'active' : ''} onClick={() => setSection('documents')}><FileSpreadsheet /> Documentos</button>
          <button className={section === 'addresses' ? 'active' : ''} onClick={() => setSection('addresses')}><MapPinned /> Direcciones</button>
        </nav>
        {section === 'documents' && <button className="button button--primary" disabled={!selectedBag} onClick={() => setFormOpen(true)}><PackagePlus /> Agregar baucher</button>}
      </header>

      <main id="main-content" className="print-center__main">
        {section === 'addresses' ? (
          <>
            <div className="section-heading"><div><span className="section-kicker">DIRECTORIO</span><h1>Direcciones de destino</h1><p>Registra las direcciones disponibles al crear cualquier baucher.</p></div></div>
            <AddressesPage notify={notify} onChanged={loadAddresses} />
          </>
        ) : (
          <>
            <div className="section-heading"><div><span className="section-kicker">DOCUMENTOS</span><h1>Manifiestos, maletas y bauchers</h1><p>Cada manifiesto contiene maletas; cada maleta contiene sus bauchers.</p></div></div>
            <section className="document-controls" aria-label="Jerarquía del documento">
              <div className="structure-control"><label htmlFor="manifest-select">1. Manifiesto</label><div><select id="manifest-select" value={selectedManifestId} onChange={(event) => setSelectedManifestId(event.target.value)}><option value="">Selecciona un manifiesto</option>{manifests.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.manifest_date}</option>)}</select><button className="icon-button icon-button--add" onClick={() => { setStructureError(''); setManifestOpen(true) }} aria-label="Crear manifiesto"><Plus /></button></div></div>
              <ChevronRight className="structure-arrow" aria-hidden="true" />
              <div className="structure-control"><label htmlFor="bag-select">2. Maleta</label><div><select id="bag-select" value={selectedBagId} disabled={!selectedManifestId} onChange={(event) => setSelectedBagId(event.target.value)}><option value="">{selectedManifestId ? 'Selecciona una maleta' : 'Primero elige un manifiesto'}</option>{bags.map((item) => <option value={item.id} key={item.id}>{item.name || `Maleta #${item.number}`} · {item.voucher_count} bauchers</option>)}</select><button className="icon-button icon-button--add" disabled={!selectedManifestId} onClick={openBagForm} aria-label="Agregar maleta"><Plus /></button></div></div>
              <ChevronRight className="structure-arrow" aria-hidden="true" />
              <div className="document-count"><TicketCheck aria-hidden="true" /><div><strong>{shipments.length}</strong><span>bauchers en esta maleta</span></div></div>
              <div className="document-controls__actions"><button className="button button--secondary" disabled={!shipments.length} onClick={printVouchers}><Printer /> Imprimir bauchers</button><button className="button button--primary" disabled={!bags.length} onClick={printManifest}><FileSpreadsheet /> Imprimir manifiesto</button></div>
            </section>

            {!selectedManifestId ? (
              <section className="structure-empty"><FolderPlus /><h2>Crea tu primer manifiesto</h2><p>Después podrás agregarle maletas y registrar los bauchers de cada una.</p><button className="button button--primary" onClick={() => setManifestOpen(true)}><Plus /> Nuevo manifiesto</button></section>
            ) : !selectedBagId ? (
              <section className="structure-empty"><Luggage /><h2>Este manifiesto todavía no tiene maletas</h2><p>Agrega una maleta para comenzar a registrar bauchers.</p><button className="button button--primary" onClick={openBagForm}><Plus /> Agregar maleta</button></section>
            ) : (
              <section className="print-workbench">
                <aside className="package-summary"><header><div><span className="section-kicker">RESUMEN</span><h2>{selectedBag?.name || `Maleta #${selectedBag?.number}`}</h2><p>{selectedManifest?.name}</p></div></header><div className="package-search"><Search aria-hidden="true" /><label className="sr-only" htmlFor="package-search">Buscar baucher</label><input id="package-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar código o nombre" /></div>
                  {loading ? <Loading rows={6} /> : visibleShipments.length ? <div className="package-summary__list">{visibleShipments.map((shipment, index) => <button className={`package-summary__item ${selectedShipment?.id === shipment.id ? 'package-summary__item--selected' : ''}`} key={shipment.id} onClick={() => { setSelectedId(shipment.id); setPreview('voucher') }}><span className="package-summary__number">{String(index + 1).padStart(2, '0')}</span><span><strong>{shipment.code}</strong><small>{shipment.shipper_name} → {shipment.consignee_name}</small></span><ChevronRight aria-hidden="true" /></button>)}</div> : <div className="print-empty"><strong>No hay bauchers</strong><span>Agrega el primer baucher de esta maleta.</span><button className="button button--primary" onClick={() => setFormOpen(true)}><Plus /> Agregar baucher</button></div>}
                </aside>
                <div className="document-stage"><header className="document-stage__toolbar"><div className="document-tabs" role="tablist" aria-label="Documento a previsualizar"><button role="tab" aria-selected={preview === 'manifest'} className={preview === 'manifest' ? 'active' : ''} onClick={() => setPreview('manifest')}><FileSpreadsheet /> Manifiesto</button><button role="tab" aria-selected={preview === 'voucher'} className={preview === 'voucher' ? 'active' : ''} onClick={() => setPreview('voucher')}><TicketCheck /> Baucher</button></div>{preview === 'voucher' && selectedShipment && <button className="button button--secondary" onClick={printSingleVoucher}><Printer /> Imprimir este baucher</button>}</header><div className={`document-stage__canvas document-stage__canvas--${preview}`}>{loading ? <Loading rows={5} /> : preview === 'manifest' ? <ExcelManifest shipments={shipments} bagNumber={selectedBag.number} manifestDate={selectedManifest.manifest_date} attendant={selectedManifest.attendant} /> : selectedShipment ? <ExcelVoucher shipment={selectedShipment} /> : <div className="print-empty"><strong>Agrega o selecciona un baucher</strong></div>}</div></div>
              </section>
            )}

            <div className="print-only manifest-print-root">{manifestPrintSheets.map(({ bag, shipments: bagShipments }) => <ExcelManifest key={bag.id} shipments={bagShipments} bagNumber={bag.number} manifestDate={selectedManifest?.manifest_date} attendant={selectedManifest?.attendant} batch />)}</div>
            <div className="print-only vouchers-print-root">{shipments.map((shipment) => <ExcelVoucher shipment={shipment} batch key={shipment.id} />)}</div>
            <div className="print-only single-voucher-print-root"><ExcelVoucher shipment={selectedShipment} /></div>
          </>
        )}
      </main>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Agregar baucher" description={`${selectedManifest?.name || ''} · ${selectedBag?.name || ''}`} size="large"><ShipmentForm addresses={addresses} onSaved={onSaved} notify={notify} printMode manifestId={selectedManifestId} bagId={selectedBagId} bagNumber={selectedBag?.number} manifestDate={selectedManifest?.manifest_date} attendant={selectedManifest?.attendant} /></Modal>
      <Modal open={manifestOpen} onClose={() => setManifestOpen(false)} title="Nuevo manifiesto" description="Define la fecha y el encargado del documento."><form className="shipment-form" onSubmit={createManifest}>{structureError && <div className="error-summary" role="alert">{structureError}</div>}<div className="form-grid form-grid--2"><label className="form-span"><span>Nombre del manifiesto *</span><input value={manifestForm.name} onChange={(event) => setManifestForm({ ...manifestForm, name: event.target.value })} placeholder="Ej. Envío 15 de septiembre" required autoFocus /></label><label><span>Fecha *</span><input type="date" value={manifestForm.manifest_date} onChange={(event) => setManifestForm({ ...manifestForm, manifest_date: event.target.value })} required /></label><label><span>Encargado/a *</span><input value={manifestForm.attendant} onChange={(event) => setManifestForm({ ...manifestForm, attendant: event.target.value })} required /></label></div><div className="form-actions"><button className="button button--primary" disabled={savingStructure}><FolderPlus /> {savingStructure ? 'Creando…' : 'Crear manifiesto'}</button></div></form></Modal>
      <Modal open={bagOpen} onClose={() => setBagOpen(false)} title="Agregar maleta" description={`Dentro de ${selectedManifest?.name || 'este manifiesto'}.`}><form className="shipment-form" onSubmit={createBag}>{structureError && <div className="error-summary" role="alert">{structureError}</div>}<div className="form-grid form-grid--2"><label><span>Número de maleta *</span><input type="number" min="1" max="999" value={bagForm.number} onChange={(event) => setBagForm({ ...bagForm, number: event.target.value })} required autoFocus /></label><label><span>Nombre opcional</span><input value={bagForm.name} onChange={(event) => setBagForm({ ...bagForm, name: event.target.value })} placeholder={`Maleta #${bagForm.number}`} /></label></div><div className="form-actions"><button className="button button--primary" disabled={savingStructure}><Luggage /> {savingStructure ? 'Guardando…' : 'Agregar maleta'}</button></div></form></Modal>
    </div>
  )
}
