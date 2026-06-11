import { useQuery } from '@tanstack/react-query'
import api from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

/**
 * Payment trả về cho admin — khớp với PaymentResponse ở BE.
 * Field optional vì payment có thể chưa paid (paidAt = null).
 */
export interface AdminPayment {
  id: number
  storageState: string | null
  bookingId: number
  bookingCode: string | null
  amount: number
  method: string
  transactionCode: string
  status: string
  paymentUrl: string | null
  paidAt: string | null
  createdAt: string
  updatedAt: string | null
}

/**
 * Filter — khớp 1-1 với PaymentFilter BE.
 *
 * Quy tắc:
 *  - Tất cả field optional, hook tự strip rỗng.
 *  - keyword tìm trên transactionCode + bookingCode (BE handle).
 *  - paidFrom/To, createdFrom/To ở dạng datetime-local string (yyyy-MM-ddTHH:mm),
 *    sẽ pad ":00" cho đủ ISO trước khi gửi BE.
 */
export interface AdminPaymentFilter {
  keyword?: string
  status?: string
  method?: string
  paidFrom?: string
  paidTo?: string
  createdFrom?: string
  createdTo?: string
  minAmount?: number | string
  maxAmount?: number | string
  userId?: number | string
  bookingId?: number | string
  theaterId?: number | string
  page?: number
  size?: number
}

function buildPaymentParams(filter: AdminPaymentFilter): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(filter)) {
    if (v === undefined || v === null || v === '') continue
    if ((k === 'paidFrom' || k === 'paidTo' || k === 'createdFrom' || k === 'createdTo')
        && typeof v === 'string') {
      out[k] = v.length === 16 ? `${v}:00` : v
    } else {
      out[k] = v as string | number
    }
  }
  return out
}

export function useAdminPayments(filter: AdminPaymentFilter = {}) {
  const params = buildPaymentParams(filter)
  return useQuery({
    queryKey: ['admin', 'payments', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<AdminPayment>>>('/api/payments', { params })
      return res.data.data
    },
  })
}
