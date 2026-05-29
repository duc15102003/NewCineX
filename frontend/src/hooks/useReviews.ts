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
