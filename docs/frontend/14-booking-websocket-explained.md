# Feature Booking + WebSocket — Giải thích chi tiết

## 1. Tổng quan

Luồng đặt vé end-to-end từ góc nhìn FE:

```
Chi tiết phim → bấm "Đặt vé"
    → Chọn ghế (WebSocket real-time) → bấm "Giữ ghế"
    → Thanh toán (chọn VNPAY/CASH) → bấm "Thanh toán"
    → Kết quả (QR code + thông tin vé)
    → Lịch sử vé → Chi tiết vé → Hủy vé
```

## 2. Trang chọn ghế — SeatSelectionPage

### Luồng khi mở trang

```
User bấm "Đặt vé" ở suất chiếu ID = 5
    → navigate /booking/seats/5
    │
    ▼
SeatSelectionPage.tsx:
    const { id: showtimeId } = useParams()    // showtimeId = 5
    │
    ├── 1. useShowtimeSeatMap(5) → 2 API calls:
    │       GET /api/showtimes/5      → showtime info (movie, room, prices)
    │       GET /api/rooms/3/seats    → sơ đồ ghế (rows A-J, cols 1-12)
    │
    ├── 2. useSeatWebSocket(5) → WebSocket connect:
    │       ws://localhost:8088/ws
    │       subscribe /topic/showtime/5/seats
    │       → Nhận real-time: { seatIds: [10,11], status: "HELD" }
    │
    └── 3. Render sơ đồ ghế:
            Mỗi ghế = 1 button, màu theo trạng thái
```

### Sơ đồ ghế — màu sắc

```
    1   2   3   4   5   6   7   8   9  10  11  12
A  [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢]  ← STANDARD (xanh)
B  [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢]
C  [🟢] [🟢] [🔴] [🔴] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢]  ← 🔴 = đã đặt/đang giữ (người khác)
D  [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢]
E  [🟡] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡]  ← VIP (vàng)
F  [🟡] [🟡] [🟡] [🔶] [🔶] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡]  ← 🔶 = đang chọn (user hiện tại)
G  [🟡] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡] [🟡]
H  [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢]
I  [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢] [🟢]
J  [🟣] [🟣] [🟣] [🟣] [🟣] [🟣] [⬛] [⬛] [⬛] [⬛] [⬛] [⬛]  ← 🟣 COUPLE, ⬛ BROKEN

                         === MÀN HÌNH ===

Chú thích:
🟢 STANDARD trống     🟡 VIP trống         🟣 COUPLE trống
🔶 Đang chọn          🔴 Đã đặt/đang giữ  ⬛ Ghế hỏng (không click được)
```

### WebSocket real-time — ghế đổi màu ngay

```
User A đang xem sơ đồ ghế suất 5
User B (máy khác) hold ghế E1, E2

Server:
    BookingService.holdSeats() → save DB
    → seatWebSocketService.notifySeatChanged(5, [E1,E2], "HELD")
    → SimpMessagingTemplate.convertAndSend("/topic/showtime/5/seats", message)

User A FE:
    useSeatWebSocket(5, (update) => {
        // update = { seatIds: [E1, E2], status: "HELD" }
        // → Cập nhật state → E1, E2 đổi từ 🟡 → 🔴 NGAY LẬP TỨC
        // → User A không cần refresh trang
    })
```

```typescript
// hooks/useWebSocket.ts
export function useSeatWebSocket(showtimeId, onSeatUpdate) {
    useEffect(() => {
        const client = new Client({
            webSocketFactory: () => new SockJS('http://localhost:8088/ws'),
            // ↑ Connect WebSocket endpoint

            onConnect: () => {
                client.subscribe(`/topic/showtime/${showtimeId}/seats`, (message) => {
                    const update = JSON.parse(message.body)
                    onSeatUpdate(update)
                    // ↑ Callback → SeatSelectionPage cập nhật grid
                })
            },
        })
        client.activate()
        return () => client.deactivate()  // Rời trang → đóng kết nối
    }, [showtimeId])
}
```

### Hold ghế + navigate thanh toán

