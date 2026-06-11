# Admin Tools — Recharts + Export + QR Scanner + Toast

> Tổng hợp 4 lib admin-tools dùng riêng trong area `/admin/`: **Recharts** (biểu đồ), **xlsx + jspdf + file-saver** (export), **html5-qrcode** (scan QR check-in), **Sonner** (toast notification).

---

## 1. Recharts — Biểu đồ statistics

`recharts: ^3.8.1` — React chart lib build trên D3. Dashboard admin CineX dùng cho:
- Doanh thu theo ngày (LineChart)
- Top phim/snack (BarChart)
- Tỷ lệ phim T13/T16/T18 (PieChart)
- Lấp đầy ghế theo giờ (AreaChart)

### 1.1. Cài đặt

```bash
npm install recharts
```

### 1.2. Ví dụ LineChart doanh thu

```tsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface RevenuePoint {
  date: string
  bookingRevenue: number
  snackRevenue: number
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#3f382d" />
        <XAxis dataKey="date" stroke="#9ca3af" />
        <YAxis stroke="#9ca3af" tickFormatter={(v) => `${v / 1_000_000}M`} />
        <Tooltip
          contentStyle={{ background: '#201b11', border: '1px solid #3f382d', borderRadius: 8 }}
          formatter={(v: number) => `${v.toLocaleString('vi-VN')}đ`}
        />
        <Legend />
        <Line type="monotone" dataKey="bookingRevenue" stroke="#ffc107" name="Vé" strokeWidth={2} />
        <Line type="monotone" dataKey="snackRevenue" stroke="#10b981" name="Snack" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

### 1.3. Key concepts

- **`ResponsiveContainer`**: auto resize theo parent. KHÔNG dùng width fixed → vỡ trên mobile.
- **`CartesianGrid`**: lưới nền — `strokeDasharray="3 3"` = nét đứt.
- **`stroke="#3f382d"`**: dùng token border CineX để chart match dark theme.
- **`Tooltip.formatter`**: format số (VNĐ + locale).
- **`tickFormatter`**: format trục Y (1,000,000 → 1M).

### 1.4. Custom Tooltip dark theme

```tsx
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload) return null
  return (
    <div className="bg-[#201b11] border border-[#3f382d] rounded-lg p-3 shadow-xl">
      <p className="text-amber-50 font-semibold text-sm mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span style={{ background: p.color, width: 8, height: 8, borderRadius: 999 }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="text-white font-medium">{p.value?.toLocaleString('vi-VN')}đ</span>
        </div>
      ))}
    </div>
  )
}

<Tooltip content={<CustomTooltip />} />
```

### 1.5. CineX charts thực tế

| File | Chart |
|---|---|
| `features/admin/dashboard/RevenueChart.tsx` | LineChart doanh thu 30 ngày |
| `features/admin/dashboard/TopMoviesChart.tsx` | BarChart top 10 phim |
| `features/admin/dashboard/OccupancyChart.tsx` | AreaChart tỷ lệ lấp đầy theo giờ |
| `features/admin/dashboard/PaymentMethodPie.tsx` | PieChart tỷ lệ MoMo/CASH/CARD_POS |

---

## 2. Export Excel + PDF

`xlsx: ^0.18.5`, `jspdf: ^4.2.1`, `jspdf-autotable: ^5.0.8`, `file-saver: ^2.0.5`.

Admin xuất báo cáo cho kế toán/quản lý.

### 2.1. Export Excel (xlsx)

```typescript
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export function exportToExcel<T>(data: T[], fileName: string, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  saveAs(blob, `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// Dùng:
exportToExcel(
  bookings.map(b => ({
    'Mã vé': b.bookingCode,
    'Khách hàng': b.userName,
    'Phim': b.movieTitle,
    'Suất chiếu': fmtDateTime(b.showtimeStart),
    'Tổng tiền': b.totalAmount,
    'Trạng thái': BOOKING_STATUS_LABELS[b.status],
  })),
  'bookings-report'
)
```

→ Download `bookings-report-2026-06-11.xlsx`. Mở Excel/Google Sheets thấy đúng cột tiếng Việt có dấu.

### 2.2. Export PDF (jspdf + jspdf-autotable)

```typescript
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportBookingsToPdf(bookings: BookingResponse[]) {
  const doc = new jsPDF({ orientation: 'landscape' })

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('CineX — Báo cáo đặt vé', 14, 15)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Xuất ngày ${fmtDate(new Date())}`, 14, 22)

  // Table
  autoTable(doc, {
    startY: 30,
    head: [['Mã vé', 'Khách hàng', 'Phim', 'Suất chiếu', 'Tổng tiền', 'Trạng thái']],
    body: bookings.map(b => [
      b.bookingCode,
      b.userName,
      b.movieTitle,
      fmtDateTime(b.showtimeStart),
      fmtVnd(b.totalAmount),
      BOOKING_STATUS_LABELS[b.status],
    ]),
    headStyles: { fillColor: [255, 193, 7] },  // #ffc107 gold
    styles: { fontSize: 9 },
  })

  doc.save(`bookings-${new Date().toISOString().slice(0, 10)}.pdf`)
}
```

### 2.3. Cảnh báo encoding tiếng Việt PDF

`jsPDF` default font `Helvetica` không support Unicode đầy đủ. Tiếng Việt có dấu (`ă`, `ư`) có thể render thành ô vuông.

**Fix:** load font Vietnamese:

```typescript
import jsPDF from 'jspdf'
import 'jspdf-autotable'

