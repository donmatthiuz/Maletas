import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import { ArrowDown, ArrowUp, Edit3, GripVertical, Trash2 } from 'lucide-react'

function SortableVoucher({ shipment, index, total, selected, onSelect, onEdit, onDelete, onMove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shipment.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <article ref={setNodeRef} style={style} className={`voucher-sort-item ${selected ? 'voucher-sort-item--selected' : ''} ${isDragging ? 'voucher-sort-item--dragging' : ''}`}>
      <button className="drag-handle" type="button" aria-label={`Arrastrar baucher ${shipment.code}`} {...attributes} {...listeners}><GripVertical /></button>
      <span className="voucher-sort-position">{String(index + 1).padStart(2, '0')}</span>
      <button className="voucher-sort-main" type="button" onClick={onSelect}><strong>{shipment.code}</strong><small>{shipment.shipper_name} → {shipment.consignee_name}</small></button>
      <div className="voucher-sort-actions" data-no-drag="true">
        <button className="icon-button icon-button--compact" type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Subir ${shipment.code}`}><ArrowUp /></button>
        <button className="icon-button icon-button--compact" type="button" disabled={index === total - 1} onClick={() => onMove(index, index + 1)} aria-label={`Bajar ${shipment.code}`}><ArrowDown /></button>
        <button className="icon-button icon-button--compact" type="button" onClick={onEdit} aria-label={`Editar ${shipment.code}`}><Edit3 /></button>
        <button className="icon-button icon-button--compact icon-button--danger" type="button" onClick={onDelete} aria-label={`Eliminar ${shipment.code}`}><Trash2 /></button>
      </div>
    </article>
  )
}

export default function SortableVoucherList({ shipments, selectedId, onSelect, onEdit, onDelete, onReorder }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const move = (from, to) => onReorder(arrayMove(shipments, from, to))
  const dragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const from = shipments.findIndex((item) => item.id === active.id)
    const to = shipments.findIndex((item) => item.id === over.id)
    if (from >= 0 && to >= 0) move(from, to)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
      <SortableContext items={shipments.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="voucher-sort-list" aria-label="Orden de impresión de bauchers">
          {shipments.map((shipment, index) => (
            <SortableVoucher
              key={shipment.id}
              shipment={shipment}
              index={index}
              total={shipments.length}
              selected={selectedId === shipment.id}
              onSelect={() => onSelect(shipment)}
              onEdit={() => onEdit(shipment)}
              onDelete={() => onDelete(shipment)}
              onMove={move}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
