import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export interface AdminBooking {
  id: number
  bookingCode: string
  username: string
  movieTitle: string
  /** Phân loại độ tuổi — chỉ có khi BE trả BookingResponse (preview/checkin). Null cho list view. */
  movieAgeRating?: string | null
  startTime: string
  roomName: string
  seatCount: number
  totalAmount: number
  status: string
  createdAt: string
  /** Chi nhánh — BE expose qua join showtime → room → theater. Dùng cho grouped view. */
  theaterId: number | null
  theaterName: string | null
  theaterCity: string | null
}

/**
 * Filter cho admin booking — khớp với BookingFilter ở BE.
 * Mọi field optional. Hook tự build URLSearchParams + bỏ field rỗng.
 */
export interface AdminBookingFilter {
  keyword?: string
  status?: string
  userId?: number | string
  movieId?: number | string
  showtimeId?: number | string
  roomId?: number | string
  theaterId?: number | string
  paymentMethod?: string
  createdFrom?: string
  createdTo?: string
  confirmedFrom?: string
  confirmedTo?: string
  minAmount?: number | string
  maxAmount?: number | string
  page?: number
  size?: number
}

/**
 * Helper: build params, bỏ field rỗng/undefined/0-string.
 * BE Spring sẽ parse @DateTimeFormat ISO_DATE_TIME, nên cần truyền yyyy-MM-ddTHH:mm:ss.
 * Input HTML <input type="datetime-local"> trả "yyyy-MM-ddTHH:mm" → append ":00" cho đủ.
 */
function buildBookingParams(filter: AdminBookingFilter): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(filter)) {
    if (v === undefined || v === null || v === '') continue
    if ((k === 'createdFrom' || k === 'createdTo' || k === 'confirmedFrom' || k === 'confirmedTo')
        && typeof v === 'string') {
      out[k] = v.length === 16 ? `${v}:00` : v
    } else {
      out[k] = v as string | number
    }
  }
  return out
}

export function useAdminBookings(filter: AdminBookingFilter = {}) {
  const params = buildBookingParams(filter)
  return useQuery({
    queryKey: ['admin', 'bookings', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<AdminBooking>>>('/api/bookings', { params })
      return res.data.data
    },
  })
}

export function useCheckIn() {
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await api.post<ApiResponse<AdminBooking>>(`/api/bookings/check-in?code=${code}`)
      return res.data.data
    },
    onSuccess: () => toast.success('Check-in thành công!'),
    onError: (e) => toast.error(getErrorMessage(e, 'Check-in thất bại')),
  })
}

/** Preview booking info (read-only) trước khi admit/reject — chuẩn Vista/Veezi. */
export function usePreviewCheckIn() {
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await api.get<ApiResponse<AdminBooking>>(`/api/bookings/check-in/preview?code=${code}`)
      return res.data.data
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Không tìm thấy vé')),
  })
}

/** Từ chối check-in tại cổng — staff verify CCCD thấy không đủ tuổi hoặc lý do khác. */
export function useRejectCheckIn() {
  return useMutation({
    mutationFn: async ({ code, reason }: { code: string; reason: string }) => {
      const res = await api.post<ApiResponse<AdminBooking>>(
        `/api/bookings/check-in/reject?code=${code}&reason=${reason}`,
      )
      return res.data.data
    },
    onSuccess: () => toast.success('Đã từ chối check-in'),
    onError: (e) => toast.error(getErrorMessage(e, 'Từ chối thất bại')),
  })
}
