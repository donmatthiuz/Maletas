import { Printer } from 'lucide-react'

export default function LabelPreview({ shipment }) {
  if (!shipment) return null
  const print = () => {
    document.body.classList.add('printing-label')
    window.print()
    window.setTimeout(() => document.body.classList.remove('printing-label'), 200)
  }
  return <div>
    <article className="shipping-label print-label">
      <div className="label-top"><strong>{shipment.code}</strong><span>MALETA #{shipment.bag_number}</span></div>
      <dl>
        <div><dt>De</dt><dd>{shipment.shipper_name}</dd></div>
        <div><dt>Dirección GT</dt><dd>{shipment.shipper_address}</dd></div>
        <div><dt>Para</dt><dd>{shipment.consignee_name}</dd></div>
        <div><dt>Dirección</dt><dd>{shipment.consignee_address}</dd></div>
        <div><dt>Teléfono</dt><dd>{shipment.phone}</dd></div>
        <div><dt>Contenido</dt><dd>{shipment.contents}</dd></div>
      </dl>
      <footer>Atendido por {shipment.attendant}</footer>
    </article>
    <div className="form-actions"><button className="button button--primary" onClick={print}><Printer /> Imprimir etiqueta</button></div>
  </div>
}

