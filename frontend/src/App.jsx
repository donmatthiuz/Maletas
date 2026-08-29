import { useCallback, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Toast from './components/Toast'
import AddressesPage from './pages/AddressesPage'
import DashboardPage from './pages/DashboardPage'
import ManifestsPage from './pages/ManifestsPage'
import ShipmentsPage from './pages/ShipmentsPage'

export default function App() {
  const [toast, setToast] = useState(null)
  const notify = useCallback((message, tone = 'success') => {
    setToast({ id: Date.now(), message, tone })
  }, [])

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage notify={notify} />} />
          <Route path="envios" element={<ShipmentsPage notify={notify} />} />
          <Route path="manifiestos" element={<ManifestsPage notify={notify} />} />
          <Route path="directorio" element={<AddressesPage notify={notify} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  )
}

