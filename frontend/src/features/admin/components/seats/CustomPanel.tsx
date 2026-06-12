import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { useGenerateSeats } from '@/hooks/useAdmin'
import type { SeatTypeKey } from '@/types/seatEditor'

import ToolPalette from './ToolPalette'
import SeatGrid from './SeatGrid'

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
 *
 * Sub-components: ./ToolPalette (sidebar trái) + ./SeatGrid (visual grid).
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

    // Check NGOÀI setCells — tránh React StrictMode chạy updater 2 lần → toast 2 lần
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

        <SeatGrid rows={rows} cols={cols} cells={cells}
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
