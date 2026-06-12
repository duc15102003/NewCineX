import { useSearchParams, Link } from 'react-router-dom'
import { useTicket } from '@/hooks/useBooking'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import Loading from '@/components/common/Loading'
import { fmtDateTime, label, ROOM_TYPE_LABELS, fmtVnd } from '@/utils/labels'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function PaymentResultPage() {
  usePageTitle('Kết quả thanh toán')
  const [params] = useSearchParams()

  // Từ callback VNPay (transactionCode) hoặc từ CASH (bookingId)
  const transactionCode = params.get('transactionCode')
  const bookingIdStr = params.get('bookingId')
  const bookingId = bookingIdStr ? Number(bookingIdStr) : 0

  const isSuccess = !!transactionCode || !!bookingIdStr

  const { data: ticket, isLoading, isError } = useTicket(bookingId)

  if (!isSuccess) {
    return (
      <div className="min-h-screen bg-[#181309] flex items-center justify-center text-white px-4">
        <div className="text-center">
          <p className="text-5xl mb-4">❌</p>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Thanh toán thất bại</h1>
          <p className="text-gray-400 mb-6">Giao dịch không thành công hoặc đã bị hủy.</p>
          <Link to="/movies">
            <Button className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold">
              Xem phim khác
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading) return <Loading />

  return (
    <div className="min-h-screen bg-[#181309] text-white py-10 px-4">
      <div className="max-w-lg mx-auto">

        {/* Header thành công */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-green-400 mb-1">Đặt vé thành công!</h1>
          <p className="text-gray-400">Vé của bạn đã được xác nhận</p>
          {transactionCode && (
            <p className="text-xs text-gray-500 mt-2">Mã giao dịch: <span className="font-mono text-[#ffc107]">{transactionCode}</span></p>
          )}
        </div>

        {/* Nếu API lỗi (chưa login / token hết hạn) → hiện thông báo + link */}
        {isError && (
          <div className="bg-[#201b11] border border-white/5 rounded-2xl p-6 text-center mb-6">
            <p className="text-gray-300 mb-4">Thanh toán đã được xử lý. Đăng nhập để xem chi tiết vé.</p>
            <div className="flex gap-3 justify-center">
              <Link to="/login"><Button className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold">Đăng nhập</Button></Link>
              <Link to="/my-tickets"><Button variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5">Vé của tôi</Button></Link>
            </div>
          </div>
        )}

        {ticket ? (
          <Card className="bg-[#201b11] border-white/5 text-white overflow-hidden">
            {/* Poster + thông tin phim */}
            <div className="flex gap-4 p-5 border-b border-white/5">
              {ticket.moviePosterUrl && (
                <img
                  src={ticket.moviePosterUrl}
                  alt={ticket.movieTitle}
                  className="w-20 h-28 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="space-y-1 flex-1">
                <h2 className="font-bold text-lg text-[#ffc107]">{ticket.movieTitle}</h2>
                <p className="text-sm text-gray-300">{fmtDateTime(ticket.startTime)}</p>
                <p className="text-sm text-gray-400">
                  Phòng: <span className="text-white">{ticket.roomName}</span>
                  {ticket.roomType && (
                    <span className="ml-2 text-xs text-gray-500">({label(ROOM_TYPE_LABELS, ticket.roomType)})</span>
                  )}
                </p>
                <p className="text-sm text-gray-400">
                  Phương thức:{' '}
                  <span className="text-white">{ticket.paymentMethod ?? 'N/A'}</span>
                </p>
              </div>
            </div>

            <CardContent className="p-5 space-y-4">
              {/* Mã vé */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Mã đặt vé</span>
                <span className="font-mono text-[#ffc107] font-bold tracking-wider">
                  {ticket.bookingCode}
                </span>
              </div>

              {/* Ghế */}
              <div>
                <p className="text-gray-400 text-sm mb-2">Ghế</p>
                <div className="flex flex-wrap gap-1.5">
                  {ticket.seats.map(s => (
                    <Badge key={s.seatId} variant="outline" className="text-xs border-white/10 text-gray-200">
                      {s.seatNumber} ({s.seatType})
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Tổng tiền */}
              <div className="flex justify-between font-semibold border-t border-white/10 pt-3">
                <span>Tổng tiền</span>
                <span className="text-[#ffc107] text-lg">{fmtVnd(ticket.totalAmount)}</span>
              </div>

              {/* QR code — render PNG base64 BE gen từ qrToken (unforgeable). */}
              {ticket.qrCodeBase64 && (
                <div className="flex flex-col items-center pt-2">
                  <p className="text-xs text-gray-500 mb-3">Xuất trình mã QR tại quầy để vào rạp</p>
                  <div className="bg-white p-3 rounded-xl">
                    <img
                      src={`data:image/png;base64,${ticket.qrCodeBase64}`}
                      alt={`QR vé ${ticket.bookingCode}`}
                      width={160}
                      height={160}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Không có ticket data nhưng vẫn thành công (ví dụ: CASH pending) */
          <Card className="bg-[#201b11] border-white/5 text-white p-6 text-center">
            <p className="text-gray-300">
              Đơn đặt vé đã được ghi nhận.
              {transactionCode && (
                <span className="block mt-1 text-sm text-gray-400">
                  Mã giao dịch: <span className="font-mono text-[#ffc107]">{transactionCode}</span>
                </span>
              )}
            </p>
          </Card>
        )}

        {/* CTA */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/my-tickets">
            <Button className="w-full sm:w-auto bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold">
              Xem vé của tôi
            </Button>
          </Link>
          <Link to="/movies">
            <Button variant="outline" className="w-full sm:w-auto border-white/10 text-gray-200 hover:bg-white/5">
              Xem phim khác
            </Button>
          </Link>
        </div>

      </div>
    </div>
  )
}