```
User chọn ghế F4, F5 → bấm "Giữ ghế"
    │
    ▼
useHoldSeats().mutate({ showtimeId: 5, seatIds: [F4, F5], voucherCode: "KHAI_TRUONG" })
    │  POST /api/bookings/hold
    │  → Backend: check ghế trống → tạo booking HOLDING → trả bookingId
    │
    ▼
onSuccess: navigate(`/payment/${bookingId}`)
    → Chuyển sang trang thanh toán
```

## 3. Trang thanh toán — PaymentPage

```
/payment/1 (bookingId = 1)
    │
    ├── useBookingDetail(1) → GET /api/bookings/1
    │   → { movieTitle, startTime, roomName, seats: [{F4, VIP, 100k}, {F5, VIP, 100k}], totalAmount: 200k }
    │
    ├── Render:
    │   ┌────────────────────────────────────┐
    │   │ Avengers: Endgame                  │
    │   │ 14:00 - 16:45 | Room IMAX         │
    │   │                                    │
    │   │ Ghế F4 (VIP)      100.000đ        │
    │   │ Ghế F5 (VIP)      100.000đ        │
    │   │ ─────────────────────────          │
    │   │ Tổng:             200.000đ        │
    │   │                                    │
    │   │ ○ VNPay    ● Tiền mặt tại quầy   │
    │   │                                    │
    │   │         [ Thanh toán ]             │
    │   └────────────────────────────────────┘
    │
    └── Bấm "Thanh toán":
        useCreatePayment({ bookingId: 1, paymentMethod: "VNPAY" })
        → POST /api/payments/create → { paymentUrl: "http://...callback?..." }
        → window.location.href = paymentUrl (redirect ra VNPay)
        → VNPay xong → redirect về /payment/result?transactionCode=PAY-001&status=SUCCESS
```

## 4. Trang kết quả — PaymentResultPage

```
/payment/result?bookingId=1
    │
    ├── useTicket(1) → GET /api/bookings/1/ticket
    │   → { bookingCode, movieTitle, seats, qrCodeBase64: "iVBOR..." }
    │
    └── Render:
        ┌────────────────────────────────────┐
        │      ✅ Đặt vé thành công!         │
        │                                    │
        │    [QR CODE - CX-20260524-001]     │  ← react-qr-code component
        │                                    │
        │    Mã vé: CX-20260524-001          │
        │    Avengers: Endgame               │
        │    14:00 | Room IMAX               │
        │    Ghế: F4, F5                     │
        │    Tổng: 200.000đ                  │
        │                                    │
        │    [ Xem vé của tôi ]              │
        └────────────────────────────────────┘
```

## 5. Lịch sử vé — MyTicketsPage

```
/my-tickets
    │
    ├── useMyBookings(page) → GET /api/bookings/me?page=0&size=10
    │
    └── Render danh sách card:
        ┌─────────────────────────────────────────────┐
        │ [poster]  Avengers: Endgame                 │
        │           24/05 14:00 | Room IMAX           │
        │           2 ghế | 200.000đ                  │
        │           [🟢 Đã xác nhận]                  │
        └─────────────────────────────────────────────┘

        Badge trạng thái:
        🟠 HOLDING     = đang chờ thanh toán
        🟢 CONFIRMED   = đã thanh toán
        🔵 CHECKED_IN  = đã check-in
        🔴 CANCELLED   = đã hủy
        ⚪ EXPIRED     = hết hạn hold
```

## 6. Profile — ProfilePage

```
/profile
    │
    ├── useProfile() → GET /api/users/me
    │   → { username, email, fullName, phone, role }
    │
    ├── Form sửa thông tin:
    │   ┌──────────────────────────────┐
    │   │ Họ tên:  [Vũ Tường An    ]  │
    │   │ SĐT:    [0901234567     ]  │
    │   │          [ Cập nhật ]        │
    │   └──────────────────────────────┘
    │   → useUpdateProfile({ fullName, phone })
    │   → PUT /api/users/me
    │
    └── Form đổi mật khẩu:
        ┌──────────────────────────────┐
        │ Mật khẩu cũ:  [••••••    ]  │
        │ Mật khẩu mới: [••••••    ]  │
        │ Xác nhận:     [••••••    ]  │
        │          [ Đổi mật khẩu ]    │
        └──────────────────────────────┘
        → useChangePassword({ oldPassword, newPassword, confirmPassword })
        → PUT /api/users/me/password
```

