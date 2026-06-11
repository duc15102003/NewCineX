import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Eraser } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CinemaScreen from '@/components/common/CinemaScreen'

import { useGenerateSeats } from '@/hooks/useAdmin'
import { SEAT_TYPES, SEAT_BG, type SeatTypeKey } from '@/types/seatEditor'

const TOOL_KEYS_TYPES: SeatTypeKey[] = ['STANDARD', 'VIP', 'COUPLE', 'SWEETBOX', 'DELUXE', 'HANDICAP']
const TOOL_KEYS_SPECIAL: SeatTypeKey[] = ['AISLE', 'BROKEN', 'BLOCKED']

const DEFAULT_ROWS = 10
const DEFAULT_COLS = 12

export interface CustomPanelProps {
  roomId: number
  onClose: () => void
  generateMut: ReturnType<typeof useGenerateSeats>
}

/**
 * Custom panel — admin tự vẽ layout từng ô. Hỗ trợ COUPLE/SWEETBOX với
 * block-aware pairing (không vắt qua lối đi).
 */
export default function CustomPanel({ roomId, onClose, generateMut }: CustomPanelProps) {
  const [rows, setRows] = useState(DEFAULT_ROWS)
  const [cols, setCols] = useState(DEFAULT_COLS)
  const [tool, setTool] = useState<SeatTypeKey>('STANDARD')
  const [cells, setCells] = useState<Map<string, SeatTypeKey>>(() => initCells(DEFAULT_ROWS, DEFAULT_COLS))
  const [isDragging, setIsDragging] = useState(false)

  // Re-init khi rows/cols đổi (giữ lại data của cells trùng vị trí)
  useEffect(() => {
    setCells(prev => {
      const next = new Map<string, SeatTypeKey>()
      for (let r = 0; r < rows; r++) {
        const rowLabel = String.fromCharCode(65 + r)
        for (let c = 1; c <= cols; c++) {
          const key = `${rowLabel}:${c}`
          next.set(key, prev.get(key) ?? 'STANDARD')
        }
      }
      return next
    })
  }, [rows, cols])

  function applyTool(rowLabel: string, col: number) {
    const key = `${rowLabel}:${col}`
    const isDouble = tool === 'COUPLE' || tool === 'SWEETBOX'

    // Check validation NGOÀI setCells — tránh React StrictMode chạy updater 2 lần → toast 2 lần
    if (isDouble) {
      const partnerCol = findPartnerInBlock(rowLabel, col, cells, cols)
      if (partnerCol === null) {
        toast.warning(
          `${rowLabel}${col} không thể đặt ${tool === 'SWEETBOX' ? 'Sweetbox' : 'ghế đôi'} ` +
          `— ghế lẻ cuối dải không có cặp (ghế đôi không vắt qua lối đi).`
        )
        return
      }
    }

    setCells(prev => {
      const next = new Map(prev)

      if (isDouble) {
        const partnerCol = findPartnerInBlock(rowLabel, col, prev, cols)
        if (partnerCol === null) return prev // race-condition guard
        next.set(key, tool)
        next.set(`${rowLabel}:${partnerCol}`, tool)
      } else {
        // Tool khác: nếu cell đang là COUPLE/SWEETBOX → un-pair partner cùng type
        const current = prev.get(key)
        if (current === 'COUPLE' || current === 'SWEETBOX') {
          const partnerCol = findPartnerInBlock(rowLabel, col, prev, cols)
          if (partnerCol !== null && prev.get(`${rowLabel}:${partnerCol}`) === current) {
            next.set(`${rowLabel}:${partnerCol}`, tool)
          }
        }
        next.set(key, tool)
      }
      return next
    })
  }

  function handleReset() {
    setCells(initCells(rows, cols))
    toast.info('Đã reset toàn bộ về STANDARD')
  }

  function handleSubmit() {
    const customLayout: Array<{ row: string; col: number; seatType?: string; status?: string; aisle?: boolean }> = []
    for (let r = 0; r < rows; r++) {
      const rowLabel = String.fromCharCode(65 + r)
      for (let c = 1; c <= cols; c++) {
        const tk = cells.get(`${rowLabel}:${c}`) ?? 'STANDARD'
        const cell: typeof customLayout[number] = { row: rowLabel, col: c }
        if (tk === 'AISLE') {
          cell.aisle = true
          cell.seatType = 'STANDARD'
          cell.status = 'AVAILABLE'
        } else if (tk === 'BROKEN' || tk === 'BLOCKED') {
          cell.seatType = 'STANDARD'
          cell.status = tk
          cell.aisle = false
        } else {
          cell.seatType = tk
          cell.status = 'AVAILABLE'
          cell.aisle = false
        }
        customLayout.push(cell)
      }
    }
    generateMut.mutate({ roomId, data: { totalRows: rows, totalCols: cols, customLayout } }, {
      onSuccess: () => {
        toast.success(`Đã tạo ${customLayout.length} vị trí.`)
        onClose()
      }
    })
  }

  const stats = useMemo(() => countByType(cells), [cells])
  const bookableCount = Array.from(cells.values()).filter(t => t !== 'AISLE' && t !== 'BLOCKED').length

  return (
    <div className="space-y-3" onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}>
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Số hàng" value={rows} min={1} max={26} onChange={setRows} />
        <NumField label="Số cột" value={cols} min={1} max={30} onChange={setCols} />
      </div>

      <div className="flex gap-4">
        <ToolPalette tool={tool} onSelectTool={setTool}
          totalCells={cells.size} bookableCount={bookableCount} stats={stats} onReset={handleReset} />

        <SeatGrid rows={rows} cols={cols} cells={cells} isDragging={isDragging}
          onMouseDown={(r, c) => { setIsDragging(true); applyTool(r, c) }}
          onMouseEnter={(r, c) => { if (isDragging) applyTool(r, c) }}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
        <Button type="button" variant="outline" onClick={onClose}
          className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
        <Button onClick={handleSubmit} disabled={generateMut.isPending}
          className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
          {generateMut.isPending ? 'Đang tạo...' : `Tạo ${bookableCount} ghế bán được`}
        </Button>
      </div>
    </div>
  )
}

