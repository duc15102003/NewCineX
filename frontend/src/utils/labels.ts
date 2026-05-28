/**
 * Mapping enum BE (tiếng Anh) → label hiển thị FE (tiếng Việt).
 * Value gửi về BE vẫn là tiếng Anh (TWO_D, NOW_SHOWING, ...).
 * Chỉ hiển thị tiếng Việt cho user.
 */

// === Room Type ===
export const ROOM_TYPE_LABELS: Record<string, string> = {
  TWO_D: '2D',
  THREE_D: '3D',
  IMAX: 'IMAX',
  FOUR_DX: '4DX',
}

// === Room Status ===
export const ROOM_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  MAINTENANCE: 'Bảo trì',
  INACTIVE: 'Ngừng hoạt động',
}

// === Movie Status ===
export const MOVIE_STATUS_LABELS: Record<string, string> = {
  COMING_SOON: 'Sắp chiếu',
  NOW_SHOWING: 'Đang chiếu',
  ENDED: 'Đã kết thúc',
}

// === Showtime Status ===
export const SHOWTIME_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Đã lên lịch',
  ONGOING: 'Đang chiếu',
  FINISHED: 'Đã chiếu xong',
  CANCELLED: 'Đã hủy',
}

// === Booking Status ===
export const BOOKING_STATUS_LABELS: Record<string, string> = {
  HOLDING: 'Đang giữ ghế',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đã check-in',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
}

// === Seat Type ===
export const SEAT_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Thường',
  VIP: 'VIP',
  COUPLE: 'Đôi',
}

// === Payment Method ===
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  VNPAY: 'VNPay',
  MOMO: 'MoMo',
  CASH: 'Tiền mặt',
}

// === Payment Status ===
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ thanh toán',
  COMPLETED: 'Đã thanh toán',
  FAILED: 'Thất bại',
  REFUNDED: 'Đã hoàn tiền',
}

// === Discount Type ===
export const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  PERCENTAGE: 'Phần trăm (%)',
  FIXED_AMOUNT: 'Số tiền cố định',
}

// === Storage State ===
export const STORAGE_STATE_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  ARCHIVED: 'Lưu trữ',
}

// === User Role ===
export const ROLE_LABELS: Record<string, string> = {
  USER: 'Người dùng',
  ADMIN: 'Quản trị viên',
}

/**
 * Helper: lấy label từ map, fallback về value gốc nếu không tìm thấy.
 */
export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '—'
  return map[value] ?? value
}

/**
 * Format ngày: "21/05/2026"
 */
export function fmtDate(dt: string | null | undefined): string {
  if (!dt) return '—'
  const d = new Date(dt)
  const dd = d.getDate().toString().padStart(2, '0')
  const MM = (d.getMonth() + 1).toString().padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${MM}/${yyyy}`
}

/**
 * Format ngày + giờ: "23:47 21/05/2026"
 */
export function fmtDateTime(dt: string | null | undefined): string {
  if (!dt) return '—'
  const d = new Date(dt)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm} ${fmtDate(dt)}`
}