## 7. Câu hỏi tự kiểm tra

1. **WebSocket khác HTTP ở điểm nào?** → HTTP: client hỏi → server trả. WebSocket: server chủ động push → client nhận ngay. Không cần client hỏi liên tục.

2. **Ghế đổi màu real-time mà không refresh — do đâu?** → WebSocket subscribe topic → nhận message → update React state → component re-render → UI đổi.

3. **VNPAY thanh toán xong → quay về app bằng cách nào?** → VNPay redirect browser về URL callback (`/payment/result?transactionCode=...`) → FE đọc param → hiển thị kết quả.

4. **Tại sao QR code dùng react-qr-code thay vì gọi API lấy ảnh?** → Render QR ở FE nhanh hơn (không cần HTTP round-trip). Backend chỉ trả bookingCode text, FE tự sinh QR.

5. **User A hold ghế → User B thấy ngay — cần mấy bước?** → 3 bước: (1) BE save DB, (2) BE push WebSocket, (3) FE nhận message → update state → re-render.

---

## 6. STOMP Protocol — Giải thích sâu

WebSocket là kênh truyền nhị phân/text 2 chiều. Tự dùng raw WebSocket không có khái niệm "subscribe topic", "ai nhận message nào". STOMP (Simple Text Oriented Messaging Protocol) là protocol cao hơn, chạy TRÊN WebSocket, thêm khái niệm pub/sub.

### Các frame chính
- **CONNECT**: client gửi đầu tiên, kèm credentials.
- **CONNECTED**: server trả về.
- **SUBSCRIBE**: client xin nhận message từ destination (vd `/topic/showtime/10/seats`).
- **SEND**: client gửi message đến destination.
- **MESSAGE**: server push xuống client (sau khi có ai SEND đến topic mà client đã SUBSCRIBE).
- **UNSUBSCRIBE**: client bỏ subscribe.
- **DISCONNECT**: đóng kết nối lịch sự.

### Ví dụ frame raw
```
SUBSCRIBE
id:sub-0
destination:/topic/showtime/10/seats

^@
```

`^@` là null byte kết thúc frame.

### Vì sao STOMP thay vì raw WebSocket
- Raw WS: bạn phải tự định nghĩa format message (JSON với `type` field), tự route message theo channel.
- STOMP: chuẩn sẵn có, server Spring có `SimpMessagingTemplate` để broadcast đến topic, client `@stomp/stompjs` có API subscribe.

---

## 7. SockJS Fallback

Một số corporate network, browser cũ chặn WebSocket. Giải pháp: **SockJS** — thử WebSocket trước, fallback sang HTTP streaming hoặc long-polling nếu fail.

```ts
import SockJS from "sockjs-client";

const client = new Client({
  webSocketFactory: () => new SockJS("http://localhost:8088/ws"),
  // ↑ KHÔNG dùng ws:// URL trực tiếp, dùng http:// → SockJS xử lý
});
```

Server Spring bật SockJS endpoint:
```java
registry.addEndpoint("/ws").withSockJS();
```

Trade-off: SockJS chậm hơn raw WS một chút (frame overhead), nhưng tương thích rộng.

---

## 8. Cấu hình Client đầy đủ

```ts
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

export function createStompClient(token: string) {
  return new Client({
    webSocketFactory: () => new SockJS(`${import.meta.env.VITE_API_BASE_URL}/ws`),

    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },

    debug: (msg) => {
      if (import.meta.env.DEV) console.log("[STOMP]", msg);
    },

    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,

    onConnect: () => {
      console.log("STOMP connected");
    },

    onStompError: (frame) => {
      console.error("STOMP error", frame.headers["message"], frame.body);
    },

    onWebSocketError: (event) => {
      console.error("WS error", event);
    },

    onWebSocketClose: () => {
      console.warn("WS closed");
    },
  });
}
```

Giải thích từng option:
- `webSocketFactory`: factory tạo WebSocket (qua SockJS).
- `connectHeaders`: gắn auth token vào CONNECT frame.
- `debug`: log frame raw, useful khi develop.
- `reconnectDelay`: 5s sau khi disconnect tự reconnect.
- `heartbeatIncoming`/`heartbeatOutgoing`: ping-pong 4s/lần để detect dead connection.
- `onConnect`: callback khi CONNECTED → đây là chỗ subscribe topic.
- `onStompError`: STOMP-level error (auth fail, destination invalid).
- `onWebSocketError`: TCP-level error.
- `onWebSocketClose`: khi connection closed (sẽ trigger reconnect).

