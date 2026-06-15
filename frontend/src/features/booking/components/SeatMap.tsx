import React, { useMemo } from 'react'
import { Check, Ticket } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import CinemaScreen from '@/components/common/CinemaScreen'
import { Button } from '@/components/ui/button'
import type { SeatItem } from '@/types/booking'
import { label, SEAT_TYPE_LABELS } from '@/utils/labels'

interface SeatMapProps {
  /** Map từ row label (vd "A") → array seats trong row đó */
  rows: Array<[string, SeatItem[]]>
  selectedSeatIds: number[]
  occupiedSeatIds: number[]
  onToggle: (seat: SeatItem, seatsInRow: SeatItem[]) => void
}

/**
 * Render sơ đồ ghế chuẩn industry (CGV/Lotte/BHD).
 *
 * Hỗ trợ:
 * - SeatType: STANDARD, VIP, COUPLE, SWEETBOX (gộp 2 ô), DELUXE, HANDICAP
 * - SeatStatus: AVAILABLE, BROKEN (orange disabled), BLOCKED (red disabled)
 * - isAisle: render khoảng trống thay vì button
 */
export default function SeatMap({ rows, selectedSeatIds, occupiedSeatIds, onToggle }: SeatMapProps) {
  const navigate = useNavigate()

  // Tính sold-out: tất cả ghế (loại trừ aisle + BROKEN + BLOCKED) đều đã
  // chiếm. Nếu vậy → không cần render sơ đồ tương tác, hiển thị overlay rõ ràng.
  const { soldOut, sellableTotal } = useMemo(() => {
    let sellable = 0
    let occupied = 0
    rows.forEach(([, seats]) => {
      seats.forEach(s => {
        if (s.aisle) return
        if (s.status === 'BROKEN' || s.status === 'BLOCKED') return
        sellable += 1
        if (occupiedSeatIds.includes(s.id)) occupied += 1
      })
    })
    return { soldOut: sellable > 0 && occupied >= sellable, sellableTotal: sellable }
  }, [rows, occupiedSeatIds])

  if (soldOut) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-8 text-center my-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 mb-4">
          <Ticket size={26} className="text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-red-300 mb-1">Suất chiếu đã hết vé</h3>
        <p className="text-sm text-gray-400 max-w-md mx-auto mb-5">
          Toàn bộ {sellableTotal} ghế của suất này đã được đặt. Vui lòng chọn một suất chiếu khác —
          rạp thường có suất tiếp theo trong vòng 30-60 phút.
        </p>
        <div className="flex items-center gap-2 justify-center">
          <Button onClick={() => navigate(-1)} variant="outline"
            className="border-white/10 text-gray-300 hover:bg-white/5">
            Quay lại chọn suất
          </Button>
          <Button onClick={() => navigate('/movies')}
            className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold">
            Xem phim khác
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <CinemaScreen size="lg" />

      <div className="overflow-x-auto pb-4">
        <div className="inline-block min-w-full">
          {rows.map(([rowLabel, seats]) => (
            <div key={rowLabel} className="flex items-center gap-2 mb-2 justify-center">
              <span className="w-6 text-center text-sm text-gray-500 font-mono">{rowLabel}</span>
              <div className="flex gap-1.5 flex-wrap justify-center">
                <SeatRow
                  seats={seats}
                  selectedSeatIds={selectedSeatIds}
                  occupiedSeatIds={occupiedSeatIds}
                  onToggle={onToggle}
                />
              </div>
              <span className="w-6 text-center text-sm text-gray-500 font-mono">{rowLabel}</span>
            </div>
          ))}
        </div>
      </div>

      <SeatLegend />
    </>
  )
}

// ============================================================
//  Sub-components
// ============================================================

interface SeatRowProps {
  seats: SeatItem[]
  selectedSeatIds: number[]
  occupiedSeatIds: number[]
  onToggle: (seat: SeatItem, seatsInRow: SeatItem[]) => void
}

function SeatRow({ seats, selectedSeatIds, occupiedSeatIds, onToggle }: SeatRowProps) {
  const rendered: React.ReactElement[] = []
  const skipCols = new Set<number>()

  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i]
    if (skipCols.has(seat.colNumber)) continue

    // Lối đi — render khoảng trống thay vì button
    if (seat.aisle) {
      rendered.push(<AisleGap key={`aisle-${seat.id}`} />)
      continue
    }

    const isSelected = selectedSeatIds.includes(seat.id)
    const isOccupied = occupiedSeatIds.includes(seat.id)

    // COUPLE & SWEETBOX: gộp 2 cột thành 1 button (chỉ render seat cột lẻ)
    const isDoubleSeat = seat.seatType === 'COUPLE' || seat.seatType === 'SWEETBOX'
    if (isDoubleSeat) {
      const partner = seats[i + 1]
      const partnerIsSame = partner?.seatType === seat.seatType
      if (partnerIsSame && seat.colNumber % 2 === 1) {
        skipCols.add(partner.colNumber)
        rendered.push(
          <DoubleSeatButton
            key={seat.id}
            seat={seat}
            partner={partner}
            isSelected={isSelected && selectedSeatIds.includes(partner.id)}
            isOccupied={isOccupied || occupiedSeatIds.includes(partner.id)}
            onClick={() => onToggle(seat, seats)}
          />
        )
        continue
      }
    }

    // Ghế đơn (STANDARD, VIP, DELUXE, HANDICAP, BROKEN, BLOCKED)
    rendered.push(
      <SingleSeatButton
        key={seat.id}
        seat={seat}
        isSelected={isSelected}
        isOccupied={isOccupied}
        onClick={() => onToggle(seat, seats)}
      />
    )
  }
  return <>{rendered}</>
}

