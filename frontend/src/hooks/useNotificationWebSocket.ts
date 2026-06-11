import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'

/**
 * [Observer Pattern] Subscribe WebSocket per-user destination để nhận thông báo mới ngay lập tức.
 *
 * Destination: /user/queue/notifications
 * BE gọi messagingTemplate.convertAndSendToUser(username, "/queue/notifications", payload).
 * Spring tự route đến đúng session của user dựa vào Principal đã bind từ JWT (xem
 * StompChannelInterceptor ở BE). Cách này CHỐNG IDOR — user khác không subscribe được
 * topic của mình dù biết username.
 *
 * BẮT BUỘC gửi JWT qua connectHeaders để BE bind được Principal vào STOMP session.
 * Không có Principal → message bị drop, FE không nhận được notification.
 */
export function useNotificationWebSocket() {
  const qc = useQueryClient()
  const { user, token } = useAuthStore()
  const clientRef = useRef<Client | null>(null)

  useEffect(() => {
    // Chỉ subscribe khi đã đăng nhập + có token để BE bind Principal
    if (!user?.username || !token) return

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8088'

    const client = new Client({
      webSocketFactory: () => new SockJS(baseUrl + '/ws'),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      onConnect: () => {
        // Subscribe user destination — Spring tự resolve sang /user/{sessionId}/queue/notifications
        client.subscribe('/user/queue/notifications', () => {
          // Thông báo mới đến → invalidate query để refetch ngay
          qc.invalidateQueries({ queryKey: ['notifications'] })
        })
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
    }
  }, [user?.username, token, qc])
}
