import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { AdminMovieFilter, MovieListItem, PageResponse } from '@/types/movie'

/**
 * Movie row trên list admin — alias của {@link MovieListItem} (single source of
 * truth ở types/movie.ts, khớp BE MovieListResponse).
 *
 * Trước đây AdminMovie tự khai báo, đã drift khỏi MovieListItem (thiếu
 * createdAt/updatedAt, genres sai type string[]) → gây type error khi pass
 * sang MovieRow. Giữ alias để các file cũ import AdminMovie vẫn dùng được.
 */
export type AdminMovie = MovieListItem

/**
 * Loại bỏ các field undefined/null/'' khỏi params trước khi gửi BE.
 * Tránh axios serialize "minRating=" làm BE bind lỗi.
 */
function cleanParams(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v
  }
  return out
}

/**
 * Admin list movie — mặc định luôn includeDeleted=true để admin thấy cả phim đã lưu trữ.
 * Tham số filter map 1-1 với BE MovieFilter (xem types/movie.ts).
 */
/**
 * Detail response (GET /api/movies/{id}) — đầy đủ field để fill form.
 * Khác với AdminMovie (list) thiếu description/director/cast/language/ageRating.
 */
export interface AdminMovieDetail {
  id: number
  title: string
  description: string | null
  duration: number
  trailerUrl: string | null
  director: string | null
  cast: string | null
  language: string | null
  ageRating: string | null
  posterUrl: string | null
  status: string
  genres: Array<{ id: number; name: string }>
}

/** Fetch movie detail — dùng cho form edit, cần đầy đủ description + genres + ageRating. */
export function useMovieDetail(id: number | undefined) {
  return useQuery({
    queryKey: ['movie', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<ApiResponse<AdminMovieDetail>>(`/api/movies/${id}`)
      return res.data.data
    },
  })
}

export interface AdminGenreOption {
  id: number
  name: string
  storageState: string
}

/** Fetch tất cả genre (cả ARCHIVED) cho form multi-select — admin cần bỏ chọn genre đã archive. */
export function useAllGenresIncludingArchived() {
  return useQuery({
    queryKey: ['genres', 'all'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<AdminGenreOption>>>(
        '/api/genres', { params: { size: 50, includeDeleted: true } },
      )
      return res.data.data?.content ?? []
    },
  })
}

export function useAdminMovies(params: AdminMovieFilter = {}) {
  return useQuery({
    queryKey: ['admin', 'movies', params],
    queryFn: async () => {
      const cleaned = cleanParams({ ...params, includeDeleted: params.includeDeleted ?? true })
      const res = await api.get<ApiResponse<PageResponse<AdminMovie>>>('/api/movies', { params: cleaned })
      return res.data.data
    },
  })
}

export function useCreateMovie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post<ApiResponse<unknown>>('/api/movies', data)
      return res.data.data
    },
    onSuccess: () => { toast.success('Tạo phim thành công'); qc.invalidateQueries({ queryKey: ['admin', 'movies'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useUpdateMovie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await api.put<ApiResponse<unknown>>(`/api/movies/${id}`, data)
      return res.data.data
    },
    onSuccess: () => { toast.success('Cập nhật thành công'); qc.invalidateQueries({ queryKey: ['admin', 'movies'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useUploadPoster() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post(`/api/movies/${id}/poster`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.data
    },
    onSuccess: () => { toast.success('Upload poster thành công'); qc.invalidateQueries({ queryKey: ['admin', 'movies'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Upload thất bại')),
  })
}

export function useDeleteMovie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/api/movies/${id}`) },
    onSuccess: () => { toast.success('Đã xóa'); qc.invalidateQueries({ queryKey: ['admin', 'movies'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkDeleteMovies() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/movies/bulk-delete', { ids }) },
    onSuccess: () => { toast.success('Đã lưu trữ thành công'); qc.invalidateQueries({ queryKey: ['admin', 'movies'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkRestoreMovies() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/movies/bulk-restore', { ids }) },
    onSuccess: () => { toast.success('Đã khôi phục thành công'); qc.invalidateQueries({ queryKey: ['admin', 'movies'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}