---

## 9. Reconnect strategy

`reconnectDelay: 5000` → mỗi lần đóng, đợi 5s rồi connect lại.

**Cảnh báo**: nếu server down 1 ngày → client reconnect mãi mãi, log đầy console. Nên cap số lần retry:

```ts
let retryCount = 0;
const MAX_RETRIES = 10;

const client = new Client({
  ...
  onWebSocketClose: () => {
    retryCount++;
    if (retryCount >= MAX_RETRIES) {
      client.deactivate();
      showToast("Mất kết nối server, vui lòng refresh.");
    }
  },
  onConnect: () => {
    retryCount = 0;  // reset khi reconnect thành công
  },
});
```

**Exponential backoff** thay vì cố định 5s:
```ts
const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
// 1s, 2s, 4s, 8s, 16s, 30s (cap)
```

Giảm áp lực server khi nhiều client cùng reconnect (thundering herd).

---

## 10. Heartbeat

STOMP heartbeat: 2 phía định kỳ gửi tin nhắn nhỏ để confirm connection còn sống.

```ts
heartbeatIncoming: 4000,  // expect server ping mỗi 4s
heartbeatOutgoing: 4000,  // client ping server mỗi 4s
```

Nếu 2 lần ping không response → connection coi như chết → client trigger reconnect.

**Cảnh báo Nginx**: default `proxy_read_timeout: 60s`. Nếu WebSocket idle 60s → Nginx đóng → client mất kết nối ngẫu nhiên. Fix:
```nginx
location /ws {
    proxy_pass http://backend:8088;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;  # 1 giờ
}
```

---

## 11. Hold Countdown Timer chi tiết

Yêu cầu: sau khi hold ghế, hiển thị countdown 10:00 → 00:00. Khi 0 → ghế tự release.

```tsx
function useHoldCountdown(expiresAt: Date | null) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    const tick = () => {
      const diff = Math.max(0, expiresAt.getTime() - Date.now());
      setRemaining(diff);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return { remaining, formatted: `${minutes}:${seconds.toString().padStart(2, "0")}` };
}
```

Dùng:
```tsx
const { remaining, formatted } = useHoldCountdown(booking?.expiresAt);

return <div className="text-2xl font-mono text-[#eab308]">{formatted}</div>;
```

### Cảnh báo stale closure
Nếu viết:
```ts
useEffect(() => {
  setInterval(() => {
    // expiresAt capture ở đây, không update khi prop đổi
    const diff = expiresAt.getTime() - Date.now();
  }, 1000);
}, []);  // ← dep array rỗng → closure stale
```

Khi `expiresAt` prop thay đổi (user hold ghế khác), interval cũ vẫn dùng giá trị cũ → countdown sai.

**Fix**: dependency array bao gồm `expiresAt` (như code ở trên), hoặc dùng `useRef` để cập nhật giá trị mới nhất.

---

## 12. Race Condition: User A vs B cùng click

Timeline:
```
T+0    A click A1                    | UI A: optimistic A1 = HELD_BY_ME (vàng)
T+50   A POST /bookings              | B click A1 (chưa nhận WebSocket)
                                     | UI B: optimistic A1 = HELD_BY_ME (vàng)
T+80   BE A: lock A1, save HELD       |
T+100  BE A trả 201 OK               | BE B POST /bookings
T+110  BE WS broadcast A1=HELD        |
T+150  A nhận confirm OK              | BE B: A1 đã HELD → 409 CONFLICT
T+160                                 | UI B: nhận error → revert A1 (rerender)
T+170                                 | UI B: toast "Ghế đã có người chọn"
T+180                                 | UI B: nhận WS A1=HELD → confirm
```

