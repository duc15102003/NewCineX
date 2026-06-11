import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export type PricingRuleType = 'DAY_OF_WEEK' | 'HOUR_RANGE' | 'DATE_RANGE' | 'COMPOSITE'

export interface PricingRule {
  id: number
  storageState: string
  /** Chi nhánh áp dụng. NULL = rule DEFAULT toàn hệ thống. */
  theaterId: number | null
  theaterName: string | null
  theaterCity: string | null
  code: string
  name: string
  description: string | null
  ruleType: PricingRuleType
  multiplierPercent: number
  dayOfWeek: string | null
  hourStart: number | null
  hourEnd: number | null
  dateStart: string | null
  dateEnd: string | null
  active: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

export function useAdminPricingRules(params: { theaterId?: number; page?: number; size?: number } = {}) {
  return useQuery({
    queryKey: ['admin', 'pricing-rules', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<PricingRule>>>('/api/pricing-rules', { params })
      return res.data.data
    },
  })
}

export function useCreatePricingRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post<ApiResponse<PricingRule>>('/api/pricing-rules', data)
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Tạo rule thành công')
      qc.invalidateQueries({ queryKey: ['admin', 'pricing-rules'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useUpdatePricingRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await api.put<ApiResponse<PricingRule>>(`/api/pricing-rules/${id}`, data)
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Cập nhật rule thành công')
      qc.invalidateQueries({ queryKey: ['admin', 'pricing-rules'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useArchivePricingRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/api/pricing-rules/${id}`) },
    onSuccess: () => {
      toast.success('Đã lưu trữ')
      qc.invalidateQueries({ queryKey: ['admin', 'pricing-rules'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkArchivePricingRules() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/pricing-rules/bulk-archive', ids) },
    onSuccess: () => {
      toast.success('Đã lưu trữ')
      qc.invalidateQueries({ queryKey: ['admin', 'pricing-rules'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useBulkRestorePricingRules() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => { await api.post('/api/pricing-rules/bulk-restore', ids) },
    onSuccess: () => {
      toast.success('Đã khôi phục')
      qc.invalidateQueries({ queryKey: ['admin', 'pricing-rules'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}
