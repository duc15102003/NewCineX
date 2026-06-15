import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

/**
 * Guard cho admin panel — chỉ STAFF/ADMIN/SUPER_ADMIN. STAFF được vào nhưng
 * menu sẽ filter tự động chỉ hiện các trang staffAllowed (POS + Check-in).
 */
export default function AdminRoute() {
  const { isLoggedIn, canEnterAdminPanel } = useAuthStore()

  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />
  }

  if (!canEnterAdminPanel()) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
