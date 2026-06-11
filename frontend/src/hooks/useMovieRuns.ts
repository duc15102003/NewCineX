import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { MovieRun, MovieRunRequest } from '@/types/movie'

/**
 * Hook quản lý MovieRun (đợt chiếu của 1 phim).
 *
 * BE refactor Movie → Movie + MovieRun:
 *  - Movie giữ metadata cố định (title, director, duration, ...)
 *  - MovieRun chứa thông tin đợt chiếu (startDate, endDate, runType, status)
 *  - 1 movie có thể có nhiều run (FIRST_RUN khi mới phát hành, REISSUE sau này, ...)
 *
 * Endpoint:
 *  GET    /api/movie-runs?movieId=X — list runs của phim
 *  POST   /api/movie-runs           — create (ADMIN)
 *  PUT    /api/movie-runs/{id}      — update (ADMIN)
 *  DELETE /api/movie-runs/{id}      — archive (ADMIN)
 */

/** Optional theaterId filter — null = tất cả rạp (SUPER_ADMIN); có giá trị = scope theater. */
export function useMovieRuns(movieId: number | undefined, theaterId?: number) {
  return useQuery({
    queryKey: ['movie-runs', movieId, theaterId],
    enabled: !!movieId,
    queryFn: async () => {
      const res = await api.get<ApiResponse<MovieRun[]>>('/api/movie-runs', {
        params: { movieId, theaterId },
      })
      return res.data.data ?? []
    },
  })
}

export function useCreateMovieRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: MovieRunRequest) => {
      const res = await api.post<ApiResponse<MovieRun>>('/api/movie-runs', data)
      return res.data.data
    },
    onSuccess: (run) => {
      toast.success('Tạo đợt chiếu thành công')
      qc.invalidateQueries({ queryKey: ['movie-runs', run?.movieId] })
      qc.invalidateQueries({ queryKey: ['movie-runs'] })
      // Trạng thái Movie có thể đổi (derived từ runs) → invalidate luôn admin movies
      qc.invalidateQueries({ queryKey: ['admin', 'movies'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useUpdateMovieRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: MovieRunRequest }) => {
      const res = await api.put<ApiResponse<MovieRun>>(`/api/movie-runs/${id}`, data)
      return res.data.data
    },
    onSuccess: (run) => {
      toast.success('Cập nhật đợt chiếu thành công')
      qc.invalidateQueries({ queryKey: ['movie-runs', run?.movieId] })
      qc.invalidateQueries({ queryKey: ['movie-runs'] })
      qc.invalidateQueries({ queryKey: ['admin', 'movies'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useArchiveMovieRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/movie-runs/${id}`)
    },
    onSuccess: () => {
      toast.success('Đã lưu trữ đợt chiếu')
      qc.invalidateQueries({ queryKey: ['movie-runs'] })
      qc.invalidateQueries({ queryKey: ['admin', 'movies'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}
