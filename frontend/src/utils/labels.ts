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

// === Age Rating (TT 25/2024/BVHTTDL) ===
// KHÔNG có mức C — C = "Cấm phổ biến" = phim bị cấm phát hành công khai, không
// lên rạp. Booking system chuẩn industry không quản lý phim C. Phim cũ tag C đã
// migrate sang T18 (migration 072).
export const AGE_RATING_LABELS: Record<string, string> = {
  P: 'P — Mọi đối tượng',
  K: 'K — Dưới 13 (kèm người lớn)',
  T13: 'T13 — Từ 13 tuổi',
  T16: 'T16 — Từ 16 tuổi',
  T18: 'T18 — Từ 18 tuổi',
}

/** Short label hiển thị trên badge phim. */
export const AGE_RATING_SHORT: Record<string, string> = {
  P: 'P',
  K: 'K',
  T13: 'T13',
  T16: 'T16',
  T18: 'T18',
}

/** Mô tả ngắn (1-3 từ) đi kèm mã rating — dùng cạnh badge "P · Mọi đối tượng". */
export const AGE_RATING_DESC: Record<string, string> = {
  P: 'Mọi đối tượng',
  K: 'Trẻ em kèm phụ huynh',
  T13: '13+',
  T16: '16+',
  T18: '18+',
}

/**
 * Tuổi tối thiểu (chính xác theo TT 25/2024) — dùng để confirm dialog + BE auto-block khi user có DOB.
 * K = 0 nghĩa là "không min cụ thể nhưng cần người lớn đi kèm" (FE chỉ confirm, không block).
 */
export const AGE_RATING_MIN_AGE: Record<string, number> = {
  P: 0,
  K: 0,
  T13: 13,
  T16: 16,
  T18: 18,
}

/** True nếu rating cần confirm/verify tuổi (T13, T16, T18). P/K không cần. */
export function needsAgeConfirm(rating?: string | null): boolean {
  return rating === 'T13' || rating === 'T16' || rating === 'T18'
}

// === Movie Status ===
export const MOVIE_STATUS_LABELS: Record<string, string> = {
  COMING_SOON: 'Sắp chiếu',
  NOW_SHOWING: 'Đang chiếu',
  ENDED: 'Đã kết thúc',
}

// === Movie Run Status ===
export const MOVIE_RUN_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Chưa khởi chiếu',
  NOW_SHOWING: 'Đang chiếu',
  ENDED: 'Đã kết thúc',
}

// === Movie Run Type ===
export const MOVIE_RUN_TYPE_LABELS: Record<string, string> = {
  FIRST_RUN: 'Chiếu lần đầu',
  REISSUE: 'Chiếu lại',
  FESTIVAL: 'Liên hoan',
  SPECIAL: 'Đặc biệt',
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
  NO_SHOW: 'Không đến',
  REJECTED: 'Từ chối tại cổng',
}

// === Seat Type ===
export const SEAT_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Thường',
  VIP: 'VIP',
  COUPLE: 'Đôi',
  SWEETBOX: 'Sweetbox',
  DELUXE: 'Deluxe',
  HANDICAP: 'Người khuyết tật',
}

export const SEAT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Trống',
  BROKEN: 'Đang sửa',
  BLOCKED: 'Chặn vĩnh viễn',
}

/** Width của ghế (số ô grid) — COUPLE/SWEETBOX chiếm 2 ô */
export function getSeatWidth(seatType: string): number {
  return seatType === 'COUPLE' || seatType === 'SWEETBOX' ? 2 : 1
}

// === Payment Method ===
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  VNPAY: 'VNPay',
  MOMO: 'MoMo',
  CASH: 'Tiền mặt',
  CARD_POS: 'Thẻ qua máy POS',
  TRANSFER: 'Chuyển khoản',
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
  PERCENTAGE: 'Phần trăm',
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
  ADMIN: 'QTV chi nhánh',
  SUPER_ADMIN: 'QTV tổng',
}

/** Mô tả đầy đủ — dùng cho select option / tooltip. */
export const ROLE_LABELS_FULL: Record<string, string> = {
  USER: 'Người dùng',
  ADMIN: 'Quản trị viên chi nhánh',
  SUPER_ADMIN: 'Quản trị viên tổng (HQ)',
}

/**
 * Helper: lấy label từ map, fallback về value gốc nếu không tìm thấy.
 */
export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return ''
  return map[value] ?? value
}

/**
 * Format ngày: "21/05/2026"
 */
export function fmtDate(dt: string | null | undefined): string {
  if (!dt) return ''
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
  if (!dt) return ''
  const d = new Date(dt)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm} ${fmtDate(dt)}`
}

/**
 * Format chỉ giờ phút: "23:47" — dùng cho suất chiếu hiển thị khoảng "HH:mm - HH:mm".
 */
export function fmtTime(dt: string | null | undefined): string {
  if (!dt) return ''
  const d = new Date(dt)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Format rating phim: luôn hiển thị 1 chữ số thập phân.
 * Phim chưa có rating (null/undefined/0) → hiển thị "0.0" thay vì "—".
 * VD: 7.5 → "7.5", null → "0.0", 8 → "8.0"
 */
export function fmtRating(rating?: number | null): string {
  return (Number(rating) || 0).toFixed(1)
}

/**
 * Format giá tiền VND — single source of truth.
 *
 * <p>Trước đây 14 file định nghĩa lại formatPrice/fmtPrice/formatVnd với
 * shape khác nhau (`number` vs `number | null` vs trả '—' vs '0đ'). Helper
 * này chuẩn hoá:
 * <ul>
 *   <li>null/undefined → "—" (chứ không phải "0đ" — gây nhầm là MIỄN PHÍ)</li>
 *   <li>0 → "0đ"</li>
 *   <li>Khác → toLocaleString('vi-VN') + 'đ' (ngăn cách dấu chấm)</li>
 * </ul>
 *
 * <p>Lưu ý: dùng String.fromCharCode(273) ("đ") thay vì hardcode 'đ' trong
 * source — KHÔNG cần, dấu đã đúng khi compile.
 */
export function fmtVnd(amount?: number | null): string {
  if (amount == null) return ''
  return amount.toLocaleString('vi-VN') + 'đ'
}

/**
 * Chuyển Date → "YYYY-MM-DD" theo timezone local (KHÔNG dùng toISOString).
 *
 * <p><b>Vì sao cần helper riêng?</b> JS {@code Date.toISOString()} luôn trả UTC.
 * Ở VN (+07), 1/6 00:30 sáng VN → toISOString = "2026-05-31T17:30Z" → split → "2026-05-31" SAI.
 *
 * <p>Helper này ghép tay {@code getFullYear/getMonth/getDate} → đúng theo local timezone.
 *
 * @param d Date object hoặc undefined → trả chuỗi rỗng
 */
export function toLocalDateString(d?: Date | null): string {
  if (!d) return ''
  const yyyy = d.getFullYear()
  const MM = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  return `${yyyy}-${MM}-${dd}`
}

/**
 * Chuyển ISO string (BE response) → giá trị cho {@code <input type="datetime-local">}.
 * Format: "YYYY-MM-DDTHH:mm" theo timezone local.
 *
 * <p>Cùng lý do với {@link toLocalDateString}: tránh shift múi giờ.
 */
export function toLocalDateTimeInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const HH = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${toLocalDateString(d)}T${HH}:${mm}`
}
