# WebSocket — Giao tiếp real-time

## 1. WebSocket là gì?

### HTTP bình thường (request-response)
```
Client: "Ghế E1 trống không?"  → Server: "Trống"
(3 giây sau)
Client: "Ghế E1 trống không?"  → Server: "Đã giữ"
(3 giây sau)
Client: "Ghế E1 trống không?"  → Server: "Đã giữ"
→ Client phải HỎI liên tục (polling) → tốn tài nguyên, chậm
```

### WebSocket (real-time, 2 chiều)
```
Client mở kết nối WebSocket → giữ kết nối mở liên tục
Server: (khi có thay đổi) → "E1 vừa bị giữ!" → Client nhận NGAY
Server: (30 giây sau)     → "E1 trống lại!"   → Client nhận NGAY
→ Server CHỦ ĐỘNG gửi → không cần client hỏi → nhanh, tiết kiệm
```

### Ví dụ đời thường

**HTTP = gọi điện hỏi thăm:**
- Bạn gọi: "Bạn khỏe không?" → Bạn bè: "Khỏe"
- 5 phút sau gọi lại: "Bạn khỏe không?" → "Khỏe"
- Phải gọi mỗi lần muốn biết → mệt

**WebSocket = nhóm chat Zalo:**
- Bạn và bạn bè cùng trong 1 nhóm chat (kết nối mở)
- Bạn bè gửi tin nhắn → bạn nhận NGAY, không cần hỏi
- Ai trong nhóm cũng nhận cùng lúc

### So sánh

| | HTTP Polling | WebSocket |
|---|---|---|
| **Cách hoạt động** | Client hỏi liên tục mỗi X giây | Server push khi có thay đổi |
| **Độ trễ** | 0 → X giây (phụ thuộc polling interval) | ~100ms (gần real-time) |
| **Tải server** | Cao (100 user × 1 request/3 giây = 33 req/s) | Thấp (chỉ push khi có event) |
| **Kết nối** | Mở → đóng mỗi request | Mở 1 lần → giữ liên tục |
| **Dùng khi** | Data thay đổi ít, không cần nhanh | Chat, game, đặt vé, stock price |

---

## 2. STOMP là gì?

WebSocket chỉ là **ống truyền dữ liệu** — không biết gửi gì, cho ai.
**STOMP** (Simple Text Oriented Messaging Protocol) là **giao thức phía trên WebSocket** — định nghĩa:
- **SUBSCRIBE**: client đăng ký nhận tin từ 1 topic
- **SEND**: client gửi tin đến server
- **MESSAGE**: server gửi tin đến client

```
Không có STOMP:
  WebSocket gửi: "E1 HELD" → Client nhận chuỗi text → tự parse → phức tạp
  Không biết gửi cho ai, topic nào

Có STOMP:
  Client SUBSCRIBE "/topic/showtime/1/seats" → "Tôi muốn nhận cập nhật ghế suất 1"
  Server SEND đến "/topic/showtime/1/seats" → TẤT CẢ subscriber nhận
  → Rõ ràng: ai subscribe topic nào → nhận message của topic đó
```

### SockJS là gì?

**Fallback** khi browser không hỗ trợ WebSocket (browser cũ, corporate proxy chặn):
- WebSocket hoạt động → dùng WebSocket
- WebSocket bị chặn → SockJS tự chuyển sang **long-polling** (HTTP)
- Code FE viết 1 lần, SockJS tự xử lý

---

## 3. Áp dụng trong CineX

### Bài toán
User A và User B cùng xem sơ đồ ghế suất chiếu 1:
- User A hold ghế E1 → User B phải thấy E1 đổi màu **NGAY**, không cần refresh

### Luồng chi tiết

