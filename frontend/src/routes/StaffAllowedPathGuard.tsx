import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

/**
 * Whitelist path STAFF được phép truy cập trong /admin/*.
 *
 * <p>STAFF KHÔNG xem được Tổng quan (Dashboard) — chuẩn rạp thật: cashier
 * không thấy doanh thu / báo cáo / ranking. Chỉ cho POS + check-in.
 *
 * <p>Match logic — prefix match cho 3 mục:
 * '/admin/pos', '/admin/ticket-pos', '/admin/check-in'.
 */
const STAFF_ALLOWED_PREFIXES = [
  '/admin/pos',
  '/admin/ticket-pos',
  '/admin/check-in',
] as const

/** Landing mặc định khi STAFF vào /admin trần — đi thẳng vào POS Bán vé. */
const STAFF_DEFAULT_LANDING = '/admin/ticket-pos'

function isStaffAllowedPath(pathname: string): boolean {
  return STAFF_ALLOWED_PREFIXES.some(p => pathname.startsWith(p))
}

/**
 * Guard route-level cho STAFF — chặn vào URL ngoài whitelist (vd gõ trực
 * tiếp /admin/movies hoặc /admin trần). ADMIN + SUPER_ADMIN bypass.
 *
 * <p>BE đã có @PreAuthorize chặn API, guard FE này thêm UX layer: STAFF
 * không phải xem trang trắng + toast 403, mà redirect ngay vào ca làm việc.
 */
export default function StaffAllowedPathGuard() {
  const isStaff = useAuthStore(s => s.isStaff())
  const location = useLocation()

  if (isStaff && !isStaffAllowedPath(location.pathname)) {
    return <Navigate to={STAFF_DEFAULT_LANDING} replace />
  }

  return <Outlet />
}