### Code handle ở client
```tsx
const holdMutation = useMutation({
  mutationFn: (seatIds: number[]) => api.post("/bookings", { showtimeId, seatIds }),

  onMutate: (seatIds) => {
    // Optimistic UI
    setSeatStatus(seatIds, "HELD_BY_ME");
    return { previousSeatIds: seatIds };
  },

  onSuccess: () => {
    // BE confirm OK — không cần làm gì, WebSocket sẽ broadcast
  },

  onError: (err, _, context) => {
    // Revert
    if (context?.previousSeatIds) {
      setSeatStatus(context.previousSeatIds, "AVAILABLE");
    }
    toast.error("Một số ghế đã có người chọn, vui lòng thử lại.");
  },
});
```

---

## 13. Optimistic UI Pattern

Mặc định: click ghế → POST → đợi response → cập nhật UI. User thấy delay 200-500ms → cảm giác chậm.

Optimistic UI: click ghế → cập nhật UI NGAY → POST nền → response OK giữ nguyên / Fail revert.

Lợi ích: UX mượt, feel realtime.

Trade-off: phải code logic revert + lỗi tiềm ẩn nếu user click vào trạng thái optimistic chưa confirm.

CineX dùng optimistic cho seat selection: ghế đổi màu ngay, WebSocket broadcast về sau confirm với mọi user khác.

---

## 14. Payment Callback Handling

### Sequence
```
BookingPage → click "Thanh toán"
    ↓
POST /api/payments { bookingId, method: "MOMO" }
    ↓
BE trả { paymentUrl: "https://test-payment.momo.vn/..." }
    ↓
FE: window.location.href = paymentUrl
    ↓
User được redirect sang MoMo, nhập OTP/PIN
    ↓
MoMo callback redirect về:
    /payment/result?status=success&bookingCode=CX-...&signature=...
    ↓
PaymentResultPage đọc query
    ↓
QUAN TRỌNG: KHÔNG TRUST query string!
    Hacker có thể fake "status=success" trong URL.
    ↓
Gọi API: GET /api/bookings/CX-.../status
    ↓
BE đối chiếu với DB (BE nhận callback IPN từ MoMo riêng → đã verify signature)
    ↓
Trả status thật → FE hiển thị success/fail
```

### Code mẫu PaymentResultPage
```tsx
function PaymentResultPage() {
  const [params] = useSearchParams();
  const bookingCode = params.get("bookingCode");

  const { data, isLoading } = useQuery({
    queryKey: ["booking-status", bookingCode],
    queryFn: () => api.get(`/api/bookings/${bookingCode}/status`),
    enabled: !!bookingCode,
    refetchInterval: (data) => data?.status === "CONFIRMED" ? false : 2000,
    // Poll mỗi 2s đến khi CONFIRMED (BE chưa nhận callback IPN)
  });

  if (isLoading) return <Loading />;
  if (data?.status === "CONFIRMED") return <SuccessView booking={data} />;
  if (data?.status === "CANCELLED") return <FailView />;
  return <PendingView />;  // đang chờ callback từ MoMo
}
```

---

## 15. WebSocket trong React StrictMode dev

StrictMode (dev only) cố tình chạy `useEffect` 2 lần để phát hiện side effect không idempotent.

```tsx
useEffect(() => {
  const client = createStompClient();
  client.activate();
  return () => client.deactivate();
}, []);
```

Trong dev: hook chạy 2 lần → tạo 2 client → 2 connection → server log thấy 2 user connect.

### Fix
```tsx
const clientRef = useRef<Client | null>(null);
const connected = useRef(false);

useEffect(() => {
  if (connected.current) return;
  connected.current = true;

  const client = createStompClient();
  clientRef.current = client;
  client.activate();

  return () => {
    client.deactivate();
    connected.current = false;
  };
}, []);
```

Hoặc đơn giản: chấp nhận 2 connection trong dev (StrictMode không affect production).

---

## 16. Multiple Topic Subscription

User mở 2 tab browser xem 2 showtime khác → mỗi tab subscribe topic riêng.

```tsx
// BookingPage tab 1
client.subscribe("/topic/showtime/10/seats", handleSeatUpdate);

// BookingPage tab 2 (URL khác)
client.subscribe("/topic/showtime/20/seats", handleSeatUpdate);
```

Backend khi 1 user hold ghế ở showtime 10 → `messagingTemplate.convertAndSend("/topic/showtime/10/seats", payload)` → CHỈ tab subscribe topic này nhận.

