function displayDate(value) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return `${day}-${month}-${year}`
}

export default function ExcelVoucher({ shipment, batch = false }) {
  if (!shipment) return null

  return (
    <article className={`excel-voucher ${batch ? 'excel-voucher--batch' : ''}`}>
      <div className="excel-voucher__row excel-voucher__heading">
        <span>No.</span>
        <strong>{shipment.code}</strong>
        <strong>MALETA #</strong>
        <strong>{shipment.bag_number}</strong>
      </div>
      <div className="excel-voucher__row">
        <span>From</span><strong>{shipment.shipper_name}</strong>
      </div>
      <div className="excel-voucher__row">
        <span>Address GT</span><strong>{shipment.shipper_address}</strong>
      </div>
      <div className="excel-voucher__row">
        <span>To</span><strong>{shipment.consignee_name}</strong>
      </div>
      <div className="excel-voucher__row">
        <span>Address</span><strong>{shipment.consignee_address}</strong>
      </div>
      <div className="excel-voucher__row">
        <span>Phone</span><strong>{shipment.phone}</strong>
      </div>
      <div className="excel-voucher__row excel-voucher__content">
        <span>Content</span><strong>{shipment.contents}</strong>
      </div>
      <footer>
        <span>Atendido: <strong>{shipment.attendant}</strong></span>
        <span>DATE: <strong>{displayDate(shipment.shipment_date)}</strong></span>
      </footer>
    </article>
  )
}

