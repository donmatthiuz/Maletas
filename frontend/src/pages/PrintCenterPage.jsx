import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Expand, FileSpreadsheet, FolderPlus, Luggage, MapPin, MapPinned, PackagePlus, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Printer, Search, TicketCheck, Trash2 } from 'lucide-react'
import { api, queryString } from '../api'
import ExcelManifest, { paginateManifest } from '../components/ExcelManifest'
import ExcelVoucher from '../components/ExcelVoucher'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import ShipmentForm from '../components/ShipmentForm'
import SortableVoucherList from '../components/SortableVoucherList'
import AddressesPage from './AddressesPage'

const today = new Date().toISOString().slice(0, 10)

export default function PrintCenterPage({ notify }) {
  const [section, setSection] = useState('manifests')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('maletas-sidebar-collapsed') === 'true')
  const [manifests, setManifests] = useState([])
  const [bags, setBags] = useState([])
  const [shipments, setShipments] = useState([])
  const [selectedManifestId, setSelectedManifestId] = useState('')
  const [selectedBagId, setSelectedBagId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [preview, setPreview] = useState('manifest')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingShipment, setEditingShipment] = useState(null)
  const [assignedShipment, setAssignedShipment] = useState(null)
  const [deletingShipment, setDeletingShipment] = useState(null)
  const [manifestOpen, setManifestOpen] = useState(false)
  const [bagOpen, setBagOpen] = useState(false)
  const [editingBag, setEditingBag] = useState(null)
  const [savingStructure, setSavingStructure] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [structureError, setStructureError] = useState('')
  const [manifestForm, setManifestForm] = useState({ name: '', manifest_date: today })
  const [bagForm, setBagForm] = useState({ number: 1, name: '', attendant: '' })
  const [manifestPrintSheets, setManifestPrintSheets] = useState([])
  const [vouchersToPrint, setVouchersToPrint] = useState([])
  const [manifestLargeOpen, setManifestLargeOpen] = useState(false)
  const [expandedManifestSheets, setExpandedManifestSheets] = useState([])
  const [expandedManifestLoading, setExpandedManifestLoading] = useState(false)
  const [voucherSearch, setVoucherSearch] = useState('')
  const [voucherSearchResults, setVoucherSearchResults] = useState([])
  const [voucherSearchLoading, setVoucherSearchLoading] = useState(false)

  const selectedManifest = manifests.find((item) => item.id === selectedManifestId)
  const selectedBag = bags.find((item) => item.id === selectedBagId)
  const selectedShipment = shipments.find((item) => item.id === selectedId) || shipments[0]
  const previewPages = useMemo(() => paginateManifest(shipments), [shipments])

  const loadManifests = async (preferredId = '') => {
    try {
      const result = await api('/manifests')
      setManifests(result)
      setSelectedManifestId((current) => {
        const requested = preferredId || current
        return result.some((item) => item.id === requested) ? requested : (result[0]?.id || '')
      })
    } catch (error) { notify(error.message, 'error') }
  }

  const loadBags = async (manifestId, preferredId = '') => {
    if (!manifestId) { setBags([]); setSelectedBagId(''); return }
    try {
      const result = await api(`/manifests/${manifestId}/bags`)
      setBags(result)
      setSelectedBagId((current) => {
        const requested = preferredId || current
        return result.some((item) => item.id === requested) ? requested : (result[0]?.id || '')
      })
    } catch (error) { notify(error.message, 'error') }
  }

  const loadShipments = async (bagId) => {
    if (!bagId) { setShipments([]); setSelectedId(''); setLoading(false); return }
    setLoading(true)
    try {
      const result = await api(`/bags/${bagId}/shipments`)
      setShipments(result)
      setSelectedId((current) => result.some((item) => item.id === current) ? current : (result[0]?.id || ''))
    } catch (error) { notify(error.message, 'error') } finally { setLoading(false) }
  }

  useEffect(() => { loadManifests() }, [])
  useEffect(() => { setBags([]); setSelectedBagId(''); loadBags(selectedManifestId) }, [selectedManifestId])
  useEffect(() => { loadShipments(selectedBagId) }, [selectedBagId])
  useEffect(() => { window.localStorage.setItem('maletas-sidebar-collapsed', String(sidebarCollapsed)) }, [sidebarCollapsed])
  useEffect(() => {
    const code = voucherSearch.trim()
    if (section !== 'vouchers' || !selectedManifestId || !code) {
      setVoucherSearchResults([])
      setVoucherSearchLoading(false)
      return undefined
    }

    let active = true
    setVoucherSearchLoading(true)
    const timeout = window.setTimeout(async () => {
      try {
        const result = await api(`/shipments?${queryString({ search: code, manifest_id: selectedManifestId, limit: 100 })}`)
        if (!active) return
        const normalized = code.toLocaleLowerCase()
        setVoucherSearchResults(result.items
          .filter((item) => item.code.toLocaleLowerCase().includes(normalized))
          .sort((left, right) => Number(right.code.toLocaleLowerCase() === normalized) - Number(left.code.toLocaleLowerCase() === normalized)))
      } catch (error) {
        if (active) { setVoucherSearchResults([]); notify(error.message, 'error') }
      } finally {
        if (active) setVoucherSearchLoading(false)
      }
    }, 250)

    return () => { active = false; window.clearTimeout(timeout) }
  }, [voucherSearch, selectedManifestId, section, notify])

  const openPrintDialog = (className, pageRule) => {
    document.getElementById('active-print-page')?.remove()
    const pageStyle = document.createElement('style')
    pageStyle.id = 'active-print-page'
    pageStyle.textContent = `@page { ${pageRule} }`
    document.head.appendChild(pageStyle)
    document.body.classList.add(className)
    const cleanup = () => { document.body.classList.remove(className); pageStyle.remove() }
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }
  const deferPrint = (className, pageRule) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => openPrintDialog(className, pageRule)))

  const buildManifestSheets = async (targetBags) => {
    const groups = await Promise.all(targetBags.map(async (bag) => ({
      bag,
      shipments: bag.id === selectedBagId ? shipments : await api(`/bags/${bag.id}/shipments`),
    })))
    return groups.flatMap(({ bag, shipments: bagShipments }) => paginateManifest(bagShipments).map((pageShipments, pageIndex) => ({ bag, shipments: pageShipments, pageIndex })))
  }

  const openExpandedManifest = async () => {
    if (!bags.length) return
    setManifestLargeOpen(true)
    setExpandedManifestLoading(true)
    try {
      setExpandedManifestSheets(await buildManifestSheets(bags))
    } catch (error) {
      setManifestLargeOpen(false)
      notify(error.message, 'error')
    } finally { setExpandedManifestLoading(false) }
  }

  const openBagVouchers = (bagId) => {
    setSelectedBagId(bagId)
    setPreview('voucher')
    setSection('vouchers')
  }

  const openSearchResult = (shipment) => {
    setSelectedBagId(shipment.bag_id)
    setSelectedId(shipment.id)
    setPreview('voucher')
    setVoucherSearch('')
    setVoucherSearchResults([])
  }

  const printManifest = async (targetBags = bags) => {
    if (!targetBags.length) return
    try {
      setManifestPrintSheets(await buildManifestSheets(targetBags))
      deferPrint('print-manifest-document', 'size: A4 landscape !important; margin: 0.2362204724in !important;')
    } catch (error) { notify(error.message, 'error') }
  }

  const printAllManifestVouchers = async () => {
    if (!bags.length) return
    try {
      const groups = await Promise.all(bags.map((bag) => bag.id === selectedBagId ? Promise.resolve(shipments) : api(`/bags/${bag.id}/shipments`)))
      const vouchers = groups.flat()
      setVouchersToPrint(vouchers)
      if (!vouchers.length) { notify('Este manifiesto todavía no tiene bauchers.', 'error'); return }
      deferPrint('print-vouchers-document', 'size: A4 portrait !important; margin: 0.75in 13mm !important;')
    } catch (error) { notify(error.message, 'error') }
  }

  const printBagVouchers = () => {
    if (!shipments.length) return
    setVouchersToPrint(shipments)
    deferPrint('print-vouchers-document', 'size: A4 portrait !important; margin: 0.75in 13mm !important;')
  }
  const printSingleVoucher = () => selectedShipment && deferPrint('print-single-voucher', 'size: A4 portrait !important; margin: 0.75in 13mm !important;')

  const refreshHierarchy = async (shipmentId = '') => {
    await Promise.all([loadShipments(selectedBagId), loadBags(selectedManifestId), loadManifests(selectedManifestId)])
    if (shipmentId) setSelectedId(shipmentId)
  }
  const onSaved = async (saved) => {
    const wasEditing = Boolean(editingShipment)
    setFormOpen(false); setEditingShipment(null)
    if (!wasEditing) setAssignedShipment(saved)
    notify(wasEditing ? 'Baucher actualizado.' : 'Baucher agregado a la maleta.')
    await refreshHierarchy(saved?.id)
  }
  const reorderShipments = async (nextOrder) => {
    if (reordering) return
    const previous = shipments
    setShipments(nextOrder); setReordering(true)
    try {
      const saved = await api(`/bags/${selectedBagId}/shipments/order`, { method: 'PUT', body: JSON.stringify({ shipment_ids: nextOrder.map((item) => item.id) }) })
      setShipments(saved); notify('Orden de impresión actualizado.')
    } catch (error) { setShipments(previous); notify(error.message, 'error') } finally { setReordering(false) }
  }
  const deleteShipment = async () => {
    if (!deletingShipment) return
    setDeleting(true)
    try {
      await api(`/shipments/${deletingShipment.id}`, { method: 'DELETE' })
      setDeletingShipment(null); notify('Baucher eliminado.'); await refreshHierarchy()
    } catch (error) { notify(error.message, 'error') } finally { setDeleting(false) }
  }

  const createManifest = async (event) => {
    event.preventDefault(); setSavingStructure(true); setStructureError('')
    try {
      const created = await api('/manifests', { method: 'POST', body: JSON.stringify(manifestForm) })
      setManifestOpen(false); setManifestForm({ name: '', manifest_date: today })
      await loadManifests(created.id); setSelectedManifestId(created.id); setEditingBag(null); setBagForm({ number: 1, name: '', attendant: '' }); setBagOpen(true)
      notify('Manifiesto creado. Ahora agrega su primera maleta.')
    } catch (error) { setStructureError(error.message) } finally { setSavingStructure(false) }
  }
  const openBagForm = (bag = null) => {
    setEditingBag(bag)
    setBagForm(bag ? { number: bag.number, name: bag.name || '', attendant: bag.attendant || '' } : { number: Math.max(0, ...bags.map((item) => item.number)) + 1, name: '', attendant: '' })
    setStructureError(''); setBagOpen(true)
  }
  const saveBag = async (event) => {
    event.preventDefault(); setSavingStructure(true); setStructureError('')
    try {
      const payload = { ...bagForm, number: Number(bagForm.number), name: bagForm.name || null }
      const saved = await api(editingBag ? `/bags/${editingBag.id}` : `/manifests/${selectedManifestId}/bags`, { method: editingBag ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      setBagOpen(false); setEditingBag(null); await loadBags(selectedManifestId, saved.id); setSelectedBagId(saved.id)
      notify(editingBag ? 'Maleta actualizada.' : 'Maleta agregada. Ya puedes registrar sus bauchers.')
    } catch (error) { setStructureError(error.message) } finally { setSavingStructure(false) }
  }

  const hierarchyControls = (
    <section className="document-controls" aria-label="Seleccionar manifiesto y maleta">
      <div className="structure-control"><label htmlFor={`${section}-manifest-select`}>Manifiesto</label><div><select id={`${section}-manifest-select`} value={selectedManifestId} onChange={(event) => setSelectedManifestId(event.target.value)}><option value="">Selecciona un manifiesto</option>{manifests.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.manifest_date}</option>)}</select><button className="icon-button icon-button--add" type="button" onClick={() => { setStructureError(''); setManifestOpen(true) }} aria-label="Crear manifiesto"><Plus /></button></div></div>
      <div className="structure-control"><label htmlFor={`${section}-bag-select`}>Maleta</label><div><select id={`${section}-bag-select`} value={selectedBagId} disabled={!selectedManifestId} onChange={(event) => setSelectedBagId(event.target.value)}><option value="">{selectedManifestId ? 'Selecciona una maleta' : 'Primero elige un manifiesto'}</option>{bags.map((item) => <option value={item.id} key={item.id}>{item.name || `Maleta #${item.number}`} · {item.voucher_count} bauchers</option>)}</select><button className="icon-button icon-button--add" type="button" disabled={!selectedManifestId} onClick={() => openBagForm()} aria-label="Agregar maleta"><Plus /></button></div></div>
      <div className="document-count"><TicketCheck aria-hidden="true" /><div><strong>{shipments.length}</strong><span>bauchers en esta maleta</span></div></div>
    </section>
  )

  return <div className={`workspace-shell ${sidebarCollapsed ? 'workspace-shell--sidebar-collapsed' : ''}`}>
    <aside className="workspace-sidebar">
      <div className="print-brand"><span aria-hidden="true"><Luggage /></span><div><strong>Maletas</strong><small>Nor Oriente</small></div><button className="icon-button workspace-sidebar__toggle" type="button" onClick={() => setSidebarCollapsed((current) => !current)} aria-label={sidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'} aria-expanded={!sidebarCollapsed}>{sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button></div>
      <nav className="workspace-nav" aria-label="Secciones principales">
        <button className={section === 'manifests' ? 'active' : ''} onClick={() => setSection('manifests')} aria-label="Manifiestos y maletas" title={sidebarCollapsed ? 'Manifiestos y maletas' : undefined}><FileSpreadsheet /><span>Manifiestos y maletas</span></button>
        <button className={section === 'vouchers' ? 'active' : ''} onClick={() => setSection('vouchers')} aria-label="Bauchers" title={sidebarCollapsed ? 'Bauchers' : undefined}><TicketCheck /><span>Bauchers</span></button>
        <button className={section === 'addresses' ? 'active' : ''} onClick={() => setSection('addresses')} aria-label="Direcciones" title={sidebarCollapsed ? 'Direcciones' : undefined}><MapPinned /><span>Direcciones</span></button>
      </nav>
    </aside>

    <main id="main-content" className="workspace-content">
      {section === 'addresses' ? <AddressesView notify={notify} /> : section === 'manifests' ? (
        <div className="screen-content">
          <div className="section-heading"><div><span className="section-kicker">DOCUMENTOS</span><h1>Manifiestos y maletas</h1><p>Crea manifiestos, agrega sus maletas y revisa todas sus hojas antes de imprimir.</p></div><button className="button button--primary" onClick={() => { setStructureError(''); setManifestOpen(true) }}><FolderPlus /> Nuevo manifiesto</button></div>
          {hierarchyControls}
          {!selectedManifestId ? <EmptyHierarchy type="manifest" onAction={() => setManifestOpen(true)} /> : !selectedBagId ? <EmptyHierarchy type="bag" onAction={openBagForm} /> : <>
            <section className="manifest-actions"><div><strong>{selectedManifest?.name}</strong><span>{bags.length} maletas · {selectedManifest?.voucher_count || 0} bauchers</span></div><div><button className="button button--secondary" onClick={() => openBagForm(selectedBag)}><Pencil /> Editar maleta</button><button className="button button--secondary" disabled={!bags.length} onClick={openExpandedManifest}><Expand /> Ver manifiesto en grande</button><button className="button button--secondary" disabled={!shipments.length} onClick={() => printManifest([selectedBag])}><Printer /> Imprimir esta maleta</button><button className="button button--secondary" disabled={!bags.length} onClick={printAllManifestVouchers}><TicketCheck /> Imprimir todos los bauchers</button><button className="button button--primary" disabled={!bags.length} onClick={() => printManifest()}><FileSpreadsheet /> Imprimir manifiesto completo</button></div></section>
            <section className="bag-overview">
              <div className="bag-list"><header><span className="section-kicker">MALETAS</span><h2>Contenido del manifiesto</h2><p>Doble clic en una maleta para abrir sus bauchers.</p></header>{bags.map((bag) => <button key={bag.id} className={bag.id === selectedBagId ? 'active' : ''} onClick={() => setSelectedBagId(bag.id)} onDoubleClick={() => openBagVouchers(bag.id)} title="Doble clic para abrir los bauchers"><span><Luggage /></span><span><strong>{bag.name || `Maleta #${bag.number}`}</strong><small>Envía: {bag.attendant}</small><small>{bag.voucher_count} bauchers · {Math.max(1, Math.ceil(bag.voucher_count / 15))} hojas</small></span></button>)}<button className="bag-list__add" onClick={() => openBagForm()}><Plus /> Agregar maleta</button></div>
              <ManifestPreview loading={loading} pages={previewPages} selectedBag={selectedBag} selectedManifest={selectedManifest} keyPrefix={selectedBagId} onOpenExpanded={openExpandedManifest} />
            </section>
          </>}
        </div>
      ) : (
        <div className="screen-content">
          <div className="section-heading"><div><span className="section-kicker">BAUCHERS</span><h1>Orden y edición de bauchers</h1><p>Arrastra para cambiar el orden de impresión. También puedes usar los botones de subir y bajar.</p></div><div className="section-heading__actions"><button className="button button--secondary" disabled={!selectedBag} onClick={() => openBagForm(selectedBag)}><Pencil /> Editar maleta</button><button className="button button--primary" disabled={!selectedBag} onClick={() => setFormOpen(true)}><PackagePlus /> Agregar baucher</button></div></div>
          {hierarchyControls}
          <section className="manifest-voucher-search" aria-label="Buscar baucher por código dentro del manifiesto">
            <div className="manifest-voucher-search__field"><Search aria-hidden="true" /><label htmlFor="manifest-voucher-search">Buscar baucher en este manifiesto</label><input id="manifest-voucher-search" type="search" value={voucherSearch} disabled={!selectedManifestId} onChange={(event) => setVoucherSearch(event.target.value)} placeholder={selectedManifestId ? 'Escribe el código, por ejemplo 201K' : 'Primero selecciona un manifiesto'} autoComplete="off" /></div>
            <p>{selectedManifest ? `La búsqueda incluye todas las maletas de ${selectedManifest.name}.` : 'Selecciona un manifiesto para buscar por código.'}</p>
            {voucherSearch.trim() && <div className="manifest-voucher-search__results" aria-live="polite">{voucherSearchLoading ? <span>Buscando código…</span> : voucherSearchResults.length ? <ul>{voucherSearchResults.map((shipment) => <li key={shipment.id}><button type="button" onClick={() => openSearchResult(shipment)}><strong>{shipment.code}</strong><span>{shipment.shipper_name}</span><small>Maleta #{shipment.bag_number}</small></button></li>)}</ul> : <span>No se encontró ese código en este manifiesto. Revisa que esté escrito correctamente.</span>}</div>}
          </section>
          {!selectedBag ? <section className="structure-empty"><Luggage /><h2>Selecciona una maleta</h2><p>Elige o crea un manifiesto y una maleta para administrar sus bauchers.</p></section> : <section className="print-workbench">
            <aside className="package-summary"><header><div><span className="section-kicker">ORDEN DE IMPRESIÓN</span><h2>{selectedBag.name || `Maleta #${selectedBag.number}`}</h2><p>{reordering ? 'Guardando orden…' : `${shipments.length} bauchers`}</p></div><button className="button button--soft" disabled={!shipments.length} onClick={printBagVouchers}><Printer /> Imprimir bauchers maleta</button></header>{loading ? <Loading rows={6} /> : shipments.length ? <SortableVoucherList shipments={shipments} selectedId={selectedShipment?.id} onSelect={(shipment) => { setSelectedId(shipment.id); setPreview('voucher') }} onEdit={setEditingShipment} onDelete={setDeletingShipment} onReorder={reorderShipments} /> : <div className="print-empty"><strong>No hay bauchers</strong><span>Agrega el primer baucher de esta maleta.</span><button className="button button--primary" onClick={() => setFormOpen(true)}><Plus /> Agregar baucher</button></div>}</aside>
            <div className="document-stage"><header className="document-stage__toolbar"><div className="document-tabs" role="tablist" aria-label="Documento a previsualizar"><button role="tab" aria-selected={preview === 'manifest'} className={preview === 'manifest' ? 'active' : ''} onClick={() => setPreview('manifest')}><FileSpreadsheet /> Hoja de maleta</button><button role="tab" aria-selected={preview === 'voucher'} className={preview === 'voucher' ? 'active' : ''} onClick={() => setPreview('voucher')}><TicketCheck /> Baucher</button></div>{preview === 'voucher' && selectedShipment && <button className="button button--secondary" onClick={printSingleVoucher}><Printer /> Imprimir este baucher</button>}</header><div className={`document-stage__canvas document-stage__canvas--${preview}`}>{loading ? <Loading rows={5} /> : preview === 'manifest' ? <ManifestPreview pages={previewPages} selectedBag={selectedBag} selectedManifest={selectedManifest} keyPrefix={`${selectedBagId}-voucher`} onOpenExpanded={openExpandedManifest} /> : selectedShipment ? <ExcelVoucher shipment={selectedShipment} /> : <div className="print-empty"><strong>Agrega o selecciona un baucher</strong></div>}</div></div>
          </section>}
        </div>
      )}
      <div className="print-only manifest-print-root">{manifestPrintSheets.map(({ bag, shipments: bagShipments, pageIndex }, index) => <ExcelManifest key={`${bag.id}-${pageIndex}-${index}`} shipments={bagShipments} bagNumber={bag.number} manifestDate={selectedManifest?.manifest_date} attendant={bag.attendant} batch />)}</div>
      <div className="print-only vouchers-print-root">{vouchersToPrint.map((shipment) => <ExcelVoucher shipment={shipment} batch key={shipment.id} />)}</div>
      <div className="print-only single-voucher-print-root"><ExcelVoucher shipment={selectedShipment} /></div>
    </main>

    <Modal open={formOpen || Boolean(editingShipment)} onClose={() => { setFormOpen(false); setEditingShipment(null) }} title={editingShipment ? 'Editar baucher' : 'Agregar baucher'} description={`${selectedManifest?.name || ''} · ${selectedBag?.name || ''}`} size="large"><ShipmentForm shipment={editingShipment} onSaved={onSaved} notify={notify} printMode manifestId={selectedManifestId} bagId={selectedBagId} bagNumber={selectedBag?.number} manifestDate={selectedManifest?.manifest_date} attendant={selectedBag?.attendant} /></Modal>
    <Modal open={Boolean(assignedShipment)} onClose={() => setAssignedShipment(null)} title="Baucher guardado" description="La dirección de destino se asignó automáticamente."><div className="assigned-address-card" role="status"><span aria-hidden="true"><MapPin /></span><div><small>Dirección #{assignedShipment?.address_number}</small><strong>{assignedShipment?.consignee_address}</strong><p>{assignedShipment?.phone}</p></div></div><div className="form-actions"><button className="button button--primary" type="button" onClick={() => setAssignedShipment(null)}>Entendido</button></div></Modal>
    <Modal open={Boolean(deletingShipment)} onClose={() => setDeletingShipment(null)} title="Eliminar baucher" description="Esta acción no se puede deshacer."><div className="confirm-delete"><Trash2 /><p>¿Eliminar el baucher <strong>{deletingShipment?.code}</strong> de esta maleta?</p><div><button className="button button--secondary" onClick={() => setDeletingShipment(null)}>Cancelar</button><button className="button button--danger" disabled={deleting} onClick={deleteShipment}>{deleting ? 'Eliminando…' : 'Eliminar baucher'}</button></div></div></Modal>
    <Modal open={manifestOpen} onClose={() => setManifestOpen(false)} title="Nuevo manifiesto" description="Define el nombre y la fecha del documento."><form className="shipment-form" onSubmit={createManifest}>{structureError && <div className="error-summary" role="alert">{structureError}</div>}<div className="form-grid form-grid--2"><label className="form-span"><span>Nombre del manifiesto *</span><input value={manifestForm.name} onChange={(event) => setManifestForm({ ...manifestForm, name: event.target.value })} placeholder="Ej. Envío 15 de septiembre" required autoFocus /></label><label><span>Fecha *</span><input type="date" value={manifestForm.manifest_date} onChange={(event) => setManifestForm({ ...manifestForm, manifest_date: event.target.value })} required /></label></div><div className="form-actions"><button className="button button--primary" disabled={savingStructure}><FolderPlus /> {savingStructure ? 'Creando…' : 'Crear manifiesto'}</button></div></form></Modal>
    <Modal open={bagOpen} onClose={() => { setBagOpen(false); setEditingBag(null) }} title={editingBag ? 'Editar maleta' : 'Agregar maleta'} description={`${editingBag ? 'Actualiza los datos de la maleta' : 'Nueva maleta'} dentro de ${selectedManifest?.name || 'este manifiesto'}.`}><form className="shipment-form" onSubmit={saveBag}>{structureError && <div className="error-summary" role="alert">{structureError}</div>}<div className="form-grid form-grid--2"><label><span>Número de maleta *</span><input type="number" min="1" max="999" value={bagForm.number} onChange={(event) => setBagForm({ ...bagForm, number: event.target.value })} required autoFocus /></label><label><span>Nombre opcional</span><input value={bagForm.name} onChange={(event) => setBagForm({ ...bagForm, name: event.target.value })} placeholder={`Maleta #${bagForm.number}`} /></label><label className="form-span"><span>Nombre de quien envía *</span><input value={bagForm.attendant} onChange={(event) => setBagForm({ ...bagForm, attendant: event.target.value })} placeholder="Ej. Dorian Santizo" required /></label></div><div className="form-actions"><button className="button button--primary" disabled={savingStructure}><Luggage /> {savingStructure ? 'Guardando…' : editingBag ? 'Guardar cambios' : 'Agregar maleta'}</button></div></form></Modal>
    <Modal open={manifestLargeOpen} onClose={() => setManifestLargeOpen(false)} title={selectedManifest?.name || 'Vista del manifiesto'} description="Todas las maletas y hojas del manifiesto seleccionado." size="full" className="manifest-large-modal"><div className="manifest-large-view">{expandedManifestLoading ? <Loading rows={8} /> : expandedManifestSheets.map(({ bag, shipments: pageShipments, pageIndex }) => <div className="manifest-preview-page" key={`expanded-${bag.id}-${pageIndex}`}><div className="manifest-preview-page__label">{bag.name || `Maleta #${bag.number}`} · Hoja {pageIndex + 1} de {Math.max(1, Math.ceil(bag.voucher_count / 15))}</div><ExcelManifest shipments={pageShipments} bagNumber={bag.number} manifestDate={selectedManifest?.manifest_date} attendant={bag.attendant} /></div>)}</div></Modal>
  </div>
}

function AddressesView({ notify }) {
  return <div className="screen-content"><div className="section-heading"><div><span className="section-kicker">DIRECTORIO</span><h1>Direcciones de destino</h1><p>Estas direcciones se asignan aleatoriamente y sin repetirse dentro de un manifiesto.</p></div></div><AddressesPage notify={notify} /></div>
}

function EmptyHierarchy({ type, onAction }) {
  const manifest = type === 'manifest'
  return <section className="structure-empty">{manifest ? <FolderPlus /> : <Luggage />}<h2>{manifest ? 'Crea tu primer manifiesto' : 'Este manifiesto todavía no tiene maletas'}</h2><p>{manifest ? 'Después podrás agregarle maletas y registrar los bauchers de cada una.' : 'Agrega una maleta para comenzar a registrar bauchers.'}</p><button className="button button--primary" onClick={onAction}><Plus /> {manifest ? 'Nuevo manifiesto' : 'Agregar maleta'}</button></section>
}

function ManifestPreview({ loading = false, pages, selectedBag, selectedManifest, keyPrefix, onOpenExpanded }) {
  const previewRef = useRef(null)

  useLayoutEffect(() => {
    const preview = previewRef.current
    if (!preview || loading) return undefined

    let animationFrame = 0
    const fitManifestToPreview = () => {
      const page = preview.querySelector('.manifest-preview-page')
      if (!page) return
      const styles = window.getComputedStyle(page)
      const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
      const availableWidth = Math.max(0, page.clientWidth - horizontalPadding)
      preview.style.setProperty('--manifest-preview-scale', String(Math.min(1, availableWidth / 1077)))
    }
    const scheduleFit = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(fitManifestToPreview)
    }
    const resizeObserver = new ResizeObserver(scheduleFit)
    resizeObserver.observe(preview)
    fitManifestToPreview()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
    }
  }, [loading, pages.length])

  const openWithKeyboard = (event) => {
    if (!onOpenExpanded || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onOpenExpanded()
  }

  return <div className="manifest-preview-stack" ref={previewRef}>{loading ? <Loading rows={6} /> : pages.map((pageShipments, pageIndex) => <div className={`manifest-preview-page ${onOpenExpanded ? 'manifest-preview-page--interactive' : ''}`} key={`${keyPrefix}-${pageIndex}`} onDoubleClick={onOpenExpanded} onKeyDown={openWithKeyboard} role={onOpenExpanded ? 'button' : undefined} tabIndex={onOpenExpanded ? 0 : undefined} aria-label={onOpenExpanded ? `Ampliar ${selectedBag.name || `Maleta #${selectedBag.number}`}, hoja ${pageIndex + 1} de ${pages.length}` : undefined} title={onOpenExpanded ? 'Doble clic para ver el manifiesto en grande' : undefined}><div className="manifest-preview-page__label"><span>Hoja {pageIndex + 1} de {pages.length}</span>{onOpenExpanded && <span className="manifest-preview-page__shortcut"><Expand aria-hidden="true" /> Doble clic para ampliar</span>}</div><ExcelManifest shipments={pageShipments} bagNumber={selectedBag.number} manifestDate={selectedManifest.manifest_date} attendant={selectedBag.attendant} /></div>)}</div>
}
