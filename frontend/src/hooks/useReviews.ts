import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export interface Review {
  id: number
  username: string
  avatarUrl: string | null
  movieId: number
  movieTitle: string
  rating: number
  comment: string
  createdAt: string
  storageState?: string
}

/**
 * Filter cho admin list reviews — map 1-1 với BE ReviewFilter.java.
 */
export interface AdminReviewFilter {
  // Search: LIKE trên user.username/fullName/email + movie.title + comment
  keyword?: string
  movieId?: number
  userId?: number
  minRating?: number
  maxRating?: number
  hasComment?: boolean
  createdFrom?: string  // ISO datetime
  createdTo?: string
  includeDeleted?: boolean
  page?: number
  size?: number
}

function cleanParams(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v
  }
  return out
}

/**
 * Admin xem tất cả reviews xuyên phim — gọi /api/reviews/admin (ROLE_ADMIN).
 */
export function useAdminReviews(params: AdminReviewFilter = {}) {
  return useQuery({
    queryKey: ['admin', 'reviews', params],
    queryFn: async () => {
      const cleaned = cleanParams(params as Record<string, unknown>)
      const res = await api.get<ApiResponse<PageResponse<Review>>>('/api/reviews/admin', { params: cleaned })
      return res.data.data
    },
  })
}

/**
 * Admin xóa review bất kỳ — service check role ADMIN bypass ownership.
 */
export function useAdminDeleteReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reviewId: number) => {
      await api.delete(`/api/reviews/${reviewId}`)
    },
    onSuccess: () => {
      toast.success('Đã xóa đánh giá')
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useReviews(movieId: number) {
  return useQuery({
    queryKey: ['reviews', movieId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<Review>>>(`/api/movies/${movieId}/reviews`, {
        params: { size: 20 },
      })
      return res.data.data
    },
    enabled: !!movieId,
  })
}

export function useCreateReview(movieId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { rating: number; comment: string }) => {
      const res = await api.post<ApiResponse<Review>>(`/api/movies/${movieId}/reviews`, data)
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Đã gửi đánh giá')
      qc.invalidateQueries({ queryKey: ['reviews', movieId] })
      qc.invalidateQueries({ queryKey: ['movie', movieId] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi gửi đánh giá')),
  })
}

export function useDeleteReview(movieId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reviewId: number) => {
      await api.delete(`/api/reviews/${reviewId}`)
    },
    onSuccess: () => {
      toast.success('Đã xóa đánh giá')
      qc.invalidateQueries({ queryKey: ['reviews', movieId] })
      qc.invalidateQueries({ queryKey: ['movie', movieId] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}
