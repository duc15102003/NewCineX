import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useEffect, useRef } from 'react'

interface SeatUpdate {
  seatIds: number[]
  status: string
  timestamp: number
}

export function useSeatWebSocket(
  showtimeId: number,
  onSeatUpdate: (update: SeatUpdate) => void,
) {
  const clientRef = useRef<Client | null>(null)
  // Dùng ref để tránh infinite loop khi onSeatUpdate thay đổi reference mỗi render
  const callbackRef = useRef(onSeatUpdate)
  callbackRef.current = onSeatUpdate

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8088'
    const client = new Client({
      webSocketFactory: () => new SockJS(baseUrl + '/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/showtime/${showtimeId}/seats`, (message) => {
          const update: SeatUpdate = JSON.parse(message.body)
          callbackRef.current(update)
        })
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
    }
  }, [showtimeId])
}
