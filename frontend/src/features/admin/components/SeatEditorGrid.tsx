import React from 'react'
import CinemaScreen from '@/components/common/CinemaScreen'
import type { SeatItem } from '@/hooks/useAdmin'
import { SEAT_BG, SEAT_TYPES, type SeatTypeKey } from '@/types/seatEditor'
import { isDouble, isSeatBlockedForTool } from '../utils/seatPairing'

export interface SeatEditorGridProps {
  rows: [string, SeatItem[]][]
  maxCols: number
  previewMode: boolean
  pendingChanges: Map<number, SeatTypeKey>
  /** Tool đang chọn — để render visual hint khi ô không pair được. */
  activeTool: SeatTypeKey
  getDisplayType: (seat: SeatItem) => SeatTypeKey
  onMouseDown: (seat: SeatItem, seats: SeatItem[]) => void
  onMouseEnter: (seat: SeatItem, seats: SeatItem[]) => void
}

/** Khu vực chính: màn chiếu + cột header + grid ghế + legend. */
export default function SeatEditorGrid(props: SeatEditorGridProps) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-[#201b11] border border-[#3f382d] rounded-2xl p-6 min-w-fit">
        <CinemaScreen size="lg" />
        <ColumnLabels maxCols={props.maxCols} />
        <div className="space-y-1.5 select-none">
          {props.rows.map(([rowLabel, seats]) => (
            <div key={rowLabel} className="flex items-center justify-center gap-1.5">
              <span className="w-6 text-center text-xs text-gray-500 font-mono font-bold shrink-0">
                {rowLabel}
              </span>
              <RowSeats
                seats={seats}
                previewMode={props.previewMode}
                pendingChanges={props.pendingChanges}
                activeTool={props.activeTool}
                getDisplayType={props.getDisplayType}
                onMouseDown={props.onMouseDown}
                onMouseEnter={props.onMouseEnter}
              />
              <span className="w-6 text-center text-xs text-gray-500 font-mono font-bold shrink-0">
                {rowLabel}
              </span>
            </div>
          ))}
        </div>
        <Legend />
      </div>
    </div>
  )
}

function ColumnLabels({ maxCols }: { maxCols: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-2">
      <span className="w-6 shrink-0" />
      {Array.from({ length: maxCols }, (_, i) => (
        <div key={i} className="w-9 text-center text-xs text-gray-500 font-mono">{i + 1}</div>
      ))}
      <span className="w-6 shrink-0" />
    </div>
  )
}

interface RowSeatsProps {
  seats: SeatItem[]
  previewMode: boolean
  pendingChanges: Map<number, SeatTypeKey>
  activeTool: SeatTypeKey
  getDisplayType: (seat: SeatItem) => SeatTypeKey
  onMouseDown: (seat: SeatItem, seats: SeatItem[]) => void
  onMouseEnter: (seat: SeatItem, seats: SeatItem[]) => void
}

function RowSeats({ seats, previewMode, pendingChanges, activeTool, getDisplayType, onMouseDown, onMouseEnter }: RowSeatsProps) {
  const rendered: React.ReactElement[] = []
  const skipCols = new Set<number>()

  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i]
    if (skipCols.has(seat.colNumber)) continue
    const displayType = getDisplayType(seat)
    const isChanged = pendingChanges.has(seat.id)

    // COUPLE/SWEETBOX: gộp 2 ô thành 1 button rộng
    if (isDouble(displayType)) {
      const partner = seats[i + 1]
      const partnerSame = partner && getDisplayType(partner) === displayType
      if (partnerSame && seat.colNumber % 2 === 1) {
        const partnerChanged = pendingChanges.has(partner.id)
        skipCols.add(partner.colNumber)
        const meta = SEAT_TYPES.find(t => t.key === displayType)
        rendered.push(
          <button
            key={seat.id}
            onMouseDown={() => onMouseDown(seat, seats)}
            onMouseEnter={() => onMouseEnter(seat, seats)}
            title={`${seat.seatNumber}-${partner.seatNumber} — ${meta?.label}`}
            className={`h-9 rounded-t-lg text-[10px] font-bold transition-all duration-100
              ${SEAT_BG[displayType]}
              ${isChanged || partnerChanged ? 'ring-2 ring-[#ffc107] scale-105' : ''}
              ${previewMode ? 'cursor-default' : 'cursor-pointer'}`}
            style={{ width: 'calc(2 * 2.25rem + 0.375rem)' }}
          >
            {seat.colNumber}-{partner.colNumber}
          </button>
        )
        continue
      }
    }

    // Ghế đơn (STANDARD, VIP, DELUXE, HANDICAP, BROKEN, BLOCKED, AISLE)
    const isAisle = displayType === 'AISLE'
    // Visual hint: nếu activeTool là COUPLE/SWEETBOX và ô không pair được
    // (chính nó hoặc partner bị block) → mờ + viền đỏ. Admin nhìn là biết.
    const isBlockedForTool = !previewMode && isSeatBlockedForTool(seat, seats, activeTool, pendingChanges)
    const blockedHint = isBlockedForTool ? ' opacity-40 ring-1 ring-red-500/40' : ''
    rendered.push(
      <button
        key={seat.id}
        onMouseDown={() => onMouseDown(seat, seats)}
        onMouseEnter={() => onMouseEnter(seat, seats)}
        title={isBlockedForTool
          ? `${seat.seatNumber} — không thể đặt ghế đôi (chặn bởi lối đi / ghế hỏng)`
          : `${seat.seatNumber} — ${SEAT_TYPES.find(t => t.key === displayType)?.label}`}
        className={`w-9 h-9 rounded-t-lg text-[10px] font-bold transition-all duration-100
          ${SEAT_BG[displayType]}
          ${isChanged ? 'ring-2 ring-[#ffc107] scale-105' : ''}
          ${blockedHint}
          ${previewMode ? 'cursor-default' : 'cursor-pointer'}`}
      >
        {isAisle ? '' : displayType === 'HANDICAP' ? '♿' : seat.colNumber}
      </button>
    )
  }
  return <>{rendered}</>
}

function Legend() {
  // Tách 2 nhóm: Loại ghế (6) và Đặc biệt (3: AISLE/BROKEN/BLOCKED)
  const seatTypes = SEAT_TYPES.filter(t => !['AISLE', 'BROKEN', 'BLOCKED'].includes(t.key))
  const specials = SEAT_TYPES.filter(t => ['AISLE', 'BROKEN', 'BLOCKED'].includes(t.key))

  return (
    <div className="mt-8 pt-4 border-t border-white/5 space-y-3">
      <div className="flex flex-wrap justify-center gap-3">
        {seatTypes.map(t => (
          <LegendItem key={t.key} colorClass={SEAT_BG[t.key]} label={t.label} wide={t.width === 2} />
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-3 pt-1">
        {specials.map(t => (
          <LegendItem key={t.key} colorClass={SEAT_BG[t.key]} label={t.label} />
        ))}
      </div>
      <p className="text-[10px] text-center text-gray-500 italic">
        Ghế có viền vàng = vừa sửa (chưa lưu). Bấm <strong className="text-[#ffc107]">Lưu</strong> để áp dụng.
      </p>
    </div>
  )
}

function LegendItem({ colorClass, label, wide }: { colorClass: string; label: string; wide?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <span className={`${wide ? 'w-8' : 'w-4'} h-4 rounded ${colorClass}`} />
      <span>{label}</span>
    </div>
  )
}
