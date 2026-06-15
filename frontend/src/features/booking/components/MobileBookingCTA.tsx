import { Loader2, ChevronUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { fmtVnd } from '@/utils/labels'

interface Props {
  seatCount: number
  total: number
  finalTotal: number
  onHoldSeats: () => void
  holdSeatsPending: boolean
}

/**
 * Sticky CTA bar đáy màn hình MOBILE — chỉ chiếm 1 hàng mỏng (~64px) để
 * KHÔNG che ghế khi user scroll. Hiển thị tóm tắt: số ghế · giá · nút Giữ ghế.
 *
 * <p>Desktop ẩn (lg:hidden) — desktop dùng sidebar phải sticky-top thay thế.
 *
 * <p>Nút "Mở chi tiết" scroll xuống BookingSummary để user xem voucher/loyalty
 * mà không cần expand drawer (giữ logic đơn giản, không bottom sheet animation).
 */
export default function MobileBookingCTA({
  seatCount, total, finalTotal, onHoldSeats, holdSeatsPending,
}: Props) {
  const hasDiscount = finalTotal < total && total > 0
  const disabled = seatCount === 0 || holdSeatsPending

  function scrollToSummary() {
    const el = document.getElementById('booking-summary')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#181309]/95 backdrop-blur border-t border-[#3f382d] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 px-3">
      <div className="max-w-5xl mx-auto flex items-center gap-2">
        <button type="button" onClick={scrollToSummary}
          disabled={seatCount === 0}
          className="flex-1 text-left min-w-0 px-2 py-1 disabled:opacity-50"
          aria-label="Xem chi tiết đơn">
          <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase tracking-wide">
            <span>{seatCount} ghế đã chọn</span>
            {seatCount > 0 && <ChevronUp size={11} />}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-[#ffc107]">{fmtVnd(finalTotal)}</span>
            {hasDiscount && (
              <span className="text-[11px] text-gray-500 line-through">{fmtVnd(total)}</span>
            )}
          </div>
        </button>
        <Button
          onClick={onHoldSeats}
          disabled={disabled}
          className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold h-11 px-5 shrink-0">
          {holdSeatsPending ? <Loader2 size={16} className="animate-spin" /> : 'Giữ ghế'}
        </Button>
      </div>
    </div>
  )
}
