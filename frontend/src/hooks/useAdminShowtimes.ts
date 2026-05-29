import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export interface AdminShowtime {
  id: number
  movieTitle: string
  moviePosterUrl: string | null
  roomName: string
  roomType: string
  startTime: string
  endTime: string
  basePrice: number
  vipPrice: number | null
  couplePrice: number | null
  status: string
  storageState: string
  // Optional nested fields (legacy response shape)
  movie?: { title: string; posterUrl?: string | null }
  room?: { name: string; type?: string }
}

export function useAdminShowtimes(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['admin', 'showtimes', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<AdminShowtime>>>('/api/showtimes', { params: { ...params, includeDeleted: true } })
      return res.data.data
    },
  })
}

export function useCreateShowtime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => { const res = await api.post<ApiResponse<unknown>>('/api/showtimes', data); return res.data.data },
    onSuccess: () => { toast.success('Tạo suất chiếu thành công'); qc.invalidateQueries({ queryKey: ['admin', 'showtimes'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useUpdateShowtime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await api.put<ApiResponse<unknown>>(`/api/showtimes/${id}`, data)
      return res.data.data
    },
    onSuccess: () => { toast.success('Cập nhật thành công'); qc.invalidateQueries({ queryKey: ['admin', 'showtimes'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkDeleteShowtimes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/showtimes/bulk-delete', { ids }) },
    onSuccess: () => { toast.success('Đã lưu trữ thành công'); qc.invalidateQueries({ queryKey: ['admin', 'showtimes'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkRestoreShowtimes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/showtimes/bulk-restore', { ids }) },
    onSuccess: () => { toast.success('Đã khôi phục thành công'); qc.invalidateQueries({ queryKey: ['admin', 'showtimes'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}
