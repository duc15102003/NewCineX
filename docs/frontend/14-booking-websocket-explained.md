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
