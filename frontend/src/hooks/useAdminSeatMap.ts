import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'

export interface SeatItem {
  id: number
  rowLabel: string
  colNumber: number
  seatNumber: string
  seatType: 'STANDARD' | 'VIP' | 'COUPLE'
  status: string
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

export function useBulkUpdateSeats(roomId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (changes: Map<number, 'STANDARD' | 'VIP' | 'COUPLE' | 'BROKEN'>) => {
      // Group by type để gọi bulk-update theo từng loại
      const grouped = new Map<string, number[]>()
      changes.forEach((type, seatId) => {
        const list = grouped.get(type) || []
        list.push(seatId)
        grouped.set(type, list)
      })
      for (const [type, seatIds] of grouped) {
        if (type === 'BROKEN') {
          // BROKEN gửi status thay vì seatType
          await api.put(`/api/rooms/${roomId}/seats/bulk-update`, { seatIds, status: 'BROKEN' })
        } else {
          await api.put(`/api/rooms/${roomId}/seats/bulk-update`, { seatIds, seatType: type })
        }
      }
    },
    onSuccess: () => {
      toast.success('Lưu sơ đồ ghế thành công')
      qc.invalidateQueries({ queryKey: ['seatmap', roomId] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi khi lưu')),
  })
}
