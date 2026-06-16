import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'

/**
 * Config item — self-describing (label + hint + unit + category + visible từ BE).
 *
 * <p>Trước đây FE phải hardcode metadata cho từng key — vỡ pattern enterprise.
 * Bây giờ metadata lưu cùng record DB → BE trả full shape, FE chỉ render.
 */
export interface AdminConfigItem {
  /** Key kỹ thuật — KHÔNG hiển thị cho admin, chỉ dùng làm identifier khi PUT. */
  configKey: string
  configValue: string
  /** Tên thân thiện tiếng Việt — hiển thị ở cột "Tên cấu hình". */
  label: string
  /** Tooltip giải thích "đổi giá trị → tác động gì". */
  hint?: string | null
  /** Đơn vị hiển thị cạnh giá trị: "phút", "lần", "ngày", "điểm", "giây". */
  unit?: string | null
  /** Nhóm: booking / showtime / loyalty / security / dashboard. */
  category: string
  /** Thứ tự trong nhóm — số nhỏ lên trước. */
  displayOrder?: number | null
  /** false = config kỹ thuật (ẩn mặc định trên UI). */
  visible: boolean
  /** Ràng buộc giá trị cho input number. */
  minValue?: number | null
  maxValue?: number | null
}

const PUBLIC_CONFIG_STALE_MS = 5 * 60 * 1000

/**
 * Đọc 1 config key public (không cần auth).
 * Trả số đã parse từ chuỗi; nếu BE chưa có key → dùng fallback.
 */
export function usePublicConfigNumber(key: string, fallback: number) {
  return useQuery({
    queryKey: ['config', 'public', key],
    queryFn: async () => {
      const res = await api.get<ApiResponse<string>>(`/api/configs/public/${key}`)
      const raw = res.data.data
      const num = Number(raw ?? fallback)
      return Number.isFinite(num) ? num : fallback
    },
    staleTime: PUBLIC_CONFIG_STALE_MS,
  })
}

/**
 * Danh sách config cho admin Cấu hình hệ thống.
 *
 * @param includeHidden true = trả cả config kỹ thuật (rate-limit, cache,
 *                       NO_SHOW buffer...). Mặc định false.
 */
export function useAdminConfigs(includeHidden = false) {
  return useQuery({
    queryKey: ['admin', 'configs', { includeHidden }],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AdminConfigItem[]>>('/api/configs', {
        params: { includeHidden },
      })
      return res.data.data ?? []
    },
  })
}

/** Update 1 config key (admin). */
export function useUpdateConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await api.put(`/api/configs/${key}`, { value })
    },
    onSuccess: () => {
      toast.success('Đã lưu cấu hình')
      qc.invalidateQueries({ queryKey: ['admin', 'configs'] })
      qc.invalidateQueries({ queryKey: ['config', 'public'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi cập nhật cấu hình')),
  })
}
