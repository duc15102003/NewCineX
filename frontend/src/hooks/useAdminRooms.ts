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
  /** Chi nhánh sở hữu phòng — BE đã expose, dùng cho grouped view + form. */
  theaterId: number | null
  theaterName: string | null
  theaterCity: string | null
}

/**
 * Params filter cho list room — match BE RoomFilter.java.
 */
export interface AdminRoomParams {
  keyword?: string
  theaterId?: number    // Filter theo chi nhánh (admin context)
  type?: string         // TWO_D | THREE_D | IMAX | FOUR_DX
  status?: string       // ACTIVE | MAINTENANCE | INACTIVE
  minSeats?: number
  maxSeats?: number
  includeDeleted?: boolean
  page?: number
  size?: number
}

export function useAdminRooms(params: AdminRoomParams = {}) {
  return useQuery({
    queryKey: ['admin', 'rooms', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<AdminRoom>>>('/api/rooms', {
        // Default includeDeleted=true cho admin, nhưng page có thể override
        params: { includeDeleted: true, ...params },
      })
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
