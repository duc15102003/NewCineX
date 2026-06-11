import React from 'react'
import { Check } from 'lucide-react'
import CinemaScreen from '@/components/common/CinemaScreen'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { label, SEAT_TYPE_LABELS } from '@/utils/labels'
import type { POSSeat } from '@/hooks/usePOS'

export interface POSSeatGridProps {
  roomName: string
  rows: Array<[string, POSSeat[]]>
  selectedSeats: number[]
  occupiedIds: number[]
  onToggleSeat: (seat: POSSeat, rowSeats: POSSeat[]) => void
}

/**
 * Sơ đồ ghế POS với 6 SeatType chuẩn industry + AISLE/BLOCKED support.
 *
 * <p>Phân biệt VIP vs Selected:
 * - VIP available: yellow-600 (yellow đậm)
 * - Selected: gold {@code #ffc107} + ring trắng 4px + scale + icon ✓ (khác biệt rõ)
 */
export default function POSSeatGrid({
  roomName, rows, selectedSeats, occupiedIds, onToggleSeat,
}: POSSeatGridProps) {
  return (
    <Card className="bg-[#201b11] border-white/5 rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base">Sơ đồ ghế — {roomName}</CardTitle>
      </CardHeader>
      <CardContent>
        <CinemaScreen size="lg" />

        <div className="space-y-2 overflow-x-auto pb-4">
          {rows.map(([rowLabel, seats]) => (
            <div key={rowLabel} className="flex items-center gap-2 justify-center">
              <span className="w-6 text-center text-sm text-gray-500 font-mono">{rowLabel}</span>
              <div className="flex gap-1.5">
                <SeatRow seats={seats} selectedSeats={selectedSeats} occupiedIds={occupiedIds} onToggleSeat={onToggleSeat} />
              </div>
              <span className="w-6 text-center text-sm text-gray-500 font-mono">{rowLabel}</span>
            </div>
          ))}
        </div>

        <Legend />
      </CardContent>
    </Card>
  )
}

// ============================================================
//  Sub-components
// ============================================================

interface SeatRowProps {
  seats: POSSeat[]
  selectedSeats: number[]
  occupiedIds: number[]
  onToggleSeat: (seat: POSSeat, rowSeats: POSSeat[]) => void
}

function SeatRow({ seats, selectedSeats, occupiedIds, onToggleSeat }: SeatRowProps) {
  const rendered: React.ReactElement[] = []
  const skipCols = new Set<number>()

  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i]
    if (skipCols.has(seat.colNumber)) continue

    // Lối đi — khoảng trống
    if (seat.aisle) {
      rendered.push(<span key={`aisle-${seat.id}`} className="w-10 h-10" aria-hidden="true" />)
      continue
    }

    const isSelected = selectedSeats.includes(seat.id)
    const isOccupied = occupiedIds.includes(seat.id)

    // COUPLE/SWEETBOX gộp 2 cột
    const isDouble = seat.seatType === 'COUPLE' || seat.seatType === 'SWEETBOX'
    if (isDouble) {
      const partner = seats[i + 1]
      const partnerSame = partner?.seatType === seat.seatType
      if (partnerSame && seat.colNumber % 2 === 1) {
        skipCols.add(partner.colNumber)
        rendered.push(
          <DoubleSeatButton
            key={seat.id}
            seat={seat}
            partner={partner}
            pairSelected={isSelected && selectedSeats.includes(partner.id)}
            pairOccupied={isOccupied || occupiedIds.includes(partner.id)}
            onClick={() => onToggleSeat(seat, seats)}
          />
        )
        continue
      }
    }

    rendered.push(
      <SingleSeatButton
        key={seat.id}
        seat={seat}
        isSelected={isSelected}
        isOccupied={isOccupied}
        onClick={() => onToggleSeat(seat, seats)}
      />
    )
  }
  return <>{rendered}</>
}

interface DoubleSeatButtonProps {
  seat: POSSeat
  partner: POSSeat
  pairSelected: boolean
  pairOccupied: boolean
  onClick: () => void
}

