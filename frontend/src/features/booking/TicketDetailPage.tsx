import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCode } from 'react-qr-code'
import { useQuery } from '@tanstack/react-query'
import { useBookingDetail, useTicket, useCancelBooking } from '@/hooks/useBooking'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { label, BOOKING_STATUS_LABELS, SEAT_TYPE_LABELS, ROOM_TYPE_LABELS, fmtDateTime } from '@/utils/labels'
import Loading from '@/components/common/Loading'

function formatPrice(amount: number) {
  return amount.toLocaleString('vi-VN') + 'đ'
}

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
  const cancelBooking = useCancelBooking()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isLoading = loadingBooking || loadingTicket

  // Lấy config hủy vé từ BE (không hardcode)
  const { data: cancelConfig } = useQuery({
    queryKey: ['config', 'cancel-before-minutes'],
    queryFn: async () => {
      const res = await api.get('/api/configs/public/booking.cancel_before_minutes')
      return res.data.data as string
    },
    staleTime: 5 * 60 * 1000,
  })
  const cancelBeforeMinutes = Number(cancelConfig ?? 60)

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
      <div className="min-h-screen bg-[#051424] flex items-center justify-center">
        <p className="text-red-400">Không tìm thấy vé.</p>
      </div>
    )
  }

  const { label: statusText, variant } = getStatusInfo(booking.status)

  return (
    <div className="min-h-screen bg-[#051424] text-white py-10 px-4">
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

        {/* Thông tin phim + suất chiếu */}
        <Card className="bg-[#0a1929] border-white/5 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl text-[#eab308]">{booking.movieTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Mã đặt vé</span>
              <span className="font-mono text-[#eab308] font-bold">{booking.bookingCode}</span>
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
              <span className="font-medium">{booking.roomName} ({label(ROOM_TYPE_LABELS, booking.roomType)})</span>
            </div>
          </CardContent>
        </Card>

        {/* Ghế + giá */}
        <Card className="bg-[#0a1929] border-white/5 text-white">
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
                <span className="text-gray-200">{formatPrice(s.price)}</span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-3 flex justify-between font-semibold">
              <span>Tổng cộng</span>
              <span className="text-[#eab308] text-lg">{formatPrice(booking.totalAmount)}</span>
            </div>
          </CardContent>
        </Card>

        {/* QR Code — chỉ hiển thị khi có ticket */}
        {ticket ? (
          <Card className="bg-[#0a1929] border-white/5 text-white">
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              <p className="text-sm text-gray-400 text-center">
                Xuất trình mã QR tại quầy để vào rạp
              </p>
              <div className="bg-white p-4 rounded-2xl shadow-lg">
                <QRCode
                  value={booking.bookingCode}
                  size={250}
                />
              </div>
              <p className="font-mono text-[#eab308] text-sm tracking-widest">
                {booking.bookingCode}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-[#0a1929] border-white/5 text-white">
            <CardContent className="pt-6 text-center">
              <p className="text-gray-500 text-sm">
                QR code sẽ hiển thị sau khi thanh toán xác nhận.
              </p>
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
          message="Bạn có chắc muốn hủy vé này không?"
          loading={cancelBooking.isPending}
        />

      </div>
    </div>
  )
}
