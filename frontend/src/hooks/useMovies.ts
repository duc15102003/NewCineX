import { useQuery } from '@tanstack/react-query'
import api from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { Genre, MovieDetail, MovieFilter, MovieListItem, PageResponse, ShowtimeItem } from '@/types/movie'

/**
 * Loại bỏ field undefined/null/'' trước khi gửi BE.
 */
function cleanParams(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v
  }
  return out
}

export function useMovies(params: MovieFilter = {}) {
  return useQuery({
    queryKey: ['movies', params],
    queryFn: async () => {
      const cleaned = cleanParams({
        ...params,
        page: params.page ?? 0,
        size: params.size ?? 20,
      })
      const res = await api.get<ApiResponse<PageResponse<MovieListItem>>>('/api/movies', {
        params: cleaned,
      })
      return res.data.data
    },
  })
}

export function useMovie(id: number) {
  return useQuery({
    queryKey: ['movie', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<MovieDetail>>(`/api/movies/${id}`)
      return res.data.data
    },
    enabled: !!id,
  })
}

export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<Genre>>>('/api/genres', {
        params: { size: 50 },
      })
      return res.data.data.content
    },
    staleTime: 5 * 60 * 1000, // Cache 5 phút (genres ít thay đổi)
  })
}

/**
 * List showtime của 1 phim + ngày, optional filter theo chi nhánh.
 *
 * <p>Sau F1 (Theater): nếu truyền {@code theaterId}, chỉ trả suất chiếu trong chi nhánh đó.
 */
export function useShowtimes(movieId: number, date: string, theaterId?: number | null) {
  return useQuery({
    queryKey: ['showtimes', movieId, date, theaterId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, unknown> = { movieId, date, size: 50 }
      if (theaterId) params.theaterId = theaterId
      const res = await api.get<ApiResponse<PageResponse<ShowtimeItem>>>('/api/showtimes', { params })
      return res.data.data.content
    },
    enabled: !!movieId && !!date,
  })
}
