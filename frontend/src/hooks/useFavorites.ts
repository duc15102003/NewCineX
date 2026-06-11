import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import { useAuthStore } from '@/store/authStore'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export interface FavoriteMovie {
  movieId: number
  title: string
  posterUrl: string | null
  duration: number
  rating: number | null
  status: string
  favoritedAt: string
}

export function useFavorites(page = 0) {
  return useQuery({
    queryKey: ['favorites', page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<FavoriteMovie>>>('/api/users/me/favorites', {
        params: { page, size: 20 },
      })
      return res.data.data
    },
  })
}

export function useIsFavorite(movieId: number) {
  // Guest không có quyền vào /users/me/favorites → skip query để tránh 401.
  // Trang movie detail là public, hook này dùng ở đó nên phải guard.
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  return useQuery({
    queryKey: ['favorite', movieId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<FavoriteMovie>>>('/api/users/me/favorites', {
        params: { size: 100 },
      })
      const favorites = res.data.data.content ?? []
      return favorites.some(f => f.movieId === movieId)
    },
    enabled: !!movieId && isLoggedIn(),
  })
}

export function useAddFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (movieId: number) => {
      await api.post(`/api/movies/${movieId}/favorite`)
    },
    onSuccess: () => {
      toast.success('Đã thêm vào yêu thích')
      qc.invalidateQueries({ queryKey: ['favorites'] })
      qc.invalidateQueries({ queryKey: ['favorite'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useRemoveFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (movieId: number) => {
      await api.delete(`/api/movies/${movieId}/favorite`)
    },
    onSuccess: () => {
      toast.success('Đã bỏ yêu thích')
      qc.invalidateQueries({ queryKey: ['favorites'] })
      qc.invalidateQueries({ queryKey: ['favorite'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}
