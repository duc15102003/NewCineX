import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { fmtDateTime, fmtVnd, PAYMENT_METHOD_LABELS } from '@/utils/labels'
import { SEAT_TYPE_PRICE_TEXT } from '@/utils/colors'
import type { POSShowtime, POSSeat } from '@/hooks/usePOS'
import { usePublicConfigNumber } from '@/hooks/useConfig'

/**
 * Phương thức thanh toán cho POS quầy — pattern rạp VN:
 * - CASH: tiền mặt (30-50% giao dịch)
 * - CARD_POS: thẻ ATM/Visa/Master qua máy POS swipe (30-40%)
 * - MOMO: QR scan tại quầy (20-30%, đang tăng nhanh)
 *
 * KHÔNG có TRANSFER (chuyển khoản banking) — không auto-confirm được,
 * queue quầy không chờ được.
 */
const POS_PAYMENT_METHODS = ['CASH', 'CARD_POS', 'MOMO'] as const
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
    <Card className="bg-[#201b11] border-[#3f382d] rounded-2xl">
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <ShowtimeInfoLine showtime={showtime} />
            <SelectedSeatsBadges seats={allSeats} selectedSeatIds={selectedSeats} />
            {selectedSeats.length > 0 && (
              <PriceBreakdown showtime={showtime} selectedSeats={selectedSeats} allSeats={allSeats} />
            )}
            {selectedSeats.length > 0 && (
              <GroupDiscountHint seatCount={selectedSeats.length} />
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
  // HANDICAP dùng basePrice (NĐ 28/2012 — không thu phụ phí ghế khuyết tật).
  const counts = { STANDARD: 0, VIP: 0, COUPLE: 0, SWEETBOX: 0, DELUXE: 0, HANDICAP: 0 }
  selectedSeats.forEach(id => {
    const s = allSeats.find(seat => seat.id === id)
    if (s) counts[s.seatType]++
  })

  // Fallback formula khớp BookingService.getPriceForSeat:
  // SWEETBOX = couple × 2 nếu null, DELUXE = vip × 1.5 nếu null.
  const vipPrice = showtime.vipPrice ?? showtime.basePrice
  const couplePrice = showtime.couplePrice ?? showtime.basePrice
  const sweetboxPrice = showtime.sweetboxPrice ?? couplePrice * 2
  const deluxePrice = showtime.deluxePrice ?? Math.round(vipPrice * 1.5)
  const standardCount = counts.STANDARD + counts.HANDICAP
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-300">
      {standardCount > 0 && (
        <span>Thường x{standardCount} = <span className={`font-semibold ${SEAT_TYPE_PRICE_TEXT.STANDARD}`}>{fmtVnd(standardCount * showtime.basePrice)}</span></span>
      )}
      {counts.VIP > 0 && (
        <span>VIP x{counts.VIP} = <span className={`font-semibold ${SEAT_TYPE_PRICE_TEXT.VIP}`}>{fmtVnd(counts.VIP * vipPrice)}</span></span>
      )}
      {counts.COUPLE > 0 && (
        <span>Đôi x{counts.COUPLE} = <span className={`font-semibold ${SEAT_TYPE_PRICE_TEXT.COUPLE}`}>{fmtVnd(counts.COUPLE * couplePrice)}</span></span>
      )}
      {counts.SWEETBOX > 0 && (
        <span>Sweetbox x{counts.SWEETBOX} = <span className={`font-semibold ${SEAT_TYPE_PRICE_TEXT.SWEETBOX}`}>{fmtVnd(counts.SWEETBOX * sweetboxPrice)}</span></span>
      )}
      {counts.DELUXE > 0 && (
        <span>Deluxe x{counts.DELUXE} = <span className={`font-semibold ${SEAT_TYPE_PRICE_TEXT.DELUXE}`}>{fmtVnd(counts.DELUXE * deluxePrice)}</span></span>
      )}
    </div>
  )
}

interface GroupDiscountHintProps {
  seatCount: number
}

/**
 * Hint cho cashier biết khách đủ điều kiện giảm giá nhóm. Đọc threshold +
 * percent từ public config — khớp BE auto-apply trong counterSale.
 */
function GroupDiscountHint({ seatCount }: GroupDiscountHintProps) {
  const { data: threshold = 10 } = usePublicConfigNumber('booking.group_discount_threshold', 10)
  const { data: percent = 5 } = usePublicConfigNumber('booking.group_discount_percent', 5)
  if (percent <= 0 || seatCount < threshold) return null
  return (
    <div className="text-xs text-green-400 bg-green-500/5 border border-green-500/20 rounded-md px-3 py-2 inline-flex items-center gap-1.5">
      <Check size={12} /> Đủ điều kiện giảm giá nhóm {percent}% (từ {threshold} vé)
    </div>
  )
}

interface PriceTotalBoxProps {
  totalAmount: number
}

/**
 * Box tổng tiền POS — tách VAT breakdown (industry: subtotal + VAT trên hóa
 * đơn). Đọc % VAT từ public config để khớp BE — nếu admin đổi 8% → 10%, POS
 * tự cập nhật.
 *
 * <p>Group discount KHÔNG tính ở FE vì POS counter-sale có user=null nên BE
 * vẫn áp group nếu seats ≥ threshold. FE hiện hint "Sẽ giảm X%" để cashier
 * biết tư vấn khách.
 */
function PriceTotalBox({ totalAmount }: PriceTotalBoxProps) {
  // VAT-inclusive: total = subtotal × (1 + vat/100) → subtotal = total × 100 / (100 + vat)
  const { data: vatPercent = 8 } = usePublicConfigNumber('pricing.vat_percent', 8)
  const subtotal = Math.round((totalAmount * 100) / (100 + vatPercent))
  const vat = totalAmount - subtotal

  return (
    <div className="text-right w-full space-y-1">
      {totalAmount > 0 && (
        <div className="space-y-0.5 mb-1.5">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Tạm tính</span>
            <span>{fmtVnd(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>VAT ({vatPercent}%)</span>
            <span>{fmtVnd(vat)}</span>
          </div>
        </div>
      )}
      <p className="text-gray-400 text-xs">Tổng tiền</p>
      <p className="text-[#ffc107] text-3xl font-bold">{fmtVnd(totalAmount)}</p>
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
    <div className="flex flex-col items-end justify-center gap-3 md:border-l md:border-white/5 md:pl-6 min-w-[260px]">
      <PriceTotalBox totalAmount={totalAmount} />
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