```
1. User B mở trang chọn ghế (suất chiếu 1)
   │
   ├── HTTP: GET /api/showtimes/1/seats → load sơ đồ ghế lần đầu
   │
   └── WebSocket: connect ws://localhost:8088/ws
                  subscribe "/topic/showtime/1/seats"
                  → "Tôi muốn nhận cập nhật ghế suất 1"

2. User A hold ghế E1, E2
   │
   ▼
   BookingService.holdSeats()
   ├── DB: INSERT booking_seats (E1=HELD, E2=HELD)
   └── WebSocket: seatWebSocketService.notifySeatChanged(1, [E1,E2], "HELD")
           │
           ▼
       SimpMessagingTemplate.convertAndSend("/topic/showtime/1/seats", {
           "seatIds": [10, 11],
           "status": "HELD",
           "timestamp": 1716206400000
       })
           │
           ▼
       User B nhận message → FE cập nhật grid → E1, E2 đổi màu xám NGAY

3. User A không thanh toán → 10 phút sau
   │
   ▼
   BookingCleanupScheduler.cleanupExpiredHolds()
   ├── DB: UPDATE booking_seats status = CANCELLED
   └── WebSocket: notifySeatChanged(1, [E1,E2], "AVAILABLE")
           │
           ▼
       User B nhận message → E1, E2 đổi lại màu xanh → ghế trống lại!
```

### 4 sự kiện push WebSocket

| Sự kiện | Khi nào | Status gửi | Ý nghĩa |
|---|---|---|---|
| Hold ghế | User bấm "Giữ ghế" | `HELD` | Ghế đã có người giữ → đổi màu xám |
| Cancel | User hủy đặt vé | `AVAILABLE` | Ghế trả lại → đổi màu xanh |
| Expire | Hết 10 phút không thanh toán | `AVAILABLE` | Ghế trả lại → đổi màu xanh |
| Confirm | Thanh toán thành công | `BOOKED` | Ghế đã đặt chắc → đổi màu đỏ |

---

## 4. Code Backend

### WebSocketConfig.java

```java
@Configuration
@EnableWebSocketMessageBroker  // Bật WebSocket + STOMP
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        //     ↑ Bật simple broker cho prefix "/topic"
        //     Client subscribe "/topic/xxx" → broker gửi message đến
        //     Simple broker = in-memory (đủ cho 1 server)
        //     Production scale → dùng RabbitMQ/Redis broker

        config.setApplicationDestinationPrefixes("/app");
        //     ↑ Prefix cho message từ client → server
        //     Client send "/app/xxx" → server @MessageMapping("/xxx") nhận
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
        //       ↑ FE connect tại: ws://localhost:8088/ws
                .setAllowedOriginPatterns("*")
        //       ↑ CORS: cho phép mọi origin (dev). Production: set domain cụ thể
                .withSockJS();
        //       ↑ Fallback: browser không hỗ trợ WS → dùng long-polling
    }
}
```

### SeatWebSocketService.java

```java
@Service
@RequiredArgsConstructor
public class SeatWebSocketService {

    private final SimpMessagingTemplate messagingTemplate;
    // ↑ Spring cung cấp, gửi message đến STOMP topic

    public void notifySeatChanged(Long showtimeId, List<Long> seatIds, String status) {
        String destination = "/topic/showtime/" + showtimeId + "/seats";
        // ↑ Topic: mỗi suất chiếu có 1 topic riêng
        // User xem suất 1 subscribe topic suất 1 → chỉ nhận update suất 1

        Map<String, Object> message = Map.of(
                "seatIds", seatIds,     // Ghế nào thay đổi
                "status", status,       // HELD / AVAILABLE / BOOKED
                "timestamp", System.currentTimeMillis()
        );

        messagingTemplate.convertAndSend(destination, message);
        // ↑ Gửi message đến TẤT CẢ client đang subscribe topic này
        // Nếu 50 user đang xem suất 1 → cả 50 nhận message
    }
}
```

### BookingService — thêm notify

```java
// Sau khi hold ghế thành công:
seatWebSocketService.notifySeatChanged(showtime.getId(), request.getSeatIds(), "HELD");

// Sau khi cancel:
List<Long> seatIds = booking.getBookingSeats().stream()
        .map(bs -> bs.getSeat().getId()).toList();
seatWebSocketService.notifySeatChanged(booking.getShowtime().getId(), seatIds, "AVAILABLE");
```

---

## 5. Code Frontend (sẽ implement ở task 013)

### Cài thư viện
```bash
npm install @stomp/stompjs sockjs-client
npm install -D @types/sockjs-client
```

