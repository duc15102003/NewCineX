import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export interface AdminVoucher {
  id: number
  code: string
  description: string | null
  /** Chi nhánh áp dụng. NULL = voucher toàn hệ thống. */
  theaterId: number | null
  theaterName: string | null
  theaterCity: string | null
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

/**
 * Filter khớp với VoucherFilter ở BE — bao gồm currentlyValid, hasUsageLeft,
 * range discountValue, range startDate/endDate.
 *
 * includeDeleted mặc định = true (admin xem tất cả, cả ARCHIVED).
 */
export interface AdminVoucherFilter {
  /** Chi nhánh — null = SUPER_ADMIN xem tất cả; có giá trị = scope theater + global. */
  theaterId?: number
  /** True = chỉ xem voucher global (theater_id IS NULL). */
  globalOnly?: boolean
  keyword?: string
  discountType?: string
  active?: boolean
  currentlyValid?: boolean
  expired?: boolean
  hasUsageLeft?: boolean
  minDiscount?: number | string
  maxDiscount?: number | string
  startDateFrom?: string
  startDateTo?: string
  endDateFrom?: string
  endDateTo?: string
  includeDeleted?: boolean
  page?: number
  size?: number
}

/**
 * Pad ":00" cho datetime-local (yyyy-MM-ddTHH:mm) → ISO yyyy-MM-ddTHH:mm:ss.
 * Bỏ field rỗng/undefined.
 */
function buildVoucherParams(filter: AdminVoucherFilter): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  const dateKeys = new Set(['startDateFrom', 'startDateTo', 'endDateFrom', 'endDateTo'])
  for (const [k, v] of Object.entries(filter)) {
    if (v === undefined || v === null || v === '') continue
    if (dateKeys.has(k) && typeof v === 'string') {
      out[k] = v.length === 16 ? `${v}:00` : v
    } else {
      out[k] = v as string | number | boolean
    }
  }
  return out
}

export function useAdminVouchers(filter: AdminVoucherFilter = {}) {
  const params = buildVoucherParams({ includeDeleted: true, ...filter })
  return useQuery({
    queryKey: ['admin', 'vouchers', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<AdminVoucher>>>('/api/vouchers', { params })
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
