import { useState } from 'react'
import {
  BookUser,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Plane,
  X,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const links = [
  { to: '/', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/envios', label: 'Envíos', icon: Boxes },
  { to: '/manifiestos', label: 'Manifiestos', icon: ClipboardList },
  { to: '/directorio', label: 'Directorio', icon: BookUser },
]

const titles = {
  '/': ['Centro de operaciones', 'Visión general de tus maletas'],
  '/envios': ['Envíos', 'Registra y da seguimiento a cada paquete'],
  '/manifiestos': ['Manifiestos', 'Prepara documentos por número de maleta'],
  '/directorio': ['Directorio', 'Direcciones y teléfonos de destinatarios'],
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const [title, subtitle] = titles[location.pathname] || titles['/']

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`} aria-label="Navegación principal">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true"><Plane size={22} /></span>
          <div><strong>Maletas</strong><span>Nor Oriente</span></div>
          <button className="icon-button sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X /></button>
        </div>

        <nav className="nav-list">
          <span className="nav-label">Operaciones</span>
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
            >
              <Icon size={19} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="operator-avatar" aria-hidden="true">DS</div>
          <div><strong>Dorian Santizo</strong><span>Administrador</span></div>
        </div>
      </aside>
      {menuOpen && <button className="scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}

      <div className="workspace">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu /></button>
          <div className="topbar__heading"><h1>{title}</h1><p>{subtitle}</p></div>
          <div className="connection-status"><span aria-hidden="true" /> Sistema activo</div>
        </header>
        <main id="main-content" className="main-content" tabIndex="-1"><Outlet /></main>
      </div>
    </div>
  )
}
