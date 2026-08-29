import { useCallback, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Toast from './components/Toast'
import PrintCenterPage from './pages/PrintCenterPage'

export default function App() {
  const [toast, setToast] = useState(null)
  const notify = useCallback((message, tone = 'success') => {
    setToast({ id: Date.now(), message, tone })
  }, [])

  return (
    <>
      <Routes>
        <Route index element={<PrintCenterPage notify={notify} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  )
}
