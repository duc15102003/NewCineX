/**
 * Logic ghép cặp ghế đôi (COUPLE/SWEETBOX) — tách ra utility để SeatMapEditorPage
 * gọn, dễ test, không lẫn UI state.
 *
 * <b>Quy tắc industry (CGV/Lotte/BHD/Vista Veezi/Cinetixx):</b>
 * - Default canonical: col lẻ ↔ col chẵn kề bên (A1↔A2, A3↔A4, A5↔A6, ...)
 * - <b>Fallback hướng ngược lại</b>: nếu canonical partner không tồn tại
 *   hoặc là lối đi → thử direction còn lại. Ví dụ phòng 13 cột: click A13
 *   (lẻ, không có A14) → ghép với A12. Phù hợp với cách Vista Veezi cho
 *   admin pick bất kỳ 2 ghế adjacent.
 * - Cặp KHÔNG được vắt qua lối đi (AISLE), ghế hỏng (BROKEN), ghế chặn
 *   (BLOCKED). 2 người ngồi sẽ bị luồng đi lại chia đôi, hoặc không thể
 *   sử dụng.
 * - Cả 2 direction đều fail → ghế thật sự đứng lẻ → fallback STANDARD.
 */

import type { SeatItem } from '@/hooks/useAdmin'
import type { SeatTypeKey } from '@/types/seatEditor'

export const DOUBLE_TYPES: SeatTypeKey[] = ['COUPLE', 'SWEETBOX']

export function isDouble(t: SeatTypeKey): boolean {
  return DOUBLE_TYPES.includes(t)
}

/**
 * Tìm ghế partner cho COUPLE/SWEETBOX — canonical odd-left, fallback ngược.
 *
 * <p>Canonical: col lẻ → partner = col+1 (phải); col chẵn → partner = col-1
 * (trái). Default cho mọi rạp cột chẵn.
 *
 * <p>Fallback: nếu canonical partner không tồn tại (cuối hàng cột lẻ) hoặc
 * là lối đi → thử direction ngược lại. Cho phép ghép 12-13 ở phòng 13 cột.
 */
export function getDoublePartner(seat: SeatItem, seats: SeatItem[]): SeatItem | null {
  const isOdd = seat.colNumber % 2 === 1
  const canonicalCol = isOdd ? seat.colNumber + 1 : seat.colNumber - 1
  const fallbackCol = isOdd ? seat.colNumber - 1 : seat.colNumber + 1

  const canonical = seats.find(s => s.colNumber === canonicalCol)
  if (canonical && !canonical.aisle) return canonical

  const fallback = seats.find(s => s.colNumber === fallbackCol)
  if (fallback && !fallback.aisle) return fallback

  return null
}

/**
 * Tìm ghế đang được paired ACTUALLY (cùng type COUPLE/SWEETBOX adjacent).
 *
 * <p>Khác {@link getDoublePartner}: getDoublePartner trả CANDIDATE để pair
 * (bất kỳ neighbor không phải aisle), còn cái này trả MATE THỰC SỰ — đã
 * cùng type và đang tạo thành cặp. Dùng cho:
 * <ul>
 *   <li>Cascade unpair: pair X-Y → unpair Y's previous mate Z</li>
 *   <li>Unpair flow: click X với STANDARD → tìm đúng mate hiện tại để cũng
 *       set STANDARD (không dùng canonical vì cặp có thể được pair fallback
 *       direction)</li>
 * </ul>
 *
 * @param getDisplay function trả về effective type (đã apply pendingChanges)
 */
export function findCurrentCouplePartner(
  seat: SeatItem,
  rowSeats: SeatItem[],
  getDisplay: (s: SeatItem) => SeatTypeKey,
): SeatItem | null {
  const myType = getDisplay(seat)
  if (!isDouble(myType)) return null
  const left = rowSeats.find(s => s.colNumber === seat.colNumber - 1)
  const right = rowSeats.find(s => s.colNumber === seat.colNumber + 1)
  if (left && getDisplay(left) === myType) return left
  if (right && getDisplay(right) === myType) return right
  return null
}

/**
 * Lý do tại sao ô không thể là 1 nửa của ghế đôi/sweetbox.
 * null = OK để pair. String = mô tả ngắn để hiển thị toast.
 * Ưu tiên pending change (FE chưa lưu) > flag DB.
 */
