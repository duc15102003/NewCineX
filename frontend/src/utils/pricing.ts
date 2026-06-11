/**
 * Pricing utility — single source of truth cho công thức tính giá ghế ở FE.
 *
 * <p>Mirror BE {@code BookingService.getPriceForSeat} (Java). Khi BE đổi
 * fallback formula (SWEETBOX/DELUXE), update đồng thời ở đây.
 *
 * <p><b>Quy tắc effective price (chuẩn industry "What You See Is What You Pay"):</b>
 * - Nếu BE trả về {@code effectiveXxxPrice} (đã apply pricing rules) → dùng nó.
 * - Fallback về raw {@code xxxPrice} từ DB nếu BE chưa expose effective.
 * - Fallback cuối cùng: derive theo công thức (SWEETBOX = couple × 2, DELUXE = vip × 1.5)
 *   để hỗ trợ showtime cũ chưa có giá tier cao cấp.
 */

export interface ShowtimePrices {
  basePrice: number
  vipPrice?: number | null
  couplePrice?: number | null
  sweetboxPrice?: number | null
  deluxePrice?: number | null
  effectiveBasePrice?: number | null
  effectiveVipPrice?: number | null
  effectiveCouplePrice?: number | null
  effectiveSweetboxPrice?: number | null
  effectiveDeluxePrice?: number | null
}

const SWEETBOX_FALLBACK_MULTIPLIER = 2
const DELUXE_FALLBACK_MULTIPLIER = 1.5

/**
 * Trả về giá thực sự thu cho 1 ghế thuộc loại {@code seatType}.
 * HANDICAP dùng giá thường (NĐ 28/2012 — không thu phụ phí ghế khuyết tật).
 */
export function getSeatPrice(seatType: string, showtime: ShowtimePrices): number {
  const effBase = showtime.effectiveBasePrice ?? showtime.basePrice
  const effVip = showtime.effectiveVipPrice ?? showtime.vipPrice ?? effBase
  const effCouple = showtime.effectiveCouplePrice ?? showtime.couplePrice ?? effBase
  switch (seatType) {
    case 'VIP':      return effVip
    case 'COUPLE':   return effCouple
    case 'SWEETBOX': return showtime.effectiveSweetboxPrice ?? showtime.sweetboxPrice ?? effCouple * SWEETBOX_FALLBACK_MULTIPLIER
    case 'DELUXE':   return showtime.effectiveDeluxePrice ?? showtime.deluxePrice ?? Math.round(effVip * DELUXE_FALLBACK_MULTIPLIER)
    case 'HANDICAP': return effBase
    default:         return effBase
  }
}
