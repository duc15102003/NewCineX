import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useBookingDetail, useCreatePayment } from '@/hooks/useBooking'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Loading from '@/components/common/Loading'
import { fmtDateTime, label, ROOM_TYPE_LABELS } from '@/utils/labels'

function formatPrice(amount: number) {
  return amount.toLocaleString('vi-VN') + 'đ'
}

const PAYMENT_METHODS = [
  {
    value: 'VNPAY',
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
  const createPayment = useCreatePayment()
  const [selectedMethod, setSelectedMethod] = useState('VNPAY')

  const { data: holdConfig } = useQuery({
    queryKey: ['config', 'hold-minutes'],
    queryFn: async () => {
      const res = await api.get('/api/configs/public/booking.hold_minutes')
      return res.data.data as string
    },
    staleTime: 5 * 60 * 1000,
  })
  const holdMinutes = Number(holdConfig ?? 10)

  async function handlePayment() {
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
  }

  if (isLoading) return <Loading />

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#051424] flex items-center justify-center">
        <p className="text-red-400">Không tìm thấy đơn đặt vé.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#051424] text-white py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        <h1 className="text-2xl font-bold text-center text-[#eab308]">Thanh toán vé</h1>

        {/* Thông tin vé */}
        <Card className="bg-[#0a1929] border-white/5 text-white">
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
              <span className="font-medium">{booking.roomName} ({label(ROOM_TYPE_LABELS, booking.roomType)})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Mã đặt vé</span>
              <span className="font-mono text-[#eab308]">{booking.bookingCode}</span>
            </div>

            {/* Danh sách ghế */}
            <div>
              <p className="text-gray-400 mb-2">Ghế đã chọn</p>
              <div className="flex flex-wrap gap-1.5">
                {booking.seats.map(s => (
                  <Badge key={s.seatId} variant="outline" className="text-xs border-white/10 text-gray-200">
                    {s.seatNumber} — {formatPrice(s.price)}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-3 flex justify-between font-semibold text-base">
              <span>Tổng tiền</span>
              <span className="text-[#eab308] text-lg">{formatPrice(booking.totalAmount)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Chọn phương thức thanh toán */}
        <Card className="bg-[#0a1929] border-white/5 text-white">
          <CardHeader>
            <CardTitle className="text-lg text-gray-100">Phương thức thanh toán</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {PAYMENT_METHODS.map(method => (
              <label
                key={method.value}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  selectedMethod === method.value
                    ? 'border-[#eab308] bg-[#eab308]/10'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.value}
                  checked={selectedMethod === method.value}
                  onChange={() => setSelectedMethod(method.value)}
                  className="mt-0.5 accent-[#eab308]"
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
          disabled={createPayment.isPending}
          className="w-full bg-[#eab308] hover:bg-[#ca8a04] text-black font-bold h-12 text-base"
        >
          {createPayment.isPending ? 'Đang xử lý...' : `Thanh toán ${formatPrice(booking.totalAmount)}`}
        </Button>

        <p className="text-center text-xs text-gray-500">
          Vé sẽ được giữ trong vòng {holdMinutes} phút. Vui lòng hoàn thành thanh toán trước khi hết hạn.
        </p>

      </div>
    </div>
  )
}
