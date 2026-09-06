import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowRightLeft, ArrowUp, ChevronDown, ChevronRight, Edit3, GripVertical, Trash2, X } from 'lucide-react'

const bagDropId = (bagId) => `bag:${bagId}`

function destinationOptions(shipments) {
  if (!shipments.length) return [{ value: 0, label: 'Primera posición (maleta vacía)' }]
  return Array.from({ length: shipments.length + 1 }, (_, index) => {
    if (index === 0) return { value: index, label: `Al inicio, antes de ${shipments[0].code}` }
    if (index === shipments.length) return { value: index, label: `Al final, después de ${shipments[index - 1].code}` }
    return { value: index, label: `Entre ${shipments[index - 1].code} y ${shipments[index].code}` }
  })
}

function SortableVoucher({
  shipment,
  bagId,
  index,
  total,
  selected,
  dropEdge,
  bags,
  shipmentsByBag,
  busy,
  onSelect,
  onEdit,
  onDelete,
  onMove,
  onTransfer,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: shipment.id,
    data: { type: 'voucher', bagId },
    disabled: busy,
  })
  const [transferOpen, setTransferOpen] = useState(false)
  const otherBags = bags.filter((bag) => bag.id !== bagId)
  const [targetBagId, setTargetBagId] = useState(otherBags[0]?.id || '')
  const targetShipments = shipmentsByBag[targetBagId] || []
  const [targetPosition, setTargetPosition] = useState(0)
  const style = { transform: CSS.Transform.toString(transform), transition }

  useEffect(() => {
    if (!otherBags.some((bag) => bag.id === targetBagId)) setTargetBagId(otherBags[0]?.id || '')
  }, [bagId, bags, targetBagId])
  useEffect(() => { setTargetPosition((current) => Math.min(current, targetShipments.length)) }, [targetBagId, targetShipments.length])

  const openTransfer = () => {
    const defaultBagId = otherBags[0]?.id || ''
    const nextTargetBagId = otherBags.some((bag) => bag.id === targetBagId) ? targetBagId : defaultBagId
    setTargetBagId(nextTargetBagId)
    setTargetPosition((shipmentsByBag[nextTargetBagId] || []).length)
    setTransferOpen((current) => !current)
  }
  const transfer = async () => {
    if (!targetBagId) return
    const moved = await onTransfer(shipment.id, bagId, targetBagId, Number(targetPosition))
    if (moved !== false) setTransferOpen(false)
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`voucher-sort-item ${selected ? 'voucher-sort-item--selected' : ''} ${isDragging ? 'voucher-sort-item--dragging' : ''} ${dropEdge ? `voucher-sort-item--drop-${dropEdge}` : ''}`}
    >
      <button className="drag-handle" type="button" disabled={busy} aria-label={`Arrastrar baucher ${shipment.code}`} {...attributes} {...listeners}><GripVertical /></button>
      <span className="voucher-sort-position">{String(index + 1).padStart(2, '0')}</span>
      <button className="voucher-sort-main" type="button" onClick={onSelect}><strong>{shipment.code}</strong><small>{shipment.shipper_name} → {shipment.consignee_name}</small></button>
      <div className="voucher-sort-actions" data-no-drag="true">
        <button className="icon-button icon-button--compact" type="button" disabled={busy || index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Subir ${shipment.code}`}><ArrowUp /></button>
        <button className="icon-button icon-button--compact" type="button" disabled={busy || index === total - 1} onClick={() => onMove(index, index + 1)} aria-label={`Bajar ${shipment.code}`}><ArrowDown /></button>
        <button className="icon-button icon-button--compact" type="button" disabled={busy || !otherBags.length} onClick={openTransfer} aria-expanded={transferOpen} aria-label={`Mover ${shipment.code} a otra maleta`}><ArrowRightLeft /></button>
        <button className="icon-button icon-button--compact" type="button" onClick={onEdit} aria-label={`Editar ${shipment.code}`}><Edit3 /></button>
        <button className="icon-button icon-button--compact icon-button--danger" type="button" onClick={onDelete} aria-label={`Eliminar ${shipment.code}`}><Trash2 /></button>
      </div>
      {transferOpen && <div className="voucher-transfer" data-no-drag="true">
        <div className="voucher-transfer__heading"><strong>Mover a otra maleta</strong><button type="button" className="icon-button icon-button--compact" onClick={() => setTransferOpen(false)} aria-label="Cerrar opciones para mover"><X /></button></div>
        <label><span>Maleta de destino</span><select value={targetBagId} onChange={(event) => { setTargetBagId(event.target.value); setTargetPosition((shipmentsByBag[event.target.value] || []).length) }}>{otherBags.map((bag) => <option value={bag.id} key={bag.id}>{bag.name || `Maleta #${bag.number}`}</option>)}</select></label>
        <label><span>Posición en destino</span><select value={targetPosition} onChange={(event) => setTargetPosition(Number(event.target.value))}>{destinationOptions(targetShipments).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        <button className="button button--primary" type="button" disabled={busy || !targetBagId} onClick={transfer}><ArrowRightLeft /> Mover baucher</button>
      </div>}
    </article>
  )
}

