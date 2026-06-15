import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBookingDetail, useTicket, useCancelBooking } from '@/hooks/useBooking'
import { usePublicConfigNumber } from '@/hooks/useConfig'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { label, BOOKING_STATUS_LABELS, SEAT_TYPE_LABELS, ROOM_TYPE_LABELS, LOYALTY_TIER_LABELS, fmtDateTime, fmtVnd, needsAgeConfirm, AGE_RATING_LABELS } from '@/utils/labels'
import { SEAT_TYPE_PRICE_TEXT, ROOM_TYPE_TEXT } from '@/utils/colors'
import { IdCard } from 'lucide-react'
import Loading from '@/components/common/Loading'
import { usePageTitle } from '@/hooks/usePageTitle'

type BadgeVariant = 'warning' | 'success' | 'default' | 'destructive' | 'secondary' | 'outline'

function getStatusInfo(status: string): { label: string; variant: BadgeVariant } {
  const variantMap: Record<string, BadgeVariant> = {
    HOLDING: 'warning',
    CONFIRMED: 'success',
    CHECKED_IN: 'default',
    CANCELLED: 'destructive',
    EXPIRED: 'secondary',
  }
  return { label: label(BOOKING_STATUS_LABELS, status), variant: variantMap[status] ?? 'outline' }
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const bookingId = Number(id)

  const { data: booking, isLoading: loadingBooking } = useBookingDetail(bookingId)
  const { data: ticket, isLoading: loadingTicket } = useTicket(bookingId)
  usePageTitle(booking ? `Vé ${booking.bookingCode}` : 'Chi tiết vé')
  const cancelBooking = useCancelBooking()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isLoading = loadingBooking || loadingTicket

  // Lấy config hủy vé từ BE (không hardcode)
  const { data: cancelBeforeMinutes = 60 } = usePublicConfigNumber('booking.cancel_before_minutes', 60)

  // Cho hủy: CONFIRMED + trước X phút khi suất chiếu bắt đầu (X từ config)
  const canCancel = booking
    && booking.status === 'CONFIRMED'
    && new Date(booking.startTime).getTime() - Date.now() > cancelBeforeMinutes * 60 * 1000

  async function handleCancel() {
    await cancelBooking.mutateAsync(bookingId)
    setConfirmOpen(false)
    navigate('/my-tickets')
  }

  if (isLoading) return <Loading />

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#181309] flex items-center justify-center">
        <p className="text-red-400">Không tìm thấy vé.</p>
      </div>
    )
  }

  const { label: statusText, variant } = getStatusInfo(booking.status)

  return (
    <div className="min-h-screen bg-[#181309] text-white py-10 px-4">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/my-tickets')}
            className="text-gray-400 hover:text-white"
          >
            ← Quay lại
          </Button>
          <Badge variant={variant} className="text-sm px-3 py-1">{statusText}</Badge>
        </div>

        {/* Cảnh báo độ tuổi — chuẩn industry: T13/T16/T18/C buộc mang CCCD,
            nhân viên check tại cổng có quyền từ chối nếu không đủ tuổi. */}
        {needsAgeConfirm(booking.movieAgeRating) && (
          <div className="flex gap-3 bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4">
            <IdCard size={20} className="text-orange-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-orange-300 font-medium mb-0.5">
                Phim {booking.movieAgeRating} · {AGE_RATING_LABELS[booking.movieAgeRating ?? '']?.split(' — ')[1] ?? ''}
              </p>
              <p className="text-orange-200/80 text-xs leading-relaxed">
                Vui lòng mang theo CCCD/CMND để xuất trình tại cổng. Nhân viên có quyền từ chối check-in nếu không đủ tuổi và không hoàn tiền.
              </p>
            </div>
          </div>
        )}

        {/* Thông tin phim + suất chiếu */}
        <Card className="bg-[#201b11] border-white/5 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl text-[#ffc107]">{booking.movieTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Mã đặt vé</span>
              <span className="font-mono text-[#ffc107] font-bold">{booking.bookingCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Giờ chiếu</span>
              <span className="font-medium text-right">{fmtDateTime(booking.startTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Kết thúc</span>
              <span className="text-gray-300">{fmtDateTime(booking.endTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Phòng chiếu</span>
              <span className="font-medium">{booking.roomName} (<span className={ROOM_TYPE_TEXT[booking.roomType] ?? ''}>{label(ROOM_TYPE_LABELS, booking.roomType)}</span>)</span>
            </div>
          </CardContent>
        </Card>

        {/* Ghế + giá */}
        <Card className="bg-[#201b11] border-white/5 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100">Chi tiết ghế</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {booking.seats.map(s => (
              <div key={s.seatId} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                    {s.seatNumber}
                  </Badge>
                  <span className="text-gray-400 text-xs">{label(SEAT_TYPE_LABELS, s.seatType)}</span>
                </div>
                <span className={`font-semibold ${SEAT_TYPE_PRICE_TEXT[s.seatType] ?? 'text-gray-200'}`}>{fmtVnd(s.price)}</span>
              </div>
            ))}
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
              <div className="flex justify-between font-semibold pt-1.5 border-t border-white/5">
                <span>Tổng cộng</span>
                <span className="text-[#ffc107] text-lg">{fmtVnd(booking.totalAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QR Code — hiển thị PNG base64 BE đã gen từ qrToken (random 32 ký tự, unforgeable).
            KHÔNG gen từ bookingCode vì code đó predictable (CX-yymmdd-NNN). */}
        {ticket?.qrCodeBase64 ? (
          <Card className="bg-[#201b11] border-white/5 text-white">
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              <p className="text-sm text-gray-400 text-center">
                Xuất trình mã QR tại quầy để vào rạp
              </p>
              <div className="bg-white p-4 rounded-2xl shadow-lg">
                <img
                  src={`data:image/png;base64,${ticket.qrCodeBase64}`}
                  alt={`QR vé ${booking.bookingCode}`}
                  width={250}
                  height={250}
                />
              </div>
              <p className="font-mono text-[#ffc107] text-sm tracking-widest">
                {booking.bookingCode}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-[#201b11] border-white/5 text-white">
            <CardContent className="pt-6 text-center">
              <p className="text-gray-500 text-sm">
                QR code sẽ hiển thị sau khi thanh toán xác nhận.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Chính sách hủy vé — luôn hiển thị, kể cả khi không còn cancel được. */}
        {booking.status === 'CONFIRMED' && (
          <Card className="bg-[#201b11] border-[#3f382d] text-white">
            <CardContent className="pt-6">
              <h3 className="font-medium text-amber-50 mb-2">Chính sách hủy vé</h3>
              <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                <li>
                  Được phép hủy <span className="text-[#ffc107] font-medium">trước {cancelBeforeMinutes} phút</span> khi suất chiếu bắt đầu
                </li>
                <li>Tiền vé sẽ được hoàn lại 100% qua phương thức thanh toán ban đầu</li>
                <li>Voucher đã dùng (nếu có) sẽ được trả lại tài khoản</li>
                <li>Trong vòng {cancelBeforeMinutes} phút trước giờ chiếu: KHÔNG cho hủy</li>
              </ul>
              {!canCancel && (
                <p className="text-xs text-red-400 mt-3">
                  ⚠ Đã quá hạn hủy vé. Vui lòng đến rạp đúng giờ.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Nút hủy vé */}
        {canCancel && (
          <Button
            variant="destructive"
            className="w-full font-semibold h-11"
            onClick={() => setConfirmOpen(true)}
          >
            Hủy vé
          </Button>
        )}

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleCancel}
          message={`Bạn có chắc muốn hủy vé này không? Tiền sẽ được hoàn lại 100%.`}
          loading={cancelBooking.isPending}
        />

      </div>
    </div>
  )
}
