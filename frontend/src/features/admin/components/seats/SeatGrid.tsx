import CinemaScreen from '@/components/common/CinemaScreen'
import { SEAT_TYPES, SEAT_BG, type SeatTypeKey } from '@/types/seatEditor'

export interface SeatGridProps {
  rows: number
  cols: number
  cells: Map<string, SeatTypeKey>
  onMouseDown: (rowLabel: string, col: number) => void
  onMouseEnter: (rowLabel: string, col: number) => void
}

/** Visual grid render — header cột số, mỗi row có 2 nhãn chữ (trái-phải), cell click/drag. */
export default function SeatGrid({ rows, cols, cells, onMouseDown, onMouseEnter }: SeatGridProps) {
  return (
    <div className="flex-1 overflow-auto bg-[#181309] border border-white/5 rounded-lg p-4">
      <CinemaScreen size="sm" />

      <div className="flex justify-center">
        <div className="select-none inline-block">
          <div className="flex gap-0.5 mb-1 justify-center">
            <span className="w-5 shrink-0" aria-hidden="true" />
            <span className="w-1 shrink-0" aria-hidden="true" />
            {Array.from({ length: cols }).map((_, i) => (
              <div key={i} className="w-5 text-center text-[9px] text-gray-500 font-mono">{i + 1}</div>
            ))}
            <span className="w-1 shrink-0" aria-hidden="true" />
            <span className="w-5 shrink-0" aria-hidden="true" />
          </div>
          {Array.from({ length: rows }).map((_, rIdx) => {
            const rowLabel = String.fromCharCode(65 + rIdx)
            return (
              <div key={rowLabel} className="flex items-center gap-1 mb-0.5 justify-center">
                <span className="w-5 text-center text-[10px] text-gray-500 font-mono shrink-0">{rowLabel}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: cols }).map((_, cIdx) => {
                    const col = cIdx + 1
                    const cellKey = `${rowLabel}:${col}`
                    const tk = cells.get(cellKey) ?? 'STANDARD'
                    return (
                      <button
                        key={cellKey}
                        type="button"
                        onMouseDown={() => onMouseDown(rowLabel, col)}
                        onMouseEnter={() => onMouseEnter(rowLabel, col)}
                        title={`${cellKey} — ${SEAT_TYPES.find(t => t.key === tk)?.label}`}
                        className={`w-5 h-5 rounded-sm transition-colors ${SEAT_BG[tk]}`}
                      />
                    )
                  })}
                </div>
                <span className="w-5 text-center text-[10px] text-gray-500 font-mono shrink-0">{rowLabel}</span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[10px] text-gray-500 italic mt-3 text-center">
        Click hoặc kéo chuột để vẽ. Đôi/Sweetbox tự ghép cặp 2 ô liền kề trong cùng dải — không vắt qua lối đi.
      </p>
    </div>
  )
}
