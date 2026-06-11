import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'

/** Showtime cho POS — chỉ cần fields đủ để bán vé tại quầy. */
export interface POSShowtime {
  id: number
  movieTitle: string
  roomId: number
  roomName: string
  startTime: string
  endTime: string
  basePrice: number
  vipPrice: number
  couplePrice: number
  sweetboxPrice?: number | null
  deluxePrice?: number | null
}

export interface POSSeat {
  id: number
  rowLabel: string
  colNumber: number
  seatNumber: string
  seatType: 'STANDARD' | 'VIP' | 'COUPLE' | 'SWEETBOX' | 'DELUXE' | 'HANDICAP'
  status: 'AVAILABLE' | 'BROKEN' | 'BLOCKED'
  aisle: boolean
}

interface POSSeatsResponse {
  seatMap: Record<string, POSSeat[]>
  occupiedIds: number[]
}

interface CounterSaleResponse {
  bookingId: number
  bookingCode: string
}

/**
 * Lấy danh sách showtime cho POS — bắt buộc filter theo theater.
 *
 * <p>POS chuẩn industry (Vista/Veezi) bind 1 theater context cụ thể — nếu
 * {@code theaterId} undefined (SUPER_ADMIN đang ở "Tất cả CN") → query bị disable,
 * page sẽ render {@code POSTheaterRequired} empty state thay vì gọi API thừa.
 */
export function usePOSShowtimes(date: string, theaterId: number | undefined) {
  return useQuery({
    queryKey: ['pos-showtimes', date, theaterId ?? 'all'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ content: POSShowtime[] }>>('/api/showtimes', {
        params: { date, size: 50, theaterId },
      })
      return res.data.data?.content ?? []
    },
    enabled: !!theaterId,
  })
}

/** Cấu hình cutoff (phút sau khi suất chiếu bắt đầu vẫn được bán) — public config. */
export function useCutoffMinutes() {
  return useQuery({
    queryKey: ['config', 'cutoff-minutes'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<string>>('/api/configs/public/booking.cutoff_after_start_minutes')
      return Number(res.data.data ?? 15)
    },
    staleTime: 5 * 60 * 1000,
  })
}

/** Sơ đồ ghế + danh sách ghế đã bị occupied cho 1 showtime. */
export function usePOSSeats(showtimeId: number | null, roomId: number | undefined) {
  return useQuery<POSSeatsResponse>({
    queryKey: ['pos-seats', showtimeId],
    enabled: !!showtimeId && !!roomId,
    queryFn: async () => {
      const occupiedRes = await api.get<ApiResponse<number[]>>(
        `/api/bookings/showtimes/${showtimeId}/occupied-seats`,
      )
      const occupiedIds: number[] = occupiedRes.data.data ?? []
      const seatRes = await api.get<ApiResponse<{ seatMap: Record<string, POSSeat[]> }>>(
        `/api/rooms/${roomId}/seats`,
      )
      const seatMap = seatRes.data.data?.seatMap ?? {}
      return { seatMap, occupiedIds }
    },
  })
}

interface CounterSalePayload {
  seatIds: number[]
  paymentMethod: string
}

/** Bán vé tại quầy — POST /api/bookings/counter-sale. */
export function useCounterSale(showtimeId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ seatIds, paymentMethod }: CounterSalePayload) => {
      const res = await api.post<ApiResponse<CounterSaleResponse>>(
        '/api/bookings/counter-sale', { showtimeId, seatIds, paymentMethod },
      )
      return res.data.data!
    },
    onSuccess: (data) => {
      toast.success(`Bán vé thành công — Mã: ${data.bookingCode}`)
      qc.invalidateQueries({ queryKey: ['pos-seats', showtimeId] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi bán vé')),
  })
}
