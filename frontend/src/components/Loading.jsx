export default function Loading({ rows = 4 }) {
  return <div className="skeleton-list" aria-label="Cargando datos" aria-busy="true">
    {Array.from({ length: rows }).map((_, index) => <div className="skeleton" key={index} />)}
  </div>
}

