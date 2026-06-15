import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tag, X } from 'lucide-react'

import type { SeatItem } from '@/types/booking'
import { label, SEAT_TYPE_LABELS, fmtVnd } from '@/utils/labels'
import { SEAT_TYPE_COLORS } from '@/utils/colors'
import { getSeatPrice, type ShowtimePrices } from '@/utils/pricing'

import LoyaltyRedeemInput from './LoyaltyRedeemInput'

interface AvailableVoucher {
  code: string
  description: string
  discountAmount: number
  message: string
}

interface VoucherResult {
  valid: boolean
  code?: string
  discountAmount: number
  message: string
}

/* ShowtimePrices type tách sang utils/pricing.ts để dùng chung với SeatSelectionPage. */

export interface BookingSummaryProps {
  selectedSeats: SeatItem[]
  showtime: ShowtimePrices
  total: number
  finalTotal: number

  voucherCode: string
  onVoucherCodeChange: (code: string) => void
  voucherResult: VoucherResult | null
  voucherLoading: boolean
  onApplyVoucher: () => void
  onClearVoucher: () => void

  availableVouchers: AvailableVoucher[]
  showVoucherList: boolean
  onToggleVoucherList: () => void
  onSelectVoucher: (v: AvailableVoucher) => void

  /** Loyalty redeem — null nếu chưa wire (page cũ vẫn dùng được). */
  redeemPoints?: number
  onRedeemPointsChange?: (points: number) => void

  onHoldSeats: () => void
  holdSeatsPending: boolean
}

/** Tổng kết booking: ghế đã chọn + voucher + giá + nút giữ ghế. */
export default function BookingSummary(props: BookingSummaryProps) {
  const {
    selectedSeats, showtime, total, finalTotal,
    voucherCode, onVoucherCodeChange, voucherResult, voucherLoading,
    onApplyVoucher, onClearVoucher,
    availableVouchers, showVoucherList, onToggleVoucherList, onSelectVoucher,
    redeemPoints, onRedeemPointsChange,
    onHoldSeats, holdSeatsPending,
  } = props

  return (
    // Layout responsive:
    //  - Desktop (lg+): sticky top (sidebar phải), scroll cùng SeatMap
    //  - Mobile (<lg): hiển thị bình thường dưới SeatMap. CTA "Giữ ghế" sticky
    //    đáy được render riêng qua <MobileBookingCTA /> để KHÔNG che ghế.
    // pb-20 lg:pb-5: chừa chỗ cho mobile sticky CTA bar (~64px) khi cuộn đáy.
    <div id="booking-summary"
      className="bg-[#201b11] border border-white/5 rounded-2xl p-5 lg:sticky lg:top-4">
      <h2 className="font-semibold text-gray-200 mb-3">
        Ghế đã chọn {selectedSeats.length > 0 && `(${selectedSeats.length})`}
      </h2>

      <SelectedSeatsList seats={selectedSeats} showtime={showtime} />

      <div className="mb-4">
        {voucherResult?.valid ? (
          <AppliedVoucher voucherResult={voucherResult} onClear={onClearVoucher} />
        ) : (
          <VoucherPicker
            availableVouchers={availableVouchers}
            showList={showVoucherList}
            onToggleList={onToggleVoucherList}
            onSelectVoucher={onSelectVoucher}
            voucherCode={voucherCode}
            onCodeChange={onVoucherCodeChange}
            onApply={onApplyVoucher}
            loading={voucherLoading}
            hasSeats={selectedSeats.length > 0}
          />
        )}
        {voucherResult && !voucherResult.valid && (
          <p className="text-red-400 text-xs mt-1">{voucherResult.message}</p>
        )}
      </div>

      {/* Loyalty redeem — chỉ hiện khi cha truyền callback (login + đủ điểm) */}
      {onRedeemPointsChange && selectedSeats.length > 0 && (
        <LoyaltyRedeemInput
          redeemPoints={redeemPoints ?? 0}
          onRedeemPointsChange={onRedeemPointsChange}
          maxDiscountCap={total}
        />
      )}

      <PriceBreakdown
        total={total}
        finalTotal={finalTotal}
        voucherResult={voucherResult}
        canHold={selectedSeats.length > 0}
        onHoldSeats={onHoldSeats}
        holdPending={holdSeatsPending}
      />
    </div>
  )
}

// ============================================================
//  Sub-components
// ============================================================

interface SelectedSeatsListProps {
  seats: SeatItem[]
  showtime: ShowtimePrices
}

