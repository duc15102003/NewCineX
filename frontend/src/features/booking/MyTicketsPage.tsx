import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMyBookings } from '@/hooks/useBooking'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { BookingListItem } from '@/types/booking'
import { label, BOOKING_STATUS_LABELS, fmtDateTime, fmtVnd } from '@/utils/labels'
import Loading from '@/components/common/Loading'

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

function BookingCard({ item, onClick }: { item: BookingListItem; onClick: () => void }) {
  const { label: statusText, variant } = getStatusInfo(item.status)

  return (
    <div
      onClick={onClick}
      className="bg-[#201b11] border border-white/5 rounded-2xl p-4 flex gap-4 cursor-pointer hover:border-[#ffc107]/50 hover:bg-[#201b11]/80 transition-all"
    >
      {/* Poster nhỏ */}
      <div className="flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden bg-[#2a2317]">
        {item.moviePosterUrl ? (
          <img
            src={item.moviePosterUrl}
            alt={item.movieTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2zm0 4h4v2H8v-2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Thông tin */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-white truncate text-sm leading-snug">
            {item.movieTitle}
          </h3>
          <Badge variant={variant} className="flex-shrink-0 text-xs">{statusText}</Badge>
        </div>

        <p className="text-xs text-gray-400 mb-0.5">
          {fmtDateTime(item.startTime)}
        </p>
        <p className="text-xs text-gray-400 mb-1">
          Phòng: <span className="text-gray-300">{item.roomName}</span>
          {' · '}
          <span className="text-gray-300">{item.seatCount} ghế</span>
        </p>

        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-500">
            Mã: <span className="font-mono text-[#ffc107]/80">{item.bookingCode}</span>
          </p>
          <p className="font-semibold text-[#ffc107] text-sm">{fmtVnd(item.totalAmount)}</p>
        </div>
      </div>
    </div>
  )
}

export default function MyTicketsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const { data, isLoading, isError } = useMyBookings(page)

  if (isLoading) return <Loading />

  if (isError) {
    return (
      <div className="min-h-screen bg-[#181309] flex items-center justify-center">
        <p className="text-red-400">Không thể tải danh sách vé.</p>
      </div>
    )
  }

  const items = data?.content ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="min-h-screen bg-[#181309] text-white py-10 px-4">
      <div className="max-w-2xl mx-auto">

        <h1 className="text-2xl font-bold text-[#ffc107] mb-6">Vé của tôi</h1>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">🎟️</p>
            <p className="text-gray-400 mb-4">Bạn chưa có vé nào</p>
            <Button
              onClick={() => navigate('/movies')}
              className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold"
            >
              Đặt vé ngay
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map(item => (
                <BookingCard
                  key={item.id}
                  item={item}
                  onClick={() => navigate(`/my-tickets/${item.id}`)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="border-white/10 text-gray-300 hover:bg-white/5 disabled:opacity-30"
                >
                  ← Trước
                </Button>
                <span className="text-sm text-gray-400">
                  Trang {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="border-white/10 text-gray-300 hover:bg-white/5 disabled:opacity-30"
                >
                  Sau →
                </Button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
