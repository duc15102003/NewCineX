import React from 'react'
import CinemaScreen from '@/components/common/CinemaScreen'
import type { SeatItem } from '@/hooks/useAdmin'
import { SEAT_BG, SEAT_TYPES, type SeatTypeKey } from '@/types/seatEditor'
import { isDouble, isSeatBlockedForTool } from '../utils/seatPairing'

export interface SeatEditorGridProps {
  rows: [string, SeatItem[]][]
  maxCols: number
  pendingChanges: Map<number, SeatTypeKey>
  /** Tool đang chọn — để render visual hint khi ô không pair được. */
  activeTool: SeatTypeKey
  getDisplayType: (seat: SeatItem) => SeatTypeKey
  onMouseDown: (seat: SeatItem, seats: SeatItem[]) => void
  onMouseEnter: (seat: SeatItem, seats: SeatItem[]) => void
  /** Live preview resize: số hàng/cột target. Khi != current → render
   *  placeholder dashed cho hàng/cột mới + overlay đỏ cho hàng/cột sẽ xoá. */
  targetRows?: number
  targetCols?: number
}

/** Khu vực chính: màn chiếu + cột header + grid ghế + legend. */
export default function SeatEditorGrid(props: SeatEditorGridProps) {
  const currentRows = props.rows.length
  const currentMaxCols = props.maxCols
  const targetRows = props.targetRows ?? currentRows
  const targetCols = props.targetCols ?? currentMaxCols
  const displayRows = Math.max(currentRows, targetRows)
  const displayCols = Math.max(currentMaxCols, targetCols)

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-[#201b11] border border-[#3f382d] rounded-2xl p-6 min-w-fit">
        <CinemaScreen size="lg" />
        <ColumnLabels displayCols={displayCols} targetCols={targetCols} currentCols={currentMaxCols} />
        <div className="space-y-1.5 select-none">
          {Array.from({ length: displayRows }).map((_, rowIdx) => {
            const rowLabel = String.fromCharCode('A'.charCodeAt(0) + rowIdx)
            const existing = props.rows[rowIdx]
            const willBeRemoved = rowIdx >= targetRows                 // shrink
            const willBeAdded = rowIdx >= currentRows                  // grow

            return (
              <div key={rowLabel}
                className={`flex items-center justify-center gap-1.5 ${willBeRemoved ? 'opacity-50' : ''}`}>
                <RowLabel label={rowLabel} willBeRemoved={willBeRemoved} willBeAdded={willBeAdded} />
                {existing ? (
                  <RowSeatsWithPreview
                    seats={existing[1]}
                    targetCols={targetCols}
                    currentMaxCols={currentMaxCols}
                    displayCols={displayCols}
                    pendingChanges={props.pendingChanges}
                    activeTool={props.activeTool}
                    getDisplayType={props.getDisplayType}
                    onMouseDown={props.onMouseDown}
                    onMouseEnter={props.onMouseEnter}
                  />
                ) : (
                  <PlaceholderRow displayCols={displayCols} targetCols={targetCols} />
                )}
                <RowLabel label={rowLabel} willBeRemoved={willBeRemoved} willBeAdded={willBeAdded} />
              </div>
            )
          })}
        </div>
        <Legend />
      </div>
    </div>
  )
}

function RowLabel({ label, willBeRemoved, willBeAdded }: {
  label: string; willBeRemoved: boolean; willBeAdded: boolean
}) {
  const cls = willBeRemoved
    ? 'text-red-400'
    : willBeAdded
    ? 'text-green-400'
    : 'text-gray-500'
  return (
    <span className={`w-6 text-center text-xs ${cls} font-mono font-bold shrink-0`}>
      {label}
    </span>
  )
}

function ColumnLabels({ displayCols, targetCols, currentCols }: {
  displayCols: number; targetCols: number; currentCols: number
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-2">
      <span className="w-6 shrink-0" />
      {Array.from({ length: displayCols }, (_, i) => {
        const col = i + 1
        const willBeRemoved = col > targetCols
        const willBeAdded = col > currentCols
        const cls = willBeRemoved
          ? 'text-red-400'
          : willBeAdded
          ? 'text-green-400'
          : 'text-gray-500'
        return (
          <div key={i} className={`w-7 text-center text-xs ${cls} font-mono`}>{col}</div>
        )
      })}
      <span className="w-6 shrink-0" />
    </div>
  )
}

