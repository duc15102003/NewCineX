import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export interface AdminUser {
  id: number
  username: string
  email: string
  fullName: string | null
  phone: string | null
  avatarUrl: string | null
  role: string
  enabled: boolean
  storageState?: string
  createdAt?: string
  /** Chi nhánh gán cho branch ADMIN — null cho USER/SUPER_ADMIN. */
  theaterId?: number | null
  theaterName?: string | null
}

/**
 * Filter cho admin list user — map 1-1 với BE UserFilter.java.
 */
export interface AdminUserFilter {
  keyword?: string
  role?: 'USER' | 'ADMIN' | ''
  enabled?: boolean
  createdFrom?: string  // ISO datetime (yyyy-MM-ddTHH:mm:ss)
  createdTo?: string
  includeDeleted?: boolean
  page?: number
  size?: number
}

/**
 * Loại bỏ field rỗng để BE không bind nhầm (vd: enabled=""→false giả).
 */
function cleanParams(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v
  }
  return out
}

export function useAdminUsers(params: AdminUserFilter = {}) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: async () => {
      const cleaned = cleanParams(params as Record<string, unknown>)
      const res = await api.get<ApiResponse<PageResponse<AdminUser>>>('/api/users', { params: cleaned })
      return res.data.data
    },
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      await api.put(`/api/users/${id}/role`, { role })
    },
    onSuccess: () => { toast.success('Đổi role thành công'); qc.invalidateQueries({ queryKey: ['admin', 'users'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}

export function useAdminUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await api.put<ApiResponse<unknown>>(`/api/users/${id}`, data)
      return res.data.data
    },
    onSuccess: () => { toast.success('Cập nhật user thành công'); qc.invalidateQueries({ queryKey: ['admin', 'users'] }) },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi')),
  })
}
