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
}

export function useAdminUsers(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<AdminUser>>>('/api/users', { params })
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