/** Render hàng placeholder cho hàng MỚI (chưa có data). Tất cả cell dashed. */
function PlaceholderRow({ displayCols, targetCols }: {
  displayCols: number; targetCols: number
}) {
  return (
    <>
      {Array.from({ length: displayCols }, (_, i) => {
        const col = i + 1
        const inTarget = col <= targetCols
        return (
          <span key={i}
            className={`w-7 h-7 rounded-t-lg border-2 border-dashed ${
              inTarget
                ? 'border-green-500/40 bg-green-500/5'
                : 'border-transparent'
            }`}
            title={inTarget ? `Ghế mới sẽ thêm` : ''}
          />
        )
      })}
    </>
  )
}

interface RowSeatsWithPreviewProps {
  seats: SeatItem[]
  targetCols: number
  currentMaxCols: number
  displayCols: number
  pendingChanges: Map<number, SeatTypeKey>
  activeTool: SeatTypeKey
  getDisplayType: (seat: SeatItem) => SeatTypeKey
  onMouseDown: (seat: SeatItem, seats: SeatItem[]) => void
  onMouseEnter: (seat: SeatItem, seats: SeatItem[]) => void
}

/**
 * Render seats hiện có + overlay/placeholder cho live preview resize.
 * - Cell có data nằm trong targetCols: render bình thường
 * - Cell có data nằm ngoài targetCols (shrink): overlay đỏ "sẽ xoá"
 * - Cell ngoài data, trong targetCols (grow): placeholder dashed "sẽ thêm"
 * - Cell ngoài cả 2: empty spacer giữ alignment
 */
function RowSeatsWithPreview(props: RowSeatsWithPreviewProps) {
  const { seats, targetCols, displayCols } = props
  const seatsByCol = new Map<number, SeatItem>()
  seats.forEach(s => seatsByCol.set(s.colNumber, s))

  const rendered: React.ReactElement[] = []
  const skipCols = new Set<number>()

  for (let col = 1; col <= displayCols; col++) {
    if (skipCols.has(col)) continue
    const seat = seatsByCol.get(col)
    const willBeRemoved = col > targetCols

    if (seat) {
      // Có data hiện có
      const partnerSkipped = renderExistingSeat(
        col, seat, seatsByCol, skipCols, rendered, props, willBeRemoved,
      )
      if (partnerSkipped) continue
    } else if (col <= targetCols) {
      // Grow: placeholder cho ghế mới sẽ thêm
      rendered.push(
        <span key={`new-${col}`}
          className="w-7 h-7 rounded-t-lg border-2 border-dashed border-green-500/40 bg-green-500/5"
          title="Ghế mới sẽ thêm" />
      )
    } else {
      // Ngoài cả data lẫn target → spacer transparent
      rendered.push(<span key={`gap-${col}`} className="w-7 h-7" />)
    }
  }

  return <>{rendered}</>
}