export function getBlockingState(seat: SeatItem, pending: Map<number, SeatTypeKey>): string | null {
  const pendingType = pending.get(seat.id)
  if (pendingType === 'AISLE') return 'lối đi'
  if (pendingType === 'BROKEN') return 'ghế hỏng'
  if (pendingType === 'BLOCKED') return 'ghế bị chặn'
  if (pendingType) return null // pending sang loại khác → OK
  if (seat.aisle) return 'lối đi'
  if (seat.status === 'BROKEN') return 'ghế hỏng'
  if (seat.status === 'BLOCKED') return 'ghế bị chặn'
  return null
}

/**
 * Quét pendingChanges tìm orphan COUPLE/SWEETBOX (1 nửa pending COUPLE
 * nhưng partner không pending cùng type hoặc partner ở loại khác trong DB).
 * Trả message lỗi cho toast hoặc null nếu hợp lệ.
 */
export function findOrphanCouple(
  pending: Map<number, SeatTypeKey>,
  allSeats: SeatItem[],
): string | null {
  const byId = new Map(allSeats.map(s => [s.id, s]))

  /** Trả về effective type sau khi áp pending. */
  const effectiveType = (s: SeatItem): SeatTypeKey | 'AISLE' => {
    const p = pending.get(s.id)
    if (p) return p
    if (s.aisle) return 'AISLE'
    return s.seatType
  }

  for (const [seatId, pendingType] of pending) {
    if (!isDouble(pendingType)) continue
    const seat = byId.get(seatId)
    if (!seat) continue

    // Tìm partner ở cả 2 direction (cùng pattern getDoublePartner: canonical
    // odd-left, fallback ngược). Pair hợp lệ nếu CÓ ÍT NHẤT 1 neighbor cùng
    // type ở 1 trong 2 hướng.
    const rowSeats = allSeats.filter(s => s.rowLabel === seat.rowLabel)
    const left = rowSeats.find(s => s.colNumber === seat.colNumber - 1)
    const right = rowSeats.find(s => s.colNumber === seat.colNumber + 1)

    const matchesType = (neighbor: SeatItem | undefined): boolean => {
      if (!neighbor) return false
      if (neighbor.aisle) return false
      return effectiveType(neighbor) === pendingType
    }

    if (!matchesType(left) && !matchesType(right)) {
      const reason = !left && !right
        ? 'không có ghế kề bên'
        : `cả ${left ? left.seatNumber : 'trái'} và ${right ? right.seatNumber : 'phải'} không cùng loại`
      return `Ghế ${seat.seatNumber} (${pendingType}) không có cặp hợp lệ — ${reason}.`
    }
  }
  return null
}

/**
 * Quét các row mà sau khi áp pendingChanges sẽ 0% bookable (toàn aisle/broken/blocked).
 * Trả list row label hoặc empty nếu OK.
 */
export function findEmptyRows(
  pending: Map<number, SeatTypeKey>,
  rows: [string, SeatItem[]][],
): string[] {
  const empty: string[] = []
  for (const [rowLabel, seats] of rows) {
    const hasBookable = seats.some(s => {
      const pendingType = pending.get(s.id)
      const effectiveType = pendingType ?? (s.aisle ? 'AISLE' : s.status === 'BROKEN' ? 'BROKEN' : s.status === 'BLOCKED' ? 'BLOCKED' : s.seatType)
      return !['AISLE', 'BROKEN', 'BLOCKED'].includes(effectiveType)
    })
    if (!hasBookable) empty.push(rowLabel)
  }
  return empty
}

/**
 * Check seat (hoặc partner của nó nếu activeTool là COUPLE/SWEETBOX) có bị chặn
 * để pair với activeTool không. Trả true nếu seat đó hiện không thể nhận tool.
 *
 * Dùng cho visual hint: dim ô trong grid khi activeTool là double mà ô không thể pair.
 */
export function isSeatBlockedForTool(
  seat: SeatItem,
  rowSeats: SeatItem[],
  activeTool: SeatTypeKey,
  pending: Map<number, SeatTypeKey>,
): boolean {
  if (!isDouble(activeTool)) return false
  if (getBlockingState(seat, pending)) return true
  const partner = getDoublePartner(seat, rowSeats)
  if (!partner) return true
  if (getBlockingState(partner, pending)) return true
  return false
}
