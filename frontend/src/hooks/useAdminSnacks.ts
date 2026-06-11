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
  /** Chi nhánh sở hữu snack — BE đã expose, dùng cho grouped view + form. */
  theaterId: number | null
  theaterName: string | null
  theaterCity: string | null
}

/**
 * Params filter cho list snack — match BE SnackFilter.java.
 * keyword search trên cả name + description (BE quy ước).
 */
export interface AdminSnackParams {
  /** Chi nhánh — branch ADMIN auto-scope từ BE; SUPER_ADMIN có thể truyền để lọc. */
  theaterId?: number
  keyword?: string
  category?: string       // POPCORN | DRINK | COMBO | SNACK
  available?: boolean     // true / false / undefined = all
  minPrice?: number
  maxPrice?: number
  includeDeleted?: boolean
  page?: number
  size?: number
}

export function useAdminSnacks(params: AdminSnackParams = {}) {
  return useQuery({
    queryKey: ['admin', 'snacks', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<AdminSnack>>>('/api/snacks', {
        params: { includeDeleted: true, ...params },
      })
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

/** Upload ảnh cho 1 snack — action tách khỏi form (theo File Upload Rules). */
export function useUploadSnackImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/api/snacks/${id}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      toast.success('Upload ảnh thành công')
      qc.invalidateQueries({ queryKey: ['admin', 'snacks'] })
    },
    onError: () => toast.error('Upload ảnh thất bại'),
  })
}
