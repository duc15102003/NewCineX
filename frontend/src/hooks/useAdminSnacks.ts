import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export interface AdminSnack {
  id: number
  name: string
  description: string | null
  price: number
  category: string | null
  imageUrl: string | null
  available: boolean
  storageState: string
}

export function useAdminSnacks(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['admin', 'snacks', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<AdminSnack>>>('/api/snacks', { params: { ...params, includeDeleted: true } })
      return res.data.data
    },
  })
}

export function useCreateSnack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post<ApiResponse<unknown>>('/api/snacks', data)
      return res.data.data
    },
    onSuccess: () => { toast.success('Tạo đồ ăn thành công'); qc.invalidateQueries({ queryKey: ['admin', 'snacks'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useUpdateSnack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await api.put<ApiResponse<unknown>>(`/api/snacks/${id}`, data)
      return res.data.data
    },
    onSuccess: () => { toast.success('Cập nhật thành công'); qc.invalidateQueries({ queryKey: ['admin', 'snacks'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkDeleteSnacks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/snacks/bulk-delete', { ids }) },
    onSuccess: () => { toast.success('Đã lưu trữ thành công'); qc.invalidateQueries({ queryKey: ['admin', 'snacks'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkRestoreSnacks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/snacks/bulk-restore', { ids }) },
    onSuccess: () => { toast.success('Đã khôi phục thành công'); qc.invalidateQueries({ queryKey: ['admin', 'snacks'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}