function VoucherBag({ bag, shipments, expanded, selectedBagId, children, onToggle }) {
  const { isOver, setNodeRef } = useDroppable({
    id: bagDropId(bag.id),
    data: { type: 'bag', bagId: bag.id },
    disabled: !expanded,
  })

  return <section className={`voucher-bag ${expanded ? 'voucher-bag--expanded' : ''} ${selectedBagId === bag.id ? 'voucher-bag--selected' : ''} ${isOver ? 'voucher-bag--over' : ''}`}>
    <button className="voucher-bag__toggle" type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={`vouchers-${bag.id}`}>
      {expanded ? <ChevronDown /> : <ChevronRight />}
      <span><strong>{bag.name || `Maleta #${bag.number}`}</strong><small>Envía: {bag.attendant}</small></span>
      <span className="voucher-bag__count">{shipments.length}</span>
    </button>
    {expanded && <div ref={setNodeRef} id={`vouchers-${bag.id}`} className="voucher-bag__body">
      {children}
      {!shipments.length && <div className="voucher-bag__empty"><strong>Maleta vacía</strong><span>Suelta aquí un baucher para colocarlo primero.</span></div>}
    </div>}
  </section>
}

function moveVoucher(shipmentsByBag, shipmentId, sourceBagId, targetBagId, targetIndex) {
  const next = { ...shipmentsByBag }
  const source = [...(next[sourceBagId] || [])]
  const sourceIndex = source.findIndex((item) => item.id === shipmentId)
  if (sourceIndex < 0) return null
  const [shipment] = source.splice(sourceIndex, 1)

  if (sourceBagId === targetBagId) {
    const adjustedIndex = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
    source.splice(Math.max(0, Math.min(adjustedIndex, source.length)), 0, shipment)
    next[sourceBagId] = source
  } else {
    const target = [...(next[targetBagId] || [])]
    target.splice(Math.max(0, Math.min(targetIndex, target.length)), 0, shipment)
    next[sourceBagId] = source
    next[targetBagId] = target
  }
  return next
}

