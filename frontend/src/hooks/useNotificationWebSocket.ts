import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'

/**
 * [Observer Pattern] Subscribe WebSocket topic per-user để nhận thông báo mới ngay lập tức.
 *
 * Topic: /topic/user/{username}/notifications
 * Khi BE gọi createNotification() → broadcast lên topic → hook này nhận → invalidate query
 * → React Query tự refetch → bell icon cập nhật ngay, không cần chờ polling 30s.
 *
 * Theo pattern của useSeatWebSocket:
 * - Dùng useRef cho client để tránh re-render không cần thiết
 * - reconnectDelay: 5000 → tự reconnect nếu mất kết nối
 * - cleanup deactivate() khi component unmount hoặc user thay đổi
 */
export function useNotificationWebSocket() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const clientRef = useRef<Client | null>(null)

  useEffect(() => {
    // Chỉ subscribe khi đã đăng nhập
    if (!user?.username) return

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8088'

    const client = new Client({
      webSocketFactory: () => new SockJS(baseUrl + '/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        // Subscribe topic riêng của user — chỉ nhận thông báo của chính mình
        client.subscribe(`/topic/user/${user.username}/notifications`, () => {
          // Thông báo mới đến → invalidate cả 2 query để refetch ngay
          qc.invalidateQueries({ queryKey: ['notifications'] })
        })
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
    }
  }, [user?.username, qc])
}