function SelectedSeatsList({ seats, showtime }: SelectedSeatsListProps) {
  if (seats.length === 0) {
    return <p className="text-gray-500 text-sm mb-4">Chưa chọn ghế nào</p>
  }
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {seats.map(s => (
        <Badge
          key={s.id}
          variant="outline"
          className={`text-xs ${SEAT_TYPE_COLORS[s.seatType] ?? ''}`}
        >
          {s.seatNumber} ({label(SEAT_TYPE_LABELS, s.seatType)}) — {fmtVnd(getSeatPrice(s.seatType, showtime))}
        </Badge>
      ))}
    </div>
  )
}

interface AppliedVoucherProps {
  voucherResult: VoucherResult
  onClear: () => void
}

function AppliedVoucher({ voucherResult, onClear }: AppliedVoucherProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
      <Tag size={14} className="text-green-400" />
      <div className="flex-1">
        <span className="text-sm text-green-400 font-medium">{voucherResult.code}</span>
        <span className="text-xs text-green-400/70 ml-2">— {voucherResult.message}</span>
      </div>
      <button onClick={onClear} className="text-gray-400 hover:text-white"><X size={14} /></button>
    </div>
  )
}

interface VoucherPickerProps {
  availableVouchers: AvailableVoucher[]
  showList: boolean
  onToggleList: () => void
  onSelectVoucher: (v: AvailableVoucher) => void
  voucherCode: string
  onCodeChange: (code: string) => void
  onApply: () => void
  loading: boolean
  hasSeats: boolean
}

function VoucherPicker(props: VoucherPickerProps) {
  const {
    availableVouchers, showList, onToggleList, onSelectVoucher,
    voucherCode, onCodeChange, onApply, loading, hasSeats,
  } = props
  return (
    <div className="space-y-2">
      {availableVouchers.length > 0 && hasSeats && (
        <div>
          <button onClick={onToggleList}
            className="text-sm text-[#ffc107] hover:underline flex items-center gap-1 mb-1">
            <Tag size={12} /> 🎟️ {availableVouchers.length} voucher khả dụng {showList ? '▲' : '▼'}
          </button>
          {showList && (
            <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
              {availableVouchers.map(v => (
                <button key={v.code} onClick={() => onSelectVoucher(v)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-[#ffc107]/30 transition-colors text-left">
                  <div>
                    <span className="text-sm font-mono text-[#ffc107] font-medium">{v.code}</span>
                    <p className="text-xs text-gray-400 mt-0.5">{v.description}</p>
                  </div>
                  <span className="text-sm text-green-400 font-semibold shrink-0 ml-3">-{fmtVnd(v.discountAmount)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="Hoặc nhập mã voucher"
          value={voucherCode}
          onChange={e => onCodeChange(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && onApply()}
          className="flex-1 sm:w-56 sm:flex-none"
        />
        <Button
          onClick={onApply}
          disabled={!voucherCode.trim() || loading || !hasSeats}
          variant="outline"
          className="border-[#ffc107] text-[#ffc107] hover:bg-[#ffc107]/10 shrink-0"
        >
          {loading ? '...' : 'Áp dụng'}
        </Button>
      </div>
    </div>
  )
}

interface PriceBreakdownProps {
  total: number
  finalTotal: number
  voucherResult: VoucherResult | null
  canHold: boolean
  onHoldSeats: () => void
  holdPending: boolean
}

function PriceBreakdown({ total, finalTotal, voucherResult, canHold, onHoldSeats, holdPending }: PriceBreakdownProps) {
  return (
    <div className="flex items-end justify-between">
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">Tổng tiền ghế:</span>
          <span className="text-white">{fmtVnd(total)}</span>
        </div>
        {voucherResult?.valid && (
          <div className="flex items-center gap-4">
            <span className="text-gray-400">Giảm giá:</span>
            <span className="text-green-400">-{fmtVnd(voucherResult.discountAmount)}</span>
          </div>
        )}
        <div className="flex items-center gap-4 pt-1 border-t border-white/10">
          <span className="text-gray-300 font-medium">Thanh toán:</span>
          <span className="text-xl font-bold text-[#ffc107]">{fmtVnd(finalTotal)}</span>
        </div>
      </div>
      <Button
        onClick={onHoldSeats}
        disabled={!canHold || holdPending}
        loading={holdPending}
        className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold px-6 h-11"
      >
        Giữ ghế
      </Button>
    </div>
  )
}
