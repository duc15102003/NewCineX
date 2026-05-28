import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export interface AdminRoom {
  id: number
  name: string
  type: string
  totalSeats: number
  status: string
  storageState: string
}

export function useAdminRooms(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['admin', 'rooms', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<AdminRoom>>>('/api/rooms', { params: { ...params, includeDeleted: true } })
      return res.data.data
    },
  })
}

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => { const res = await api.post<ApiResponse<unknown>>('/api/rooms', data); return res.data.data },
    onSuccess: () => { toast.success('Tạo phòng thành công'); qc.invalidateQueries({ queryKey: ['admin', 'rooms'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useUpdateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await api.put<ApiResponse<unknown>>(`/api/rooms/${id}`, data)
      return res.data.data
    },
    onSuccess: () => { toast.success('Cập nhật thành công'); qc.invalidateQueries({ queryKey: ['admin', 'rooms'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkDeleteRooms() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/rooms/bulk-delete', { ids }) },
    onSuccess: () => { toast.success('Đã lưu trữ thành công'); qc.invalidateQueries({ queryKey: ['admin', 'rooms'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkRestoreRooms() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/rooms/bulk-restore', { ids }) },
    onSuccess: () => { toast.success('Đã khôi phục thành công'); qc.invalidateQueries({ queryKey: ['admin', 'rooms'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useGenerateSeats() {
  return useMutation({
    mutationFn: async ({ roomId, data }: { roomId: number; data: Record<string, unknown> }) => {
      const res = await api.post<ApiResponse<unknown>>(`/api/rooms/${roomId}/seats/generate`, data)
      return res.data.data
    },
    onSuccess: () => toast.success('Generate ghế thành công'),
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}