// Khi setup app, register Roboto hoặc Times font Vietnamese:
import RobotoRegular from '@/assets/fonts/Roboto-Regular-base64'

doc.addFileToVFS('Roboto-Regular.ttf', RobotoRegular)
doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
doc.setFont('Roboto')
```

Hoặc: chuyển dấu thành không dấu trước export (giải pháp đơn giản).

### 2.4. CineX export thực tế

| File | Mục đích |
|---|---|
| `utils/export.ts` | Helper `exportToExcel<T>()`, `exportToPdf()` |
| `features/admin/booking/BookingsPage.tsx` | Nút "Xuất Excel" / "Xuất PDF" |
| `features/admin/dashboard/RevenueReport.tsx` | Xuất báo cáo doanh thu Excel |

---

## 3. html5-qrcode — Scan QR Check-in

`html5-qrcode: ^2.3.8` — quét QR code qua webcam browser. CineX dùng cho POS check-in:
- Nhân viên cổng dùng laptop có webcam (hoặc điện thoại android browser)
- Quét QR code vé → preview → admit/reject

### 3.1. Cài đặt

```bash
npm install html5-qrcode
```

### 3.2. Component QrScanner

```tsx
import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface Props {
  onScan: (code: string) => void
  onError?: (error: string) => void
}

export function QrScanner({ onScan, onError }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerId = 'qr-scanner-container'

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId)
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },  // camera sau (mobile) hoặc default (laptop)
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        onScan(decodedText)
      },
      (error) => {
        // QR not found mỗi frame — không log spam
      }
    ).catch(err => {
      onError?.(err.message ?? 'Camera access denied')
    })

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(() => { /* ignore */ })
      }
    }
  }, [onScan, onError])

  return <div id={containerId} className="w-full max-w-md mx-auto" />
}
```

### 3.3. Sử dụng trong CheckInPage

```tsx
function CheckInPage() {
  const [bookingCode, setBookingCode] = useState<string | null>(null)
  const { mutate: preview, data: bookingPreview } = useCheckInPreview()

  const handleScan = useCallback((code: string) => {
    setBookingCode(code)
    preview(code)  // call /api/bookings/check-in/preview
  }, [preview])

  return (
    <div>
      {!bookingPreview && <QrScanner onScan={handleScan} />}
      {bookingPreview && (
        <BookingPreviewCard
          booking={bookingPreview}
          onAdmit={() => admit(bookingCode!)}
          onReject={() => reject(bookingCode!)}
        />
      )}
    </div>
  )
}
```

### 3.4. Gotcha

- **HTTPS bắt buộc** cho camera access (trừ localhost). Deploy phải HTTPS.
- **iOS Safari**: yêu cầu user gesture (tap) trước khi access camera.
- **Permission denied**: hiển thị fallback "Nhập mã vé thủ công" → cho phép gõ tay.
- **Cleanup**: phải `scanner.stop()` khi unmount → KHÔNG để camera bật khi rời page.

### 3.5. CineX scanner thực tế

| File | Vai trò |
|---|---|
| `components/common/QrScanner.tsx` | Component scan |
| `features/admin/check-in/CheckInPage.tsx` | Page check-in 2-stage (preview → admit/reject) |

---

## 4. Sonner — Toast notification

`sonner: ^2.0.7` — toast lib đơn giản, đẹp, dark-mode-friendly. CineX dùng thay alert/window.confirm.

### 4.1. Setup

```tsx
// main.tsx hoặc App.tsx
import { Toaster } from 'sonner'

<Toaster position="top-right" theme="dark" richColors />
```

`richColors` → success màu xanh, error đỏ, warning vàng.

### 4.2. Sử dụng

```typescript
import { toast } from 'sonner'

// Success
toast.success('Đặt vé thành công!')

// Error
toast.error('Phiên giữ ghế hết hạn')

