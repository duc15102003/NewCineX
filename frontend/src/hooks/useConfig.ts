import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'

export interface AdminConfigItem {
  id: number
  configKey: string
  configValue: string
  description?: string
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

/** Danh sách config dành cho admin (list full bảng system_config). */
export function useAdminConfigs() {
  return useQuery({
    queryKey: ['admin', 'configs'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AdminConfigItem[]>>('/api/configs')
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
      toast.success('Cập nhật thành công')
      qc.invalidateQueries({ queryKey: ['admin', 'configs'] })
      // Public config cùng key có thể đã đổi — invalidate hết
      qc.invalidateQueries({ queryKey: ['config', 'public'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi cập nhật cấu hình')),
  })
}