export default function SortableVoucherList({
  bags,
  shipmentsByBag,
  selectedBagId,
  selectedId,
  busy = false,
  onSelect,
  onEdit,
  onDelete,
  onArrange,
}) {
  const [expandedBagIds, setExpandedBagIds] = useState(() => new Set(selectedBagId ? [selectedBagId] : []))
  const [activeVoucher, setActiveVoucher] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const allExpanded = bags.length > 0 && bags.every((bag) => expandedBagIds.has(bag.id))
  const shipmentById = useMemo(() => Object.values(shipmentsByBag).flat().reduce((result, shipment) => ({ ...result, [shipment.id]: shipment }), {}), [shipmentsByBag])

  useEffect(() => {
    if (!selectedBagId) return
    setExpandedBagIds((current) => current.has(selectedBagId) ? current : new Set([...current, selectedBagId]))
  }, [selectedBagId])

  const toggleBag = (bagId) => setExpandedBagIds((current) => {
    const next = new Set(current)
    if (next.has(bagId)) next.delete(bagId)
    else next.add(bagId)
    return next
  })
  const toggleAll = () => setExpandedBagIds(allExpanded ? new Set(selectedBagId ? [selectedBagId] : []) : new Set(bags.map((bag) => bag.id)))

  const moveInsideBag = (bagId, from, to) => {
    const next = { ...shipmentsByBag, [bagId]: arrayMove(shipmentsByBag[bagId] || [], from, to) }
    return onArrange(next, { sourceBagId: bagId, targetBagId: bagId, shipmentId: next[bagId][to]?.id })
  }
  const transfer = (shipmentId, sourceBagId, targetBagId, targetIndex) => {
    const next = moveVoucher(shipmentsByBag, shipmentId, sourceBagId, targetBagId, targetIndex)
    if (!next) return false
    setExpandedBagIds((current) => new Set([...current, sourceBagId, targetBagId]))
    return onArrange(next, { sourceBagId, targetBagId, shipmentId })
  }

  const dragStart = ({ active }) => {
    setActiveVoucher(shipmentById[active.id] || null)
    const sourceBagId = active.data.current?.bagId
    if (sourceBagId) setExpandedBagIds((current) => new Set([...current, sourceBagId]))
  }
  const dragOver = ({ active, over }) => {
    if (!over) { setDropTarget(null); return }
    const type = over.data.current?.type
    if (type === 'bag') {
      setDropTarget({ bagId: over.data.current.bagId, id: null, edge: 'end' })
      return
    }
    const translated = active.rect.current.translated
    const activeCenter = translated ? translated.top + translated.height / 2 : 0
    const overCenter = over.rect.top + over.rect.height / 2
    setDropTarget({ bagId: over.data.current?.bagId, id: over.id, edge: activeCenter > overCenter ? 'after' : 'before' })
  }
  const finishDrag = async ({ active, over }) => {
    const sourceBagId = active.data.current?.bagId
    const targetBagId = over?.data.current?.bagId
    const targetItems = shipmentsByBag[targetBagId] || []
    if (sourceBagId && targetBagId) {
      const overIndex = over.data.current?.type === 'bag' ? targetItems.length : targetItems.findIndex((item) => item.id === over.id)
      const translated = active.rect.current.translated
      const activeCenter = translated ? translated.top + translated.height / 2 : 0
      const overCenter = over.rect.top + over.rect.height / 2
      const dropAfter = over.data.current?.type !== 'bag' && activeCenter > overCenter
      const targetIndex = Math.max(0, overIndex + (dropAfter ? 1 : 0))
      const sourceIndex = (shipmentsByBag[sourceBagId] || []).findIndex((item) => item.id === active.id)
      const noChange = sourceBagId === targetBagId && (targetIndex === sourceIndex || targetIndex === sourceIndex + 1)
      if (!noChange) await transfer(active.id, sourceBagId, targetBagId, targetIndex)
    }
    setActiveVoucher(null)
    setDropTarget(null)
  }
  const cancelDrag = () => { setActiveVoucher(null); setDropTarget(null) }

  return <div className="voucher-organizer">
    <div className="voucher-organizer__help"><p>Despliega las maletas que quieras comparar y arrastra un baucher a la posición exacta.</p><button className="button button--soft" type="button" onClick={toggleAll}>{allExpanded ? 'Contraer maletas' : 'Desplegar todas'}</button></div>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={dragStart}
      onDragOver={dragOver}
      onDragEnd={finishDrag}
      onDragCancel={cancelDrag}
      accessibility={{
        screenReaderInstructions: { draggable: 'Presiona espacio para tomar el baucher, usa las flechas para moverlo y vuelve a presionar espacio para soltarlo.' },
        announcements: {
          onDragStart: ({ active }) => `Baucher ${shipmentById[active.id]?.code || ''} tomado.`,
          onDragOver: ({ over }) => over ? 'Baucher sobre una nueva posición.' : 'Baucher fuera de una zona válida.',
          onDragEnd: () => 'Baucher soltado. Guardando el nuevo orden.',
          onDragCancel: () => 'Movimiento cancelado.',
        },
      }}
    >
      <div className="voucher-bag-list" aria-label="Maletas y orden de sus bauchers">
        {bags.map((bag) => {
          const bagShipments = shipmentsByBag[bag.id] || []
          const expanded = expandedBagIds.has(bag.id)
          return <VoucherBag key={bag.id} bag={bag} shipments={bagShipments} expanded={expanded} selectedBagId={selectedBagId} onToggle={() => toggleBag(bag.id)}>
            <SortableContext items={bagShipments.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <div className="voucher-sort-list" aria-label={`Orden de bauchers de ${bag.name || `Maleta #${bag.number}`}`}>
                {bagShipments.map((shipment, index) => <SortableVoucher
                  key={shipment.id}
                  shipment={shipment}
                  bagId={bag.id}
                  index={index}
                  total={bagShipments.length}
                  selected={selectedId === shipment.id}
                  dropEdge={dropTarget?.id === shipment.id ? dropTarget.edge : null}
                  bags={bags}
                  shipmentsByBag={shipmentsByBag}
                  busy={busy}
                  onSelect={() => onSelect(shipment, bag.id)}
                  onEdit={() => onEdit(shipment, bag.id)}
                  onDelete={() => onDelete(shipment, bag.id)}
                  onMove={(from, to) => moveInsideBag(bag.id, from, to)}
                  onTransfer={transfer}
                />)}
              </div>
            </SortableContext>
          </VoucherBag>
        })}
      </div>
      <DragOverlay>{activeVoucher ? <div className="voucher-drag-overlay"><GripVertical /><strong>{activeVoucher.code}</strong><span>{activeVoucher.shipper_name}</span></div> : null}</DragOverlay>
    </DndContext>
  </div>
}