/** Render 1 seat (single hoặc double). Trả về true nếu là double + đã skip partner. */
function renderExistingSeat(
  col: number,
  seat: SeatItem,
  seatsByCol: Map<number, SeatItem>,
  skipCols: Set<number>,
  rendered: React.ReactElement[],
  props: RowSeatsWithPreviewProps,
  willBeRemoved: boolean,
): boolean {
  const { pendingChanges, activeTool, getDisplayType, onMouseDown, onMouseEnter } = props
  const seats = props.seats
  const displayType = getDisplayType(seat)
  const isChanged = pendingChanges.has(seat.id)
  const shrinkOverlay = willBeRemoved
    ? 'opacity-40 ring-2 ring-red-500/60'
    : ''

  // COUPLE/SWEETBOX: gộp 2 ô. Render wide button khi seat đang COUPLE/
  // SWEETBOX VÀ neighbor PHẢI cùng type — không quan tâm col parity vì
  // cặp có thể tạo cả 2 direction (11-12 canonical hoặc 12-13 fallback).
  // Nếu seat đang COUPLE nhưng KHÔNG có neighbor cùng type → orphan,
  // render as single button + visual hint warning (border đỏ) cho admin biết.
  if (isDouble(displayType)) {
    const partner = seatsByCol.get(col + 1)
    const partnerSame = partner && getDisplayType(partner) === displayType
    if (partnerSame) {
      const partnerChanged = pendingChanges.has(partner.id)
      skipCols.add(partner.colNumber)
      const meta = SEAT_TYPES.find(t => t.key === displayType)
      rendered.push(
        <button
          key={seat.id}
          onMouseDown={() => !willBeRemoved && onMouseDown(seat, seats)}
          onMouseEnter={() => !willBeRemoved && onMouseEnter(seat, seats)}
          title={willBeRemoved
            ? `${seat.seatNumber}-${partner.seatNumber} — sẽ bị xoá khi áp dụng kích thước mới`
            : `${seat.seatNumber}-${partner.seatNumber} — ${meta?.label}`}
          disabled={willBeRemoved}
          className={`h-7 rounded-t-lg text-[10px] font-bold transition-all duration-100
            ${SEAT_BG[displayType]}
            ${isChanged || partnerChanged ? 'ring-2 ring-[#ffc107] scale-105' : ''}
            ${shrinkOverlay}
            ${willBeRemoved ? 'cursor-default' : 'cursor-pointer'}`}
          style={{ width: 'calc(2 * 1.75rem + 0.25rem)' }}
        >
          {seat.colNumber}-{partner.colNumber}
        </button>
      )
      return true
    }
    // Orphan COUPLE: rơi xuống render single button với ring đỏ warning
  }

  // Ghế đơn
  const isAisle = displayType === 'AISLE'
  // Orphan COUPLE/SWEETBOX (đứng 1 mình, không có partner cùng type) → ring
  // đỏ + tooltip warning để admin biết phải fix trước khi lưu (findOrphanCouple
  // sẽ block save anyway, nhưng visual hint sớm là UX chuẩn industry).
  const isOrphanDouble = isDouble(displayType)
  const orphanHint = isOrphanDouble ? ' ring-2 ring-red-500/70 animate-pulse' : ''
  const isBlockedForTool = !willBeRemoved && !isOrphanDouble
    && isSeatBlockedForTool(seat, seats, activeTool, pendingChanges)
  const blockedHint = isBlockedForTool ? ' opacity-40 ring-1 ring-red-500/40' : ''
  rendered.push(
    <button
      key={seat.id}
      onMouseDown={() => !willBeRemoved && onMouseDown(seat, seats)}
      onMouseEnter={() => !willBeRemoved && onMouseEnter(seat, seats)}
      title={willBeRemoved
        ? `${seat.seatNumber} — sẽ bị xoá khi áp dụng kích thước mới`
        : isOrphanDouble
        ? `${seat.seatNumber} — ${displayType === 'SWEETBOX' ? 'Sweetbox' : 'ghế đôi'} đứng lẻ, cần ghép cặp hoặc đổi sang ghế thường trước khi lưu`
        : isBlockedForTool
        ? `${seat.seatNumber} — không thể đặt ghế đôi (chặn bởi lối đi / ghế hỏng)`
        : `${seat.seatNumber} — ${SEAT_TYPES.find(t => t.key === displayType)?.label}`}
      disabled={willBeRemoved}
      className={`w-7 h-7 rounded-t-lg text-[10px] font-bold transition-all duration-100
        ${SEAT_BG[displayType]}
        ${isChanged ? 'ring-2 ring-[#ffc107] scale-105' : ''}
        ${blockedHint}
        ${orphanHint}
        ${shrinkOverlay}
        ${willBeRemoved ? 'cursor-default' : 'cursor-pointer'}`}
    >
      {isAisle ? '' : displayType === 'HANDICAP' ? '♿' : seat.colNumber}
    </button>
  )
  return false
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
      <span className={`${wide ? 'w-6' : 'w-3.5'} h-3.5 rounded ${colorClass}`} />
      <span>{label}</span>
    </div>
  )
}