function AisleGap() {
  return <span className="w-8 h-8" aria-hidden="true" />
}

interface DoubleSeatButtonProps {
  seat: SeatItem
  partner: SeatItem
  isSelected: boolean
  isOccupied: boolean
  onClick: () => void
}

function DoubleSeatButton({ seat, partner, isSelected, isOccupied, onClick }: DoubleSeatButtonProps) {
  const baseColor = seat.seatType === 'SWEETBOX'
    ? 'bg-purple-600 hover:bg-purple-500'
    : 'bg-pink-600 hover:bg-pink-500'

  const colorClass = isOccupied
    ? 'bg-gray-600 cursor-not-allowed opacity-50'
    : isSelected
      ? 'bg-[#ffc107] text-black font-bold scale-105'
      : baseColor

  const typeLabel = seat.seatType === 'SWEETBOX' ? 'Sweetbox' : 'Ghế đôi'

  return (
    <button
      title={isOccupied
        ? `${seat.seatNumber}-${partner.seatNumber} (${typeLabel}) — đã có người đặt`
        : `${seat.seatNumber}-${partner.seatNumber} (${typeLabel}) — bấm để chọn CẢ CẶP, tính là 2 ghế`}
      aria-label={`${typeLabel} ${seat.seatNumber}-${partner.seatNumber} — bấm chọn cả cặp`}
      onClick={onClick}
      disabled={seat.status !== 'AVAILABLE' || isOccupied}
      className={`h-8 rounded-t-md text-xs font-medium transition-all duration-150 relative group ${colorClass}`}
      style={{ width: 'calc(2 * 2rem + 0.375rem)' }}
    >
      {isSelected ? <Check size={16} className="inline" /> : `${seat.colNumber}-${partner.colNumber}`}
      {/* Indicator nhỏ "cặp" — chỉ hiện trên ghế đôi, distinguish với 2 ghế đơn liền nhau */}
      {!isOccupied && !isSelected && (
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[7px] leading-none px-1 rounded-sm bg-white/20 text-white/80 font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          CẶP
        </span>
      )}
    </button>
  )
}

interface SingleSeatButtonProps {
  seat: SeatItem
  isSelected: boolean
  isOccupied: boolean
  onClick: () => void
}

function SingleSeatButton({ seat, isSelected, isOccupied, onClick }: SingleSeatButtonProps) {
  const isHandicap = seat.seatType === 'HANDICAP'
  return (
    <button
      title={`${seat.seatNumber} — ${label(SEAT_TYPE_LABELS, seat.seatType)}`}
      onClick={onClick}
      disabled={seat.status !== 'AVAILABLE' || isOccupied}
      className={`w-8 h-8 rounded-t-md text-xs font-medium transition-all duration-150 ${getSeatColor(seat, isSelected, isOccupied)}`}
    >
      {isSelected ? <Check size={16} className="inline" /> : isHandicap ? '♿' : seat.colNumber}
    </button>
  )
}

/**
 * Màu ghế đơn theo type + trạng thái (chuẩn industry rạp VN).
 *
 * <p>Quy ước: ghế available có màu sắc theo loại; ghế đã bán/hỏng dùng GRAY
 * để user dễ phân biệt "có thể chọn" vs "không chọn được".
 */
function getSeatColor(seat: SeatItem, isSelected: boolean, isOccupied: boolean): string {
  if (seat.status === 'BLOCKED') return 'bg-red-900 cursor-not-allowed opacity-80'
  if (seat.status === 'BROKEN') return 'bg-orange-600 cursor-not-allowed opacity-70'
  if (isOccupied) return 'bg-gray-500 cursor-not-allowed opacity-60'
  // Selected: KHÁC BIỆT RÕ với VIP — gold #ffc107 + ring trắng + scale + shadow
  if (isSelected) return 'bg-[#ffc107] text-black font-bold ring-4 ring-white scale-110 shadow-lg shadow-[#ffc107]/40'

  switch (seat.seatType) {
    case 'VIP':      return 'bg-yellow-600 hover:bg-yellow-500'  // yellow đậm, KHÔNG dùng #ffc107
    case 'DELUXE':   return 'bg-blue-600 hover:bg-blue-500'
    case 'HANDICAP': return 'bg-cyan-600 hover:bg-cyan-500'
    default:         return 'bg-green-600 hover:bg-green-500'  // STANDARD = GREEN
  }
}

function SeatLegend() {
  return (
    <div className="mt-6 mb-8 space-y-3">
      <div className="text-xs text-gray-500 text-center uppercase tracking-wider">Chú thích</div>
      <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-300">
        <LegendItem color="bg-green-600" label="Thường" />
        <LegendItem color="bg-yellow-600" label="VIP" />
        <LegendItem color="bg-pink-600" label="Đôi" wide />
        <LegendItem color="bg-purple-600" label="Sweetbox" wide />
        <LegendItem color="bg-blue-600" label="Deluxe" />
        <LegendItem color="bg-cyan-600" label="♿ Khuyết tật" />
      </div>
      <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-300 pt-1 border-t border-white/5">
        <LegendItem color="bg-[#ffc107] ring-2 ring-white" label="✓ Đang chọn" />
        <LegendItem color="bg-gray-500 opacity-60" label="Đã bán" />
        <LegendItem color="bg-orange-600 opacity-70" label="Bảo trì" />
        <LegendItem color="bg-red-900 opacity-80" label="Chặn vĩnh viễn" />
      </div>
    </div>
  )
}

interface LegendItemProps {
  color: string
  label: string
  wide?: boolean
}

function LegendItem({ color, label, wide }: LegendItemProps) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`${wide ? 'w-8' : 'w-4'} h-4 rounded ${color} inline-block`} /> {label}
    </span>
  )
}