function DoubleSeatButton({ seat, partner, pairSelected, pairOccupied, onClick }: DoubleSeatButtonProps) {
  const pairBlocked = seat.status === 'BLOCKED' || partner.status === 'BLOCKED'
  const pairBroken = seat.status === 'BROKEN' || partner.status === 'BROKEN'
  const baseColor = seat.seatType === 'SWEETBOX' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-pink-600 hover:bg-pink-500'

  let cls = baseColor
  if (pairBlocked) cls = 'bg-red-900 opacity-80 cursor-not-allowed'
  else if (pairBroken) cls = 'bg-orange-600 opacity-70 cursor-not-allowed'
  else if (pairOccupied) cls = 'bg-gray-500 opacity-60 cursor-not-allowed'
  else if (pairSelected) cls = 'bg-[#ffc107] text-black font-bold ring-4 ring-white scale-105 shadow-lg shadow-[#ffc107]/40'

  const typeLabel = seat.seatType === 'SWEETBOX' ? 'Sweetbox' : 'Đôi'

  return (
    <button
      title={`${seat.seatNumber}-${partner.seatNumber} (${typeLabel})`}
      disabled={pairBlocked || pairBroken || pairOccupied}
      onClick={onClick}
      className={`h-10 rounded-t-md text-sm font-medium transition-all ${cls}`}
      style={{ width: 'calc(2 * 2.5rem + 0.375rem)' }}
    >
      {pairSelected ? <Check size={16} className="inline" /> : `${seat.colNumber}-${partner.colNumber}`}
    </button>
  )
}

interface SingleSeatButtonProps {
  seat: POSSeat
  isSelected: boolean
  isOccupied: boolean
  onClick: () => void
}

function SingleSeatButton({ seat, isSelected, isOccupied, onClick }: SingleSeatButtonProps) {
  const isHandicap = seat.seatType === 'HANDICAP'
  const disabled = seat.status !== 'AVAILABLE' || isOccupied
  return (
    <button
      title={`${seat.seatNumber} (${label(SEAT_TYPE_LABELS, seat.seatType)})`}
      disabled={disabled}
      onClick={onClick}
      className={`w-10 h-10 rounded-t-md text-sm font-medium transition-all ${getSeatColor(seat, isSelected, isOccupied)}`}
    >
      {isSelected ? <Check size={16} className="inline" /> : isHandicap ? '♿' : seat.colNumber}
    </button>
  )
}

function getSeatColor(seat: POSSeat, isSelected: boolean, isOccupied: boolean): string {
  if (seat.status === 'BLOCKED') return 'bg-red-900 cursor-not-allowed opacity-80'
  if (seat.status === 'BROKEN') return 'bg-orange-600 cursor-not-allowed opacity-70'
  if (isOccupied) return 'bg-gray-500 cursor-not-allowed opacity-60'
  // Selected: gold rõ ràng + ring trắng + scale + shadow để khác biệt với VIP
  if (isSelected) return 'bg-[#ffc107] text-black font-bold ring-4 ring-white scale-110 shadow-lg shadow-[#ffc107]/40'

  switch (seat.seatType) {
    case 'VIP':      return 'bg-yellow-600 hover:bg-yellow-500'   // yellow đậm (KHÁC #ffc107 selected)
    case 'DELUXE':   return 'bg-blue-600 hover:bg-blue-500'
    case 'HANDICAP': return 'bg-cyan-600 hover:bg-cyan-500'
    default:         return 'bg-green-600 hover:bg-green-500'      // STANDARD
  }
}

function Legend() {
  return (
    <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
      <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-400">
        <LegendItem color="bg-green-600" label="Thường" />
        <LegendItem color="bg-yellow-600" label="VIP" />
        <LegendItem color="bg-pink-600" label="Đôi" wide />
        <LegendItem color="bg-purple-600" label="Sweetbox" wide />
        <LegendItem color="bg-blue-600" label="Deluxe" />
        <LegendItem color="bg-cyan-600" label="♿ Khuyết tật" />
      </div>
      <div className="flex flex-wrap justify-center gap-3 pt-1 text-xs text-gray-400">
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
      <span className={`${wide ? 'w-8' : 'w-4'} h-4 rounded ${color}`} /> {label}
    </span>
  )
}
