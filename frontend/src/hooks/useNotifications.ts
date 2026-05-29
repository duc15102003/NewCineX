import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

interface Notification {
  id: number
  title: string
  content: string
  type: string
  read: boolean
  createdAt: string
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<Notification>>>('/api/notifications/me', {
        params: { size: 10 },
      })
      return res.data.data
    },
    refetchInterval: 30000, // Poll mỗi 30 giây
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<number>>('/api/notifications/me/unread-count')
      return res.data.data
    },
    refetchInterval: 30000,
  })
}

export function useMarkAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.put(`/api/notifications/${id}/read`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.put('/api/notifications/read-all')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