interface ToolPaletteProps {
  tool: SeatTypeKey
  onSelectTool: (t: SeatTypeKey) => void
  totalCells: number
  bookableCount: number
  stats: Record<string, number>
  onReset: () => void
}

function ToolPalette({ tool, onSelectTool, totalCells, bookableCount, stats, onReset }: ToolPaletteProps) {
  return (
    <div className="w-44 shrink-0 space-y-3">
      <div className="bg-[#2a2317] border border-white/5 rounded-lg p-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Loại ghế</p>
        <div className="space-y-1">
          {TOOL_KEYS_TYPES.map(k => (
            <ToolBtn key={k} toolKey={k} active={tool === k} onClick={() => onSelectTool(k)} />
          ))}
        </div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-3 mb-2">Đặc biệt</p>
        <div className="space-y-1">
          {TOOL_KEYS_SPECIAL.map(k => (
            <ToolBtn key={k} toolKey={k} active={tool === k} onClick={() => onSelectTool(k)} />
          ))}
        </div>
      </div>

      <Button type="button" variant="outline" onClick={onReset}
        className="w-full border-white/10 text-gray-300 hover:bg-white/5 text-xs">
        <Eraser size={12} className="mr-1" /> Reset tất cả
      </Button>

      <div className="bg-[#2a2317] border border-white/5 rounded-lg p-3 text-xs">
        <p className="text-gray-400 mb-1">Tổng vị trí: <strong className="text-white">{totalCells}</strong></p>
        <p className="text-gray-400">Bán được: <strong className="text-green-400">{bookableCount}</strong></p>
        <div className="border-t border-white/5 mt-2 pt-2 space-y-0.5">
          {Object.entries(stats).filter(([, v]) => v > 0).map(([k, v]) => (
            <div key={k} className="flex justify-between text-[11px]">
              <span className="text-gray-500">{SEAT_TYPES.find(t => t.key === k)?.label}</span>
              <span className="text-gray-300">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface SeatGridProps {
  rows: number
  cols: number
  cells: Map<string, SeatTypeKey>
  isDragging: boolean
  onMouseDown: (rowLabel: string, col: number) => void
  onMouseEnter: (rowLabel: string, col: number) => void
}

function SeatGrid({ rows, cols, cells, onMouseDown, onMouseEnter }: SeatGridProps) {
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

function ToolBtn({ toolKey, active, onClick }: { toolKey: SeatTypeKey; active: boolean; onClick: () => void }) {
  const meta = SEAT_TYPES.find(t => t.key === toolKey)!
  const isDouble = meta.width === 2
  return (
    <button type="button" onClick={onClick}
      title={meta.hint}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all ${
        active ? 'bg-white/10 ring-1 ring-[#ffc107] text-white' : 'text-gray-400 hover:bg-white/5'
      }`}>
      <span className={`${isDouble ? 'w-7' : 'w-4'} h-4 rounded shrink-0 ${meta.bgClass}`} />
      <span className="font-medium">{meta.label}</span>
    </button>
  )
}

function NumField({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <Input type="number" min={min} max={max} value={value || ''}
        onChange={e => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)))
        }} className="h-9 text-sm" />
    </div>
  )
}

/**
 * Tìm cột partner cho ghế đôi/sweetbox theo block (giữa các lối đi).
 *
 * Mở rộng trái-phải từ {@code col} đến khi gặp AISLE hoặc biên grid → xác định block.
 * Trong block, vị trí lẻ → partner = col+1; vị trí chẵn → partner = col-1.
 * Nếu partner ra ngoài block (block lẻ ghế, col đứng cuối) → null.
 */
function findPartnerInBlock(
  rowLabel: string,
  col: number,
  cells: Map<string, SeatTypeKey>,
  totalCols: number,
): number | null {
  let leftBound = col
  while (leftBound > 1 && cells.get(`${rowLabel}:${leftBound - 1}`) !== 'AISLE') {
    leftBound--
  }
  let rightBound = col
  while (rightBound < totalCols && cells.get(`${rowLabel}:${rightBound + 1}`) !== 'AISLE') {
    rightBound++
  }
  const posInBlock = col - leftBound + 1
  const isOddInBlock = posInBlock % 2 === 1
  const partnerCol = isOddInBlock ? col + 1 : col - 1
  if (partnerCol < leftBound || partnerCol > rightBound) return null
  return partnerCol
}

function initCells(rows: number, cols: number): Map<string, SeatTypeKey> {
  const m = new Map<string, SeatTypeKey>()
  for (let r = 0; r < rows; r++) {
    const rowLabel = String.fromCharCode(65 + r)
    for (let c = 1; c <= cols; c++) m.set(`${rowLabel}:${c}`, 'STANDARD')
  }
  return m
}

function countByType(cells: Map<string, SeatTypeKey>): Record<string, number> {
  const result: Record<string, number> = {}
  cells.forEach(v => { result[v] = (result[v] ?? 0) + 1 })
  return result
}
