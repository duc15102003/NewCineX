import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Clock, ShieldCheck, Lock } from 'lucide-react'
import { useBookingDetail, useCreatePayment } from '@/hooks/useBooking'
import { usePublicConfigNumber } from '@/hooks/useConfig'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Loading from '@/components/common/Loading'
import BookingSteps from './components/BookingSteps'
import { fmtDateTime, label, ROOM_TYPE_LABELS, LOYALTY_TIER_LABELS, fmtVnd } from '@/utils/labels'
import { SEAT_TYPE_PRICE_TEXT, ROOM_TYPE_TEXT } from '@/utils/colors'

const PAYMENT_METHODS = [
  {
    value: 'MOMO',
    label: 'MoMo',
    description: 'Thanh toán qua ví MoMo (QR, ví điện tử)',
    icon: '📱',
  },
]

export default function PaymentPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()
  const id = Number(bookingId)

  const { data: booking, isLoading } = useBookingDetail(id)
  usePageTitle(booking ? `Thanh toán vé ${booking.bookingCode}` : 'Thanh toán')
  const createPayment = useCreatePayment()
  const [selectedMethod, setSelectedMethod] = useState('MOMO')

  const { data: holdMinutes = 10 } = usePublicConfigNumber('booking.hold_minutes', 10)

  // Countdown timer — vé HOLDING sẽ EXPIRE sau holdMinutes phút từ createdAt.
  // useEffect setInterval mỗi giây; cleanup khi unmount tránh leak. Hết giờ → redirect.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!booking || booking.status !== 'HOLDING') return
    const expiresAt = new Date(booking.createdAt).getTime() + holdMinutes * 60_000
    const update = () => {
      const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) {
        navigate('/movies', { replace: true })
      }
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [booking, holdMinutes, navigate])

  // beforeunload warning khi booking đang HOLDING — đóng tab giữa chừng = mất ghế đã giữ.
  useEffect(() => {
    if (!booking || booking.status !== 'HOLDING') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [booking])

  const formatCountdown = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  async function handlePayment() {
    try {
      const result = await createPayment.mutateAsync({
        bookingId: id,
        paymentMethod: selectedMethod,
      })
      if (result.paymentUrl) {
        // Chuyển sang cổng thanh toán
        window.location.href = result.paymentUrl
      } else {
        // Tiền mặt → trang kết quả
        navigate(`/payment/result?bookingId=${id}`)
      }
    } catch {
      // Toast generic đã hiện từ hook onError. Show thêm action "Thử lại"
      // để user retry ngay — đặc biệt khi network hiccup giữa lúc đếm
      // ngược, đỡ phải scroll xuống click nút (mobile UX).
      toast.error('Khởi tạo thanh toán thất bại', {
        action: { label: 'Thử lại', onClick: () => handlePayment() },
        duration: 10_000,
      })
    }
  }

  if (isLoading) return <Loading />

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#181309] flex items-center justify-center">
        <p className="text-red-400">Không tìm thấy đơn đặt vé.</p>
      </div>
    )
  }

  // Đã hết hạn HOLD → vé bị BE auto-cancel, button thanh toán không nên click
  // được nữa. useEffect cũng redirect khi secondsLeft = 0, nhưng vẫn defensive
  // ở UI tránh race condition giữa timer tick và click.
  const isExpired = booking.status === 'HOLDING' && secondsLeft === 0
  const canPay = booking.status === 'HOLDING' && !isExpired && !createPayment.isPending

  return (
    <div className="min-h-screen bg-[#181309] text-white pb-10 px-4">
      <BookingSteps current={2} />
      <div className="max-w-2xl mx-auto space-y-6">

        <h1 className="text-2xl font-bold text-center text-[#ffc107]">Thanh toán vé</h1>

        {/* Countdown timer — chỉ hiện khi booking đang HOLDING. Đỏ khi <2 phút. */}
        {booking.status === 'HOLDING' && secondsLeft !== null && (
          <div
            className={`flex items-center justify-center gap-2 rounded-xl border p-4 ${
              secondsLeft < 120
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-[#ffc107]/10 border-[#ffc107]/30 text-[#ffc107]'
            }`}
            role="status"
            aria-live="polite"
          >
            <Clock size={18} />
            <span className="text-sm">Hoàn tất thanh toán trong</span>
            <span className="text-2xl font-mono font-bold tabular-nums">
              {formatCountdown(secondsLeft)}
            </span>
          </div>
        )}

        {/* Thông tin vé */}
        <Card className="bg-[#201b11] border-white/5 text-white">
          <CardHeader>
            <CardTitle className="text-lg text-gray-100">Thông tin suất chiếu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Phim</span>
              <span className="font-medium text-right max-w-xs">{booking.movieTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Giờ chiếu</span>
              <span className="font-medium">{fmtDateTime(booking.startTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Phòng</span>
              <span className="font-medium">{booking.roomName} (<span className={ROOM_TYPE_TEXT[booking.roomType] ?? ''}>{label(ROOM_TYPE_LABELS, booking.roomType)}</span>)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Mã đặt vé</span>
              <span className="font-mono text-[#ffc107]">{booking.bookingCode}</span>
            </div>

            {/* Danh sách ghế */}
            <div>
              <p className="text-gray-400 mb-2">Ghế đã chọn</p>
              <div className="flex flex-wrap gap-1.5">
                {booking.seats.map(s => (
                  <Badge key={s.seatId} variant="outline" className="text-xs border-white/10 text-gray-200">
                    {s.seatNumber} — <span className={`ml-0.5 font-semibold ${SEAT_TYPE_PRICE_TEXT[s.seatType] ?? ''}`}>{fmtVnd(s.price)}</span>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-3 space-y-1.5">
              {booking.tierDiscountAmount != null && booking.tierDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Ưu đãi hạng {booking.tierAtBooking ? label(LOYALTY_TIER_LABELS, booking.tierAtBooking) : ''}</span>
                  <span>−{fmtVnd(booking.tierDiscountAmount)}</span>
                </div>
              )}
              {booking.groupDiscountAmount != null && booking.groupDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Giảm giá nhóm ({booking.seats.length} vé)</span>
                  <span>−{fmtVnd(booking.groupDiscountAmount)}</span>
                </div>
              )}
              {booking.loyaltyDiscountAmount != null && booking.loyaltyDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Đổi {booking.pointsRedeemed?.toLocaleString('vi-VN')} điểm</span>
                  <span>−{fmtVnd(booking.loyaltyDiscountAmount)}</span>
                </div>
              )}
              {booking.subtotalAmount != null && booking.vatAmount != null && (
                <>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Tạm tính</span>
                    <span>{fmtVnd(booking.subtotalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>VAT {booking.vatPercent != null ? `(${Number(booking.vatPercent).toFixed(0)}%)` : ''}</span>
                    <span>{fmtVnd(booking.vatAmount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-semibold text-base pt-1.5 border-t border-white/5">
                <span>Tổng tiền</span>
                <span className="text-[#ffc107] text-lg">{fmtVnd(booking.totalAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chọn phương thức thanh toán */}
        <Card className="bg-[#201b11] border-white/5 text-white">
          <CardHeader>
            <CardTitle className="text-lg text-gray-100">Phương thức thanh toán</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {PAYMENT_METHODS.map(method => (
              <label
                key={method.value}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  selectedMethod === method.value
                    ? 'border-[#ffc107] bg-[#ffc107]/10'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.value}
                  checked={selectedMethod === method.value}
                  onChange={() => setSelectedMethod(method.value)}
                  className="mt-0.5 accent-[#ffc107]"
                />
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <span>{method.icon}</span>
                    <span>{method.label}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{method.description}</p>
                </div>
              </label>
            ))}
          </CardContent>
        </Card>

        {/* Nút thanh toán */}
        <Button
          onClick={handlePayment}
          loading={createPayment.isPending}
          disabled={!canPay}
          className="w-full bg-[#ffc107] hover:bg-[#e6ac06] text-black font-bold h-12 text-base disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed"
        >
          <Lock size={16} className="mr-2" />
          {createPayment.isPending
            ? 'Đang xử lý...'
            : isExpired
              ? 'Vé đã hết hạn — chọn lại ghế'
              : `Thanh toán an toàn ${fmtVnd(booking.totalAmount)}`}
        </Button>

        {/* Trust signals — pattern e-commerce: lock icon + mã hóa + redirect MoMo */}
        <div className="flex flex-col items-center gap-2 text-xs text-gray-400 pt-1">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-green-400" />
            <span>Giao dịch mã hóa SSL/TLS — không lưu thông tin thẻ</span>
          </div>
          <p className="text-center text-gray-500">
            Vé được giữ tối đa {holdMinutes} phút. Quá thời gian, ghế sẽ tự động giải phóng.
          </p>
        </div>

      </div>
    </div>
  )
}
