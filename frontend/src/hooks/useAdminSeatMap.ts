import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { SeatTypeKey } from '@/types/seatEditor'

export interface SeatItem {
  id: number
  rowLabel: string
  colNumber: number
  seatNumber: string
  seatType: 'STANDARD' | 'VIP' | 'COUPLE' | 'SWEETBOX' | 'DELUXE' | 'HANDICAP'
  status: 'AVAILABLE' | 'BROKEN' | 'BLOCKED'
  aisle: boolean
}

export interface SeatMapData {
  roomId: number
  roomName: string
  totalSeats: number
  seatMap: Record<string, SeatItem[]>
}

export function useSeatMap(roomId: number) {
  return useQuery({
    queryKey: ['seatmap', roomId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<SeatMapData>>(`/api/rooms/${roomId}/seats`)
      return res.data.data
    },
    enabled: !!roomId,
  })
}

/**
 * Bulk update: nhận map seatId → SeatTypeKey (bao gồm STANDARD/VIP/COUPLE/
 * SWEETBOX/DELUXE/HANDICAP + BROKEN/BLOCKED + AISLE).
 *
 * Backend split call theo dimension:
 * - BROKEN/BLOCKED → set status
 * - AISLE → set isAisle=true (cần API support)
 * - 6 type còn lại → set seatType
 */
export function useBulkUpdateSeats(roomId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (changes: Map<number, SeatTypeKey>) => {
      const grouped = new Map<SeatTypeKey, number[]>()
      changes.forEach((type, seatId) => {
        const list = grouped.get(type) || []
        list.push(seatId)
        grouped.set(type, list)
      })
      for (const [type, seatIds] of grouped) {
        // CHÚ Ý: getDisplayType ưu tiên aisle > BLOCKED > BROKEN > seatType.
        // Nên mọi transition đến trạng thái KHÔNG phải AISLE đều phải gửi
        // aisle=false để clear flag — nếu không, BROKEN/BLOCKED paint lên
        // ghế AISLE cũ sẽ vô hình ở DB (aisle vẫn true).
        // Tương tự transition đến AISLE phải reset status=AVAILABLE (lối
        // đi không thể "hỏng" hay "chặn").
        if (type === 'BROKEN' || type === 'BLOCKED') {
          await api.put(`/api/rooms/${roomId}/seats/bulk-update`, { seatIds, status: type, aisle: false })
        } else if (type === 'AISLE') {
          await api.put(`/api/rooms/${roomId}/seats/bulk-update`, { seatIds, aisle: true, status: 'AVAILABLE' })
        } else {
          // STANDARD / VIP / COUPLE / SWEETBOX / DELUXE / HANDICAP
          await api.put(`/api/rooms/${roomId}/seats/bulk-update`, { seatIds, seatType: type, aisle: false })
        }
      }
    },
    onSuccess: () => {
      toast.success('Lưu sơ đồ ghế thành công')
      qc.invalidateQueries({ queryKey: ['seatmap', roomId] })
      // Form Showtime dùng useRoomSeatTypes — phải invalidate, tránh form
      // hiển thị input giá cho danh sách loại ghế cũ.
      qc.invalidateQueries({ queryKey: ['admin', 'room-seat-types', roomId] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi khi lưu')),
  })
}

export interface ResizeSeatGridRequest {
  rows: number
  cols: number
}

/**
 * Resize lưới ghế — preserve seats hiện có (id stable), chỉ thêm/bớt biên.
 * BE block nếu phòng có booking active (HOLDING/CONFIRMED).
 */
export function useResizeSeatGrid(roomId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: ResizeSeatGridRequest) => {
      const res = await api.put<ApiResponse<SeatMapData>>(
        `/api/rooms/${roomId}/seats/dimensions`, req)
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Đã đổi kích thước sơ đồ ghế')
      qc.invalidateQueries({ queryKey: ['seatmap', roomId] })
      qc.invalidateQueries({ queryKey: ['admin', 'room-seat-types', roomId] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Đổi kích thước thất bại')),
  })
}