// Info
toast.info('Đang xử lý thanh toán...')

// Warning
toast.warning('Còn 30 giây để hoàn tất thanh toán')

// Loading + promise
toast.promise(
  api.post('/api/bookings/confirm', { bookingId }),
  {
    loading: 'Đang xác nhận...',
    success: 'Xác nhận thành công!',
    error: (err) => `Lỗi: ${err.message}`,
  }
)

// Custom action button
toast('Bạn có vé hết hạn trong 5 phút', {
  action: { label: 'Xem vé', onClick: () => navigate('/tickets') }
})
```

### 4.3. Pattern dùng với TanStack Query

```typescript
const { mutate: holdSeats } = useMutation({
  mutationFn: bookingApi.holdSeats,
  onSuccess: () => {
    toast.success('Giữ ghế thành công, vui lòng thanh toán trong 10 phút')
    qc.invalidateQueries({ queryKey: ['showtime', showtimeId, 'seats'] })
  },
  onError: (error: ApiError) => {
    if (error.code === 'SEAT_HELD_BY_OTHER')
      toast.error('Ghế đã được người khác giữ. Vui lòng chọn ghế khác.')
    else
      toast.error(error.message ?? 'Có lỗi xảy ra')
  }
})
```

### 4.4. Vì sao Sonner thay vì react-toastify / react-hot-toast?

| Lib | Pros | Cons |
|---|---|---|
| **Sonner** | Modern, accessible, dark mode built-in, promise toast | API mới (2024) |
| react-toastify | Stable lâu năm | UI cũ, cần tinh chỉnh CSS |
| react-hot-toast | Nhẹ | API phải config nhiều cho dark theme |

CineX chọn Sonner vì hợp design dark + DX cao.

---

## 5. Khi nào dùng cái nào?

| Tình huống | Lib |
|---|---|
| Biểu đồ dashboard | Recharts |
| Báo cáo Excel cho kế toán | xlsx + file-saver |
| In PDF mang đi họp | jspdf + jspdf-autotable |
| Check-in vé tại cổng | html5-qrcode |
| Thông báo ngắn (success/error) | Sonner toast |
| Xác nhận hành động nguy hiểm (delete) | ConfirmDialog (Sonner KHÔNG dùng cho confirm) |

---

## 6. Anti-pattern tránh

### 6.1. ❌ Recharts không trong `ResponsiveContainer`

```tsx
<LineChart width={600} height={300} data={data}>...</LineChart>  // SAI
```

→ Mobile vỡ layout. Luôn wrap `ResponsiveContainer`.

### 6.2. ❌ Export Excel với date object raw

```typescript
{ 'Ngày': booking.createdAt }  // SAI: ISO string khó đọc
```

**Fix:** Format string trước:
```typescript
{ 'Ngày': fmtDateTime(booking.createdAt) }
```

### 6.3. ❌ QrScanner không cleanup

```tsx
useEffect(() => {
  const scanner = new Html5Qrcode(...)
  scanner.start(...)
  // SAI: thiếu cleanup
}, [])
```

→ Camera bật mãi khi rời page → drain battery, vi phạm privacy.

### 6.4. ❌ Sonner toast cho mọi action

```typescript
onClick={() => { toast.info('Đang chuyển trang...'); navigate('/x') }}
```

→ Toast spam → user mệt mỏi. Chỉ toast cho action quan trọng (success/error mutation, warning).

### 6.5. ❌ Dùng `toast.promise` cho mutation đã có UI loading

```typescript
const { mutate, isPending } = useMutation(...)
// UI đã có spinner
toast.promise(mutate())  // SAI: duplicate UX
```

→ User thấy 2 indicator. Chọn 1: spinner inline HOẶC toast promise.

---

## 7. Câu hỏi tự kiểm tra

1. **Tại sao Recharts cần `ResponsiveContainer`?**
   → Auto resize theo parent. Không có → chart fixed size, vỡ trên mobile.

2. **xlsx vs jspdf khác nhau khi nào nên dùng?**
   → xlsx cho file kế toán/quản lý mở chỉnh sửa. jspdf cho file in/share không sửa.

3. **html5-qrcode yêu cầu HTTPS, vì sao?**
   → Browser security policy — chỉ HTTPS mới được access camera (trừ localhost dev).

4. **Tại sao chọn Sonner thay react-toastify?**
   → Modern API, accessible, dark mode built-in, promise toast pattern dễ dùng.

5. **Khi nào dùng `toast.promise` vs `toast.success` + `toast.error` riêng?**
   → `toast.promise` cho async action ngắn (mutation). Nếu mutation đã có UI loading inline → dùng `onSuccess`/`onError` riêng.
