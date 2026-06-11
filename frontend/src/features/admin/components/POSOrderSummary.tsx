import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { fmtDateTime, fmtVnd, PAYMENT_METHOD_LABELS } from '@/utils/labels'
import type { POSShowtime, POSSeat } from '@/hooks/usePOS'

/** Phương thức thanh toán cho POS quầy — không bao gồm online (VNPAY/MOMO online flow). */
const POS_PAYMENT_METHODS = ['CASH', 'CARD_POS', 'TRANSFER'] as const
export type PosPaymentMethod = typeof POS_PAYMENT_METHODS[number]

export interface POSOrderSummaryProps {
  showtime: POSShowtime
  selectedSeats: number[]
  allSeats: POSSeat[]
  totalAmount: number
  saleInProgress: boolean
  paymentMethod: PosPaymentMethod
  onPaymentMethodChange: (m: PosPaymentMethod) => void
  onConfirmSale: () => void
}

/** Tóm tắt đơn hàng POS: thông tin suất chiếu + ghế đã chọn + chi tiết giá + tổng + dropdown phương thức + nút bán. */
export default function POSOrderSummary({
  showtime, selectedSeats, allSeats, totalAmount, saleInProgress,
  paymentMethod, onPaymentMethodChange, onConfirmSale,
}: POSOrderSummaryProps) {
  return (
    <Card className="bg-[#201b11] border-white/5 rounded-2xl">
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <ShowtimeInfoLine showtime={showtime} />
            <SelectedSeatsBadges seats={allSeats} selectedSeatIds={selectedSeats} />
            {selectedSeats.length > 0 && (
              <PriceBreakdown showtime={showtime} selectedSeats={selectedSeats} allSeats={allSeats} />
            )}
          </div>

          <ConfirmSection
            totalAmount={totalAmount}
            disabled={selectedSeats.length === 0 || saleInProgress}
            loading={saleInProgress}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={onPaymentMethodChange}
            onClick={onConfirmSale}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
//  Sub-components
// ============================================================

function ShowtimeInfoLine({ showtime }: { showtime: POSShowtime }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
      <span className="text-gray-400">Phim: <span className="text-white font-medium">{showtime.movieTitle}</span></span>
      <span className="text-gray-400">Giờ: <span className="text-white">{fmtDateTime(showtime.startTime)}</span></span>
      <span className="text-gray-400">Phòng: <span className="text-white">{showtime.roomName}</span></span>
    </div>
  )
}

interface SelectedSeatsBadgesProps {
  seats: POSSeat[]
  selectedSeatIds: number[]
}

function SelectedSeatsBadges({ seats, selectedSeatIds }: SelectedSeatsBadgesProps) {
  return (
    <div>
      <p className="text-gray-400 text-xs mb-1.5">
        Ghế đã chọn {selectedSeatIds.length > 0 && `(${selectedSeatIds.length})`}
      </p>
      {selectedSeatIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedSeatIds.map(seatId => {
            const seat = seats.find(s => s.id === seatId)
            if (!seat) return null
            return (
              <span key={seatId} className="text-xs px-2.5 py-1 rounded-md bg-[#ffc107]/10 text-[#ffc107] border border-[#ffc107]/20 font-medium">
                {seat.seatNumber}
                <span className="text-[#ffc107]/60 ml-1">
                  {seat.seatType === 'VIP' ? 'VIP' : seat.seatType === 'COUPLE' ? 'Đôi' : ''}
                </span>
              </span>
            )
          })}
        </div>
      ) : (
        <p className="text-gray-600 text-xs">Chưa chọn ghế nào</p>
      )}
    </div>
  )
}

interface PriceBreakdownProps {
  showtime: POSShowtime
  selectedSeats: number[]
  allSeats: POSSeat[]
}

function PriceBreakdown({ showtime, selectedSeats, allSeats }: PriceBreakdownProps) {
  const counts = { STANDARD: 0, VIP: 0, COUPLE: 0 }
  selectedSeats.forEach(id => {
    const s = allSeats.find(seat => seat.id === id)
    if (s) counts[s.seatType]++
  })

  const vipPrice = showtime.vipPrice ?? showtime.basePrice
  const couplePrice = showtime.couplePrice ?? showtime.basePrice
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-300">
      {counts.STANDARD > 0 && <span>Thường x{counts.STANDARD} = {fmtVnd(counts.STANDARD * showtime.basePrice)}</span>}
      {counts.VIP > 0 && <span>VIP x{counts.VIP} = {fmtVnd(counts.VIP * vipPrice)}</span>}
      {counts.COUPLE > 0 && <span>Đôi x{counts.COUPLE} = {fmtVnd(counts.COUPLE * couplePrice)}</span>}
    </div>
  )
}

interface ConfirmSectionProps {
  totalAmount: number
  disabled: boolean
  loading: boolean
  paymentMethod: PosPaymentMethod
  onPaymentMethodChange: (m: PosPaymentMethod) => void
  onClick: () => void
}

function ConfirmSection({
  totalAmount, disabled, loading, paymentMethod, onPaymentMethodChange, onClick,
}: ConfirmSectionProps) {
  return (
    <div className="flex flex-col items-end justify-center gap-3 md:border-l md:border-white/5 md:pl-6 min-w-[240px]">
      <div className="text-right w-full">
        <p className="text-gray-400 text-xs">Tổng tiền</p>
        <p className="text-[#ffc107] text-3xl font-bold">{fmtVnd(totalAmount)}</p>
      </div>
      <div className="w-full">
        <label className="text-gray-400 text-xs block mb-1">Phương thức thanh toán</label>
        <select
          value={paymentMethod}
          onChange={(e) => onPaymentMethodChange(e.target.value as PosPaymentMethod)}
          className="w-full h-9 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-2 focus:outline-none focus:ring-1 focus:ring-[#ffc107]"
        >
          {POS_PAYMENT_METHODS.map(m => (
            <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
          ))}
        </select>
      </div>
      <Button
        onClick={onClick}
        disabled={disabled}
        className="w-full bg-[#ffc107] hover:bg-[#e6ac06] text-black font-bold h-12 text-base rounded-lg"
      >
        <Check size={18} className="mr-2" />
        {loading ? 'Đang xử lý...' : 'Xác nhận bán vé'}
      </Button>
    </div>
  )
}
