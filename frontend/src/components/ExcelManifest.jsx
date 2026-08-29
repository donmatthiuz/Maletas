function displayDate(value) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return `${day}-${month}-${year}`
}

export const MANIFEST_ROWS_PER_PAGE = 15

export function paginateManifest(shipments) {
  if (!shipments.length) return [[]]
  const pages = []
  for (let index = 0; index < shipments.length; index += MANIFEST_ROWS_PER_PAGE) {
    pages.push(shipments.slice(index, index + MANIFEST_ROWS_PER_PAGE))
  }
  return pages
}

export default function ExcelManifest({
  shipments,
  bagNumber,
  manifestDate: providedDate,
  attendant: providedAttendant,
  batch = false,
}) {
  const attendant = providedAttendant || shipments[0]?.attendant || 'DORIAN SANTIZO'
  const manifestDate = providedDate || shipments[0]?.shipment_date

  return (
    <article className={`excel-manifest ${batch ? 'excel-manifest--batch' : ''}`}>
      <header className="excel-manifest__attendant">{attendant}</header>
      <div className="excel-manifest__meta">
        <strong>No</strong>
        <strong>DATE: {displayDate(manifestDate)}</strong>
        <strong>BAG #{bagNumber}</strong>
      </div>
      <div className="excel-manifest__rows">
        {shipments.map((shipment) => (
          <div className="excel-manifest__row" key={shipment.id}>
            <span>{shipment.code}</span>
            <span>{shipment.shipper_name}</span>
            <span>{shipment.shipper_address}</span>
            <span>{shipment.consignee_name}</span>
            <span>{shipment.consignee_address}</span>
            <span>{shipment.contents}</span>
            <span>{shipment.customs_type}</span>
            <span>{shipment.quantity}</span>
          </div>
        ))}
        {Array.from({ length: Math.max(0, MANIFEST_ROWS_PER_PAGE - shipments.length) }, (_, index) => (
          <div className="excel-manifest__row excel-manifest__row--empty" key={`empty-${index}`} aria-hidden="true" />
        ))}
      </div>
    </article>
  )
}
