import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export interface AdminVoucher {
  id: number
  code: string
  description: string | null
  discountType: string
  discountValue: number
  minOrderAmount: number
  maxDiscount: number | null
  usageLimit: number | null
  usedCount: number
  startDate: string | null
  endDate: string | null
  storageState: string
}

export function useAdminVouchers(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['admin', 'vouchers', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<AdminVoucher>>>('/api/vouchers', { params: { ...params, includeDeleted: true } })
      return res.data.data
    },
  })
}

export function useCreateVoucher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post<ApiResponse<unknown>>('/api/vouchers', data)
      return res.data.data
    },
    onSuccess: () => { toast.success('Tạo voucher thành công'); qc.invalidateQueries({ queryKey: ['admin', 'vouchers'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useUpdateVoucher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await api.put<ApiResponse<unknown>>(`/api/vouchers/${id}`, data)
      return res.data.data
    },
    onSuccess: () => { toast.success('Cập nhật thành công'); qc.invalidateQueries({ queryKey: ['admin', 'vouchers'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkDeleteVouchers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/vouchers/bulk-delete', { ids }) },
    onSuccess: () => { toast.success('Đã lưu trữ thành công'); qc.invalidateQueries({ queryKey: ['admin', 'vouchers'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkRestoreVouchers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/vouchers/bulk-restore', { ids }) },
    onSuccess: () => { toast.success('Đã khôi phục thành công'); qc.invalidateQueries({ queryKey: ['admin', 'vouchers'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}
