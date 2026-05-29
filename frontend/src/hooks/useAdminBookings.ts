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
  startTime: string
  roomName: string
  seatCount: number
  totalAmount: number
  status: string
  createdAt: string
}

export function useAdminBookings(params: Record<string, any> = {}) {
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
