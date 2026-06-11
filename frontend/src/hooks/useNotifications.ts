import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export interface Notification {
  id: number
  title: string
  content: string
  type: string
  read: boolean
  createdAt: string
}

/**
 * Filter map 1-1 với BE NotificationFilter.java.
 *  - type: BOOKING / PROMOTION / SYSTEM
 *  - isRead: true (đã đọc) / false (chưa đọc) / undefined (tất cả)
 *  - createdFrom/To: ISO datetime
 */
export interface NotificationListFilter {
  type?: string
  isRead?: boolean
  createdFrom?: string
  createdTo?: string
  page?: number
  size?: number
}

function cleanParams(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v
  }
  return out
}

/**
 * Dùng cho NotificationBell (dropdown nhỏ — 10 item gần nhất, poll 30s).
 */
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

/**
 * Dùng cho NotificationListPage — phân trang + filter đầy đủ.
 * Không poll vì user đã chủ động vào trang xem.
 */
export function useNotificationsPage(params: NotificationListFilter = {}) {
  return useQuery({
    queryKey: ['notifications', 'page', params],
    queryFn: async () => {
      const cleaned = cleanParams({
        ...params,
        page: params.page ?? 0,
        size: params.size ?? 20,
      })
      const res = await api.get<ApiResponse<PageResponse<Notification>>>('/api/notifications/me', {
        params: cleaned,
      })
      return res.data.data
    },
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
