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

export function useOverviewStats() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<OverviewStats>>('/api/statistics/overview')
      return res.data.data
    },
  })
}

export function useRevenueStats(from: string, to: string) {
  return useQuery({
    queryKey: ['admin', 'revenue', from, to],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RevenueItem[]>>('/api/statistics/revenue', { params: { from, to } })
      return res.data.data
    },
    enabled: !!from && !!to,
  })
}

export function useTopMovies(from: string, to: string) {
  return useQuery({
    queryKey: ['admin', 'topMovies', from, to],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TopMovie[]>>('/api/statistics/top-movies', {
        params: { limit: 100, from, to },
      })
      return res.data.data
    },
    enabled: !!from && !!to,
  })
}

export function useTopSnacks(from: string, to: string) {
  return useQuery({
    queryKey: ['admin', 'topSnacks', from, to],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TopSnack[]>>('/api/statistics/top-snacks', {
        params: { limit: 100, from, to },
      })
      return res.data.data
    },
    enabled: !!from && !!to,
  })
}