---

## 17. Cancel Booking Flow

```tsx
const cancelMutation = useMutation({
  mutationFn: (bookingId: number) => api.post(`/api/bookings/${bookingId}/cancel`),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    toast.success("Đã hủy vé");
  },
});

<ConfirmDialog
  title="Hủy vé"
  description="Bạn chắc chắn? Phí hoàn = giá vé × 80% nếu trước 2 giờ."
  onConfirm={() => cancelMutation.mutate(booking.id)}
/>
```

Backend: kiểm tra điều kiện (chưa qua showtime, chưa CHECKED_IN, còn ít nhất 2h trước giờ chiếu) → refund nếu đã thanh toán → broadcast WebSocket trạng thái mới.

---

## 18. Check-in Admin Flow

```tsx
import { Html5Qrcode } from "html5-qrcode";

function CheckInPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },  // camera sau
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      onScanError
    );

    return () => {
      scanner.stop().catch(() => {});
    };
  }, []);

  const onScanSuccess = async (bookingCode: string) => {
    try {
      const booking = await api.post(`/api/bookings/${bookingCode}/check-in`);
      showSuccess(booking);
    } catch (err) {
      showError(err);
    }
  };

  return <div id="qr-reader" className="w-full max-w-md" />;
}
```

---

## 19. Common pitfalls WebSocket

| Pitfall | Hậu quả | Fix |
|---|---|---|
| Quên cleanup | Ghost connection, memory leak | `return () => client.deactivate()` |
| Subscribe trong render | Subscribe lại mỗi re-render | Đưa vào `useEffect` |
| State trong closure cũ | Countdown sai sau prop đổi | Dep array đầy đủ hoặc useRef |
| Subscribe trước connected | Message lost | Subscribe trong `onConnect` callback |
| Nginx timeout không config | Disconnect 60s/lần | `proxy_read_timeout 3600s` |
| Token expire khi connected | 401 khi reconnect | Refresh token trước khi reconnect |
| `useState` cho remaining time | Re-render mỗi giây cho toàn page | Tách hook, hoặc memo |

---

## 20. Câu hỏi tự kiểm tra mở rộng

**Câu 6**: STOMP và WebSocket khác nhau ở điểm gì?

→ WebSocket là transport layer (kênh truyền). STOMP là application protocol chạy trên WebSocket, thêm khái niệm subscribe/destination/frame structure. Tương tự HTTP chạy trên TCP.

**Câu 7**: Tại sao cần SockJS dù trình duyệt hiện đại đều hỗ trợ WebSocket?

→ Corporate network/proxy có thể chặn WebSocket. SockJS fallback HTTP streaming/long-polling → tương thích rộng. Trade-off: chậm hơn raw WS một chút.

**Câu 8**: Heartbeat 4 giây cần để làm gì? Nếu không có?

→ Detect dead connection. TCP có thể giữ socket open dù phía bên kia đã chết → client gửi message → mất. Heartbeat ping pong → 2 phía biết connection còn sống. Không có → mất message âm thầm.

**Câu 9**: Stale closure trong countdown timer xảy ra khi nào?

→ `setInterval` callback capture biến lúc tạo. Nếu deps array thiếu biến → callback dùng giá trị cũ. Khi prop đổi (vd user hold ghế khác → `expiresAt` mới), interval cũ vẫn dùng `expiresAt` cũ → countdown sai.

**Câu 10**: Optimistic UI cho seat selection: nếu BE reject thì sao?

→ Revert state về AVAILABLE + toast lỗi. Optimistic là cá cược "thường thành công", có rủi ro phải undo. Trade-off với UX mượt.

**Câu 11**: Tại sao KHÔNG trust query string `?status=success` trong payment callback?

→ Hacker copy URL "success" và truy cập trực tiếp. Server callback IPN từ MoMo về backend là kênh đáng tin (có signature). Frontend phải query API status thực từ DB, không tin URL.

**Câu 12**: StrictMode khiến WebSocket connect 2 lần trong dev. Có cần fix không?

→ Production không có StrictMode → không affect user. Dev: chấp nhận hoặc dùng `useRef` flag. Quan trọng nhất là CLEANUP đúng (`return () => client.deactivate()`) để không leak khi unmount thật.