### useWebSocket.ts — Custom hook

```typescript
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useEffect, useRef } from 'react';

interface SeatUpdate {
  seatIds: number[];
  status: 'HELD' | 'AVAILABLE' | 'BOOKED';
  timestamp: number;
}

export function useSeatWebSocket(
  showtimeId: number,
  onSeatUpdate: (update: SeatUpdate) => void
) {
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    // 1. Tạo STOMP client
    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8088/ws'),
      // ↑ Connect đến WebSocket endpoint của BE

      onConnect: () => {
        // 2. Subscribe topic ghế của suất chiếu này
        client.subscribe(`/topic/showtime/${showtimeId}/seats`, (message) => {
          const update: SeatUpdate = JSON.parse(message.body);
          onSeatUpdate(update);
          // 3. Callback → SeatMapPage cập nhật grid
        });
      },

      onStompError: (frame) => {
        console.error('WebSocket error:', frame);
      },
    });

    client.activate();  // Mở kết nối
    clientRef.current = client;

    // Cleanup: đóng kết nối khi rời trang
    return () => {
      client.deactivate();
    };
  }, [showtimeId]);
}
```

### SeatMapPage.tsx — Sử dụng hook

```tsx
function SeatMapPage({ showtimeId }: { showtimeId: number }) {
  const [seats, setSeats] = useState<Seat[]>([]);

  // Load sơ đồ ghế lần đầu (HTTP)
  const { data } = useQuery(['seatMap', showtimeId], () => getSeatMap(showtimeId));

  // Subscribe WebSocket — nhận cập nhật real-time
  useSeatWebSocket(showtimeId, (update) => {
    setSeats(prev => prev.map(seat => {
      if (update.seatIds.includes(seat.id)) {
        return { ...seat, status: update.status };
        // Ghế trong danh sách thay đổi → đổi status → React re-render → đổi màu
      }
      return seat;
    }));
  });

  return (
    <div className="seat-grid">
      {seats.map(seat => (
        <SeatButton
          key={seat.id}
          seat={seat}
          color={seat.status === 'HELD' ? 'gray'
               : seat.status === 'BOOKED' ? 'red'
               : 'green'}
        />
      ))}
    </div>
  );
}
```

---

## 6. So sánh: Không WebSocket vs Có WebSocket

```
❌ Không có WebSocket:
User A hold E1     → DB ghi HELD
User B xem sơ đồ  → vẫn thấy E1 xanh (trống) ← SAI!
User B chọn E1     → gọi API → server báo "đã giữ" → UX tệ
User B phải refresh → mới thấy E1 xám

✅ Có WebSocket:
User A hold E1     → DB ghi HELD → WebSocket push "E1 HELD"
User B xem sơ đồ  → nhận push → E1 tự đổi xám NGAY ← ĐÚNG!
User B không chọn E1 → UX tốt, không bị lỗi
```

---

## 7. Câu hỏi thường gặp

**1. WebSocket có thay thế HTTP API không?**
→ KHÔNG. WebSocket chỉ dùng cho **push real-time**. CRUD vẫn dùng HTTP REST.

**2. Server restart thì WebSocket mất kết nối không?**
→ CÓ. FE cần auto-reconnect (STOMP client hỗ trợ sẵn `reconnectDelay`).

**3. 1000 user cùng xem 1 suất chiếu → server chịu được không?**
→ Simple broker (in-memory) chịu được ~1000 connections. Scale lên → dùng RabbitMQ broker.

**4. WebSocket có cần JWT auth không?**
→ Hiện tại không (public topic). Nếu cần → thêm `ChannelInterceptor` verify token khi CONNECT.

**5. Tại sao dùng `/topic/showtime/{id}/seats` thay vì `/topic/seats`?**
→ Mỗi suất chiếu có sơ đồ ghế riêng. User xem suất 1 không cần nhận update suất 2 → tách topic theo showtimeId.

**6. Khác gì giữa `/topic` và `/queue`?**
→ `/topic` = broadcast (1 → nhiều subscriber). `/queue` = point-to-point (1 → 1 user cụ thể).
