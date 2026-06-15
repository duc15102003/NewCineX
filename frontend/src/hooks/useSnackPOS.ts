import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'
import type { AdminSnack } from '@/hooks/useAdminSnacks'
import { fmtVnd } from '@/utils/labels'

const POS_PAGE_SIZE = 50

/** Item gửi BE — XOR: snackId hoặc comboId, không cả 2. */
interface SnackOrderItem {
  snackId?: number
  comboId?: number
  quantity: number
}

interface CreateSnackOrderRequest {
  /**
   * Chi nhánh nơi đơn POS được tạo.
   * - BRANCH_ADMIN: BE override từ JWT (FE có gửi cũng bị bỏ qua).
   * - SUPER_ADMIN: BẮT BUỘC gửi — không gửi → BE trả VALIDATION_ERROR.
   */
  theaterId?: number | null
  items: SnackOrderItem[]
  note: string | null
}

interface SnackOrderResponse {
  orderCode: string
  totalAmount: number
}

/** Snack list dùng cho POS bán hàng tại quầy — page lớn (50) để hiện hết catalog. */
export function useSnacksForPOS(theaterId?: number | null) {
  return useQuery({
    queryKey: ['pos', 'snacks', theaterId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, unknown> = { size: POS_PAGE_SIZE }
      if (theaterId) params.theaterId = theaterId
      const res = await api.get<ApiResponse<PageResponse<AdminSnack>>>('/api/snacks', { params })
      return res.data.data?.content ?? []
    },
  })
}

/** Tạo đơn snack tại quầy. Toast hiển thị mã đơn + tổng tiền khi thành công. */
export function useCreateSnackOrder() {
  return useMutation({
    mutationFn: async (data: CreateSnackOrderRequest) => {
      const res = await api.post<ApiResponse<SnackOrderResponse>>('/api/snack-orders', data)
      return res.data.data!
    },
    onSuccess: (data) => {
      toast.success(`Đơn ${data.orderCode} — ${fmtVnd(data.totalAmount)}`)
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi tạo đơn')),
  })
}
