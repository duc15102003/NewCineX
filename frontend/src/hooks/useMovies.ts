import { useQuery } from '@tanstack/react-query'
import api from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { Genre, MovieDetail, MovieListItem, PageResponse, ShowtimeItem } from '@/types/movie'

interface MovieParams {
  keyword?: string
  status?: string
  showing?: boolean
  genreId?: number
  page?: number
  size?: number
}

export function useMovies(params: MovieParams = {}) {
  return useQuery({
    queryKey: ['movies', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<MovieListItem>>>('/api/movies', {
        params: {
          keyword: params.keyword || undefined,
          status: params.status || undefined,
          showing: params.showing || undefined,
          genreId: params.genreId || undefined,
          page: params.page ?? 0,
          size: params.size ?? 20,
        },
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

export function useShowtimes(movieId: number, date: string) {
  return useQuery({
    queryKey: ['showtimes', movieId, date],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<ShowtimeItem>>>('/api/showtimes', {
        params: { movieId, date, size: 50 },
      })
      return res.data.data.content
    },
    enabled: !!movieId && !!date,
  })
}
