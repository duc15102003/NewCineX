/**
 * Logic ghép cặp ghế đôi (COUPLE/SWEETBOX) — tách ra utility để SeatMapEditorPage
 * gọn, dễ test, không lẫn UI state.
 *
 * <b>Quy tắc industry (CGV/Lotte/BHD):</b>
 * - Ghế đôi luôn ghép col lẻ ↔ col chẵn kề bên: A1↔A2, A3↔A4, A5↔A6, ...
 * - Cặp KHÔNG được vắt qua lối đi (AISLE), ghế hỏng (BROKEN), ghế chặn (BLOCKED).
 *   Vì 2 người ngồi sẽ bị luồng đi lại chia đôi, hoặc không thể sử dụng.
 * - Phía nào hết cột (ghế lẻ cuối hàng) → không thể ghép → fallback STANDARD.
 */

import type { SeatItem } from '@/hooks/useAdmin'
import type { SeatTypeKey } from '@/types/seatEditor'

export const DOUBLE_TYPES: SeatTypeKey[] = ['COUPLE', 'SWEETBOX']

export function isDouble(t: SeatTypeKey): boolean {
  return DOUBLE_TYPES.includes(t)
}

/** Tìm ghế partner cho COUPLE/SWEETBOX — col lẻ ↔ col chẵn kề bên. */
export function getDoublePartner(seat: SeatItem, seats: SeatItem[]): SeatItem | null {
  const isOdd = seat.colNumber % 2 === 1
  const partnerCol = isOdd ? seat.colNumber + 1 : seat.colNumber - 1
  return seats.find(s => s.colNumber === partnerCol) ?? null
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

  for (const [seatId, pendingType] of pending) {
    if (!isDouble(pendingType)) continue
    const seat = byId.get(seatId)
    if (!seat) continue

    const partnerCol = seat.colNumber % 2 === 1 ? seat.colNumber + 1 : seat.colNumber - 1
    const partner = allSeats.find(s => s.rowLabel === seat.rowLabel && s.colNumber === partnerCol)

    if (!partner) {
      return `Ghế ${seat.seatNumber} không có ghế cặp ở cột ${partnerCol}.`
    }
    const partnerPending = pending.get(partner.id)
    if (partnerPending === pendingType) continue
    if (partnerPending) {
      return `Ghế ${seat.seatNumber} (${pendingType}) không khớp với cặp ${partner.seatNumber} (${partnerPending}).`
    }
    if (partner.seatType !== pendingType || partner.aisle) {
      return `Ghế ${seat.seatNumber} không có cặp hợp lệ — ${partner.seatNumber} hiện là ${partner.aisle ? 'lối đi' : partner.seatType}.`
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
