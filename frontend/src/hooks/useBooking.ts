import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type {
  BookingDetail, BookingListItem, HoldSeatsRequest, HoldSeatsResponse,
  PaymentResponse, SeatMapData, TicketData, UserProfile,
} from '@/types/booking'
import type { PageResponse } from '@/types/movie'

export function useSeatMap(showtimeId: number) {
  return useQuery({
    queryKey: ['seatMap', showtimeId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<SeatMapData>>(`/api/rooms/${showtimeId}/seats`)
      return res.data.data
    },
    enabled: false, // Seat map cần showtimeId → load thủ công
  })
}

export function useShowtimeSeatMap(showtimeId: number) {
  return useQuery({
    queryKey: ['showtimeSeatMap', showtimeId],
    queryFn: async () => {
      // Lấy showtime detail → roomId → seat map
      const stRes = await api.get<ApiResponse<any>>(`/api/showtimes/${showtimeId}`)
      const roomId = stRes.data.data.roomId
      const seatRes = await api.get<ApiResponse<SeatMapData>>(`/api/rooms/${roomId}/seats`)
      return { showtime: stRes.data.data, seatMap: seatRes.data.data }
    },
    enabled: !!showtimeId,
  })
}

export function useHoldSeats() {
  return useMutation({
    mutationFn: async (data: HoldSeatsRequest) => {
      const res = await api.post<ApiResponse<HoldSeatsResponse>>('/api/bookings/hold', data)
      return res.data.data
    },
    onError: (e) => {
      toast.error(getErrorMessage(e, 'Không thể giữ ghế'))
    },
  })
}

export function useCreatePayment() {
  return useMutation({
    mutationFn: async (data: { bookingId: number; paymentMethod: string }) => {
      const res = await api.post<ApiResponse<PaymentResponse>>('/api/payments/create', data)
      return res.data.data
    },
    onError: (e) => {
      toast.error(getErrorMessage(e, 'Không thể tạo thanh toán'))
    },
  })
}

export function useMyBookings(page = 0) {
  return useQuery({
    queryKey: ['myBookings', page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<BookingListItem>>>('/api/bookings/me', {
        params: { page, size: 10 },
      })
      return res.data.data
    },
  })
}

export function useBookingDetail(id: number) {
  return useQuery({
    queryKey: ['booking', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BookingDetail>>(`/api/bookings/${id}`)
      return res.data.data
    },
    enabled: !!id,
  })
}

export function useTicket(bookingId: number) {
  return useQuery({
    queryKey: ['ticket', bookingId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TicketData>>(`/api/bookings/${bookingId}/ticket`)
      return res.data.data
    },
    enabled: !!bookingId,
  })
}

export function useCancelBooking() {
  return useMutation({
    mutationFn: async (bookingId: number) => {
      const res = await api.put<ApiResponse<BookingDetail>>(`/api/bookings/${bookingId}/cancel`)
      return res.data.data
    },
    onSuccess: () => toast.success('Đã hủy vé'),
    onError: (e) => toast.error(getErrorMessage(e, 'Không thể hủy vé')),
  })
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<UserProfile>>('/api/users/me')
      return res.data.data
    },
  })
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (data: { fullName?: string; phone?: string }) => {
      const res = await api.put<ApiResponse<UserProfile>>('/api/users/me', data)
      return res.data.data
    },
    onSuccess: () => toast.success('Cập nhật thành công'),
    onError: (e) => toast.error(getErrorMessage(e, 'Cập nhật thất bại')),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: { oldPassword: string; newPassword: string; confirmPassword: string }) => {
      await api.put('/api/users/me/password', data)
    },
    onSuccess: () => toast.success('Đổi mật khẩu thành công'),
    onError: (e) => toast.error(getErrorMessage(e, 'Đổi mật khẩu thất bại')),
  })
}
