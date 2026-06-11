import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export interface AdminGenre {
  id: number
  name: string
  description: string | null
  storageState: string
  createdAt: string
  updatedAt: string
}

export interface AdminGenreFilter {
  keyword?: string
  hasMovies?: boolean
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

export function useAdminGenres(params: AdminGenreFilter = {}) {
  return useQuery({
    queryKey: ['admin', 'genres', params],
    queryFn: async () => {
      // Default includeDeleted=true để admin thấy cả genre đã lưu trữ
      const cleaned = cleanParams({ ...params, includeDeleted: params.includeDeleted ?? true })
      const res = await api.get<ApiResponse<PageResponse<AdminGenre>>>('/api/genres', { params: cleaned })
      return res.data.data
    },
  })
}

/** Fetch detail 1 genre — dùng khi mở dialog Edit. */
export function useGenreDetail(id: number | null) {
  return useQuery({
    queryKey: ['admin', 'genres', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<ApiResponse<AdminGenre>>(`/api/genres/${id}`)
      return res.data.data!
    },
  })
}

export function useCreateGenre() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post<ApiResponse<unknown>>('/api/genres', data)
      return res.data.data
    },
    onSuccess: () => { toast.success('Tạo thể loại thành công'); qc.invalidateQueries({ queryKey: ['admin', 'genres'] }); qc.invalidateQueries({ queryKey: ['genres'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useUpdateGenre() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await api.put<ApiResponse<unknown>>(`/api/genres/${id}`, data)
      return res.data.data
    },
    onSuccess: () => { toast.success('Cập nhật thành công'); qc.invalidateQueries({ queryKey: ['admin', 'genres'] }); qc.invalidateQueries({ queryKey: ['genres'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkDeleteGenres() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/genres/bulk-delete', { ids }) },
    onSuccess: () => { toast.success('Đã lưu trữ thành công'); qc.invalidateQueries({ queryKey: ['admin', 'genres'] }); qc.invalidateQueries({ queryKey: ['genres'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkRestoreGenres() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/genres/bulk-restore', { ids }) },
    onSuccess: () => { toast.success('Đã khôi phục thành công'); qc.invalidateQueries({ queryKey: ['admin', 'genres'] }); qc.invalidateQueries({ queryKey: ['genres'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}
