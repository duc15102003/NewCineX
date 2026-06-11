import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export type TheaterStatus = 'ACTIVE' | 'MAINTENANCE' | 'CLOSED'

export interface Theater {
  id: number
  storageState: string
  code: string
  name: string
  address: string
  city: string
  hotline: string | null
  email: string | null
  latitude: number | null
  longitude: number | null
  status: TheaterStatus
  createdAt: string
  updatedAt: string
}

export interface TheaterParams {
  keyword?: string
  city?: string
  status?: TheaterStatus
  includeDeleted?: boolean
  page?: number
  size?: number
  sort?: string
}

/** Fetch theater detail (GET /api/theaters/{id}) — dùng cho form edit. */
export function useTheaterDetail(id: number | undefined) {
  return useQuery({
    queryKey: ['theater', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<ApiResponse<Theater>>(`/api/theaters/${id}`)
      return res.data.data
    },
  })
}

export function useAdminTheaters(params: TheaterParams = {}) {
  return useQuery({
    queryKey: ['admin', 'theaters', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<Theater>>>('/api/theaters', {
        params: { includeDeleted: true, ...params },
      })
      return res.data.data
    },
  })
}

/**
 * List theaters dùng cho dropdown (không phân trang lớn) — chỉ ACTIVE.
 */
export function useTheaterOptions() {
  return useQuery({
    queryKey: ['theaters', 'options'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<Theater>>>('/api/theaters', {
        params: { size: 100, status: 'ACTIVE', sort: 'name,asc' },
      })
      return res.data.data?.content ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateTheater() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post<ApiResponse<Theater>>('/api/theaters', data)
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Tạo chi nhánh thành công')
      qc.invalidateQueries({ queryKey: ['admin', 'theaters'] })
      qc.invalidateQueries({ queryKey: ['theaters', 'options'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useUpdateTheater() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await api.put<ApiResponse<Theater>>(`/api/theaters/${id}`, data)
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Cập nhật chi nhánh thành công')
      qc.invalidateQueries({ queryKey: ['admin', 'theaters'] })
      qc.invalidateQueries({ queryKey: ['theaters', 'options'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkArchiveTheaters() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/theaters/bulk-archive', ids) },
    onSuccess: () => {
      toast.success('Đã lưu trữ thành công')
      qc.invalidateQueries({ queryKey: ['admin', 'theaters'] })
      qc.invalidateQueries({ queryKey: ['theaters', 'options'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkRestoreTheaters() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/theaters/bulk-restore', ids) },
    onSuccess: () => {
      toast.success('Đã khôi phục thành công')
      qc.invalidateQueries({ queryKey: ['admin', 'theaters'] })
      qc.invalidateQueries({ queryKey: ['theaters', 'options'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}
