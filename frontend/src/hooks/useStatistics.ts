import { useQuery } from '@tanstack/react-query'
import api from '@/api/axios'
import type { ApiResponse } from '@/types/auth'

export interface OverviewStats {
  todayBookings: number
  todayRevenue: number
  todaySnackRevenue: number
  totalUsers: number
  totalMovies: number
  totalRooms: number
  totalShowtimesToday: number
}

export interface RevenueItem {
  date: string
  revenue: number
}

export interface TopMovie {
  movieId: number
  title: string
  posterUrl: string | null
  ticketCount: number
  revenue: number
}

export interface TopSnack {
  snackId: number
  snackName: string
  imageUrl: string | null
  totalQuantitySold: number
  totalRevenue: number
}

/** 1 đợt chiếu cụ thể — phân biệt FIRST_RUN/REISSUE/FESTIVAL của cùng 1 phim. */
export interface TopMovieRun {
  movieRunId: number
  movieId: number
  movieTitle: string
  moviePosterUrl: string | null
  runType: string | null  // FIRST_RUN / REISSUE / FESTIVAL / HOLDOVER
  startDate: string
  endDate: string | null
  ticketCount: number
  revenue: number
}

/** 1 suất chiếu trong ngày + tỷ lệ lấp đầy. */
export interface Occupancy {
  showtimeId: number
  movieTitle: string
  roomName: string
  startTime: string
  totalSeats: number
  bookedSeats: number
  occupancyRate: number  // 0-100
}

// theaterId: undefined = SUPER_ADMIN xem "Tất cả chi nhánh" (aggregate);
// có id = filter dashboard theo CN cụ thể. BRANCH_ADMIN bị BE auto-scope từ JWT — FE truyền gì cũng bị ghi đè.
export function useOverviewStats(theaterId?: number) {
  return useQuery({
    queryKey: ['admin', 'overview', theaterId ?? 'all'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<OverviewStats>>('/api/statistics/overview', {
        params: theaterId ? { theaterId } : undefined,
      })
      return res.data.data
    },
  })
}

export function useRevenueStats(from: string, to: string, theaterId?: number) {
  return useQuery({
    queryKey: ['admin', 'revenue', from, to, theaterId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string | number> = { from, to }
      if (theaterId) params.theaterId = theaterId
      const res = await api.get<ApiResponse<RevenueItem[]>>('/api/statistics/revenue', { params })
      return res.data.data
    },
    enabled: !!from && !!to,
  })
}

export function useTopMovies(from: string, to: string, theaterId?: number) {
  return useQuery({
    queryKey: ['admin', 'topMovies', from, to, theaterId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 100, from, to }
      if (theaterId) params.theaterId = theaterId
      const res = await api.get<ApiResponse<TopMovie[]>>('/api/statistics/top-movies', { params })
      return res.data.data
    },
    enabled: !!from && !!to,
  })
}

export function useTopSnacks(from: string, to: string, theaterId?: number) {
  return useQuery({
    queryKey: ['admin', 'topSnacks', from, to, theaterId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 100, from, to }
      if (theaterId) params.theaterId = theaterId
      const res = await api.get<ApiResponse<TopSnack[]>>('/api/statistics/top-snacks', { params })
      return res.data.data
    },
    enabled: !!from && !!to,
  })
}

/**
 * Top đợt chiếu (movie runs) — phân biệt từng đợt FIRST_RUN/REISSUE để distributor
 * và admin biết đợt nào hiệu quả. Khác useTopMovies (gộp theo phim).
 */
export function useTopMovieRuns(from: string, to: string, theaterId?: number) {
  return useQuery({
    queryKey: ['admin', 'topMovieRuns', from, to, theaterId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 20, from, to }
      if (theaterId) params.theaterId = theaterId
      const res = await api.get<ApiResponse<TopMovieRun[]>>('/api/statistics/top-movie-runs', { params })
      return res.data.data
    },
    enabled: !!from && !!to,
  })
}

/**
 * Tỷ lệ lấp đầy ghế per-suất theo ngày cụ thể — operations team theo dõi
 * phòng nào lấp đầy (cân nhắc thêm suất), phòng nào ế (cân nhắc bỏ slot).
 */
export function useOccupancy(date: string, theaterId?: number) {
  return useQuery({
    queryKey: ['admin', 'occupancy', date, theaterId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string | number> = { date }
      if (theaterId) params.theaterId = theaterId
      const res = await api.get<ApiResponse<Occupancy[]>>('/api/statistics/occupancy', { params })
      return res.data.data
    },
    enabled: !!date,
  })
}
