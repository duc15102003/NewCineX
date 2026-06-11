/**
 * SeatEditor tool palette — bao gồm 6 SeatType chuẩn industry + 2 trạng thái
 * đặc biệt (BROKEN/BLOCKED) + AISLE marker.
 *
 * AISLE không phải seat type thực — là toggle "vị trí này là lối đi".
 * Admin click ô + chọn AISLE → đánh dấu isAisle=true (BE serialize riêng).
 */
export type SeatTypeKey =
  | 'STANDARD'
  | 'VIP'
  | 'COUPLE'
  | 'SWEETBOX'
  | 'DELUXE'
  | 'HANDICAP'
  | 'BROKEN'
  | 'BLOCKED'
  | 'AISLE'

export interface SeatTypeMeta {
  key: SeatTypeKey
  label: string
  bgClass: string
  /** Số ô grid ngang ghế chiếm (COUPLE/SWEETBOX = 2). */
  width?: 1 | 2
  /** Hint cho admin khi hover tool. */
  hint?: string
}

/**
 * Bảng màu chuẩn industry rạp VN (CGV/Lotte/BHD):
 * - STANDARD = GREEN (không xám — xám dành cho "đã bán")
 * - VIP = GOLD (#ffc107)
 * - COUPLE = PINK
 * - SWEETBOX = PURPLE (luxury)
 * - DELUXE = BLUE (recliner)
 * - HANDICAP = TEAL/CYAN distinguish với STANDARD green
 * - AISLE = transparent dashed (lối đi)
 * - BROKEN = ORANGE (sửa được)
 * - BLOCKED = DARK RED (vĩnh viễn)
 */
export const SEAT_TYPES: SeatTypeMeta[] = [
  { key: 'STANDARD', label: 'Thường',     bgClass: 'bg-green-600',         width: 1, hint: 'Ghế thường — màu xanh chuẩn rạp VN' },
  { key: 'VIP',      label: 'VIP',        bgClass: 'bg-[#ffc107]',         width: 1, hint: 'Giữa rạp — sweet spot' },
  { key: 'COUPLE',   label: 'Đôi',        bgClass: 'bg-pink-500',          width: 2, hint: 'Ghế đôi 2 ô' },
  { key: 'SWEETBOX', label: 'Sweetbox',   bgClass: 'bg-purple-500',        width: 2, hint: 'Đôi cao cấp + bàn nhỏ' },
  { key: 'DELUXE',   label: 'Deluxe',     bgClass: 'bg-blue-500',          width: 1, hint: 'Ghế ngả lưng recliner' },
  { key: 'HANDICAP', label: 'Khuyết tật', bgClass: 'bg-cyan-600',          width: 1, hint: 'NĐ 28/2012 bắt buộc — đầu hàng' },
  { key: 'AISLE',    label: 'Lối đi',     bgClass: 'bg-transparent border-2 border-dashed border-gray-500', width: 1, hint: 'Không phải ghế — render trống' },
  { key: 'BROKEN',   label: 'Bảo trì',    bgClass: 'bg-orange-500',        width: 1, hint: 'Hỏng tạm thời — sửa được' },
  { key: 'BLOCKED',  label: 'Chặn',       bgClass: 'bg-red-900',           width: 1, hint: 'Cột bê tông / thoát hiểm — vĩnh viễn' },
]

/** Background class với hover state cho sơ đồ editor. */
export const SEAT_BG: Record<SeatTypeKey, string> = {
  STANDARD: 'bg-green-600/80 hover:bg-green-500',
  VIP:      'bg-[#ffc107]/80 hover:bg-[#ffc107]',
  COUPLE:   'bg-pink-500/80 hover:bg-pink-400',
  SWEETBOX: 'bg-purple-500/80 hover:bg-purple-400',
  DELUXE:   'bg-blue-500/80 hover:bg-blue-400',
  HANDICAP: 'bg-cyan-600/80 hover:bg-cyan-500',
  AISLE:    'bg-transparent border border-dashed border-gray-500 hover:border-gray-400',
  BROKEN:   'bg-orange-500/80 hover:bg-orange-400',
  BLOCKED:  'bg-red-900/80 hover:bg-red-800',
}
