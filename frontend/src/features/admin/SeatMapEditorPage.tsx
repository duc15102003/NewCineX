import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Save, RotateCcw, Maximize2, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import Loading from '@/components/common/Loading'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useSeatMap, useBulkUpdateSeats, useResizeSeatGrid, useGenerateSeats } from '@/hooks/useAdmin'
import type { SeatItem } from '@/hooks/useAdmin'
import { LayoutGrid, Info } from 'lucide-react'

import SeatEditorToolPanel from './components/SeatEditorToolPanel'
import SeatEditorGrid from './components/SeatEditorGrid'
import SeatStatsStrip from './components/SeatStatsStrip'
import { SEAT_TYPES, type SeatTypeKey } from '@/types/seatEditor'
import {
  isDouble, getDoublePartner, findCurrentCouplePartner,
  getBlockingState, findOrphanCouple, findEmptyRows,
} from './utils/seatPairing'

/* Pair logic tách sang ./utils/seatPairing.ts */

export default function SeatMapEditorPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const id = Number(roomId)

  const [activeTool, setActiveTool] = useState<SeatTypeKey>('STANDARD')
  const [pendingChanges, setPendingChanges] = useState<Map<number, SeatTypeKey>>(new Map())
  const [isDragging, setIsDragging] = useState(false)

  const { data: seatMap, isLoading } = useSeatMap(id)
  const bulkUpdateMut = useBulkUpdateSeats(id)
  const resizeMut = useResizeSeatGrid(id)

  // Resize state — sync với seatMap khi load lần đầu
  const [resizeRows, setResizeRows] = useState(0)
  const [resizeCols, setResizeCols] = useState(0)
  const [shrinkConfirmOpen, setShrinkConfirmOpen] = useState(false)
  useEffect(() => {
    if (!seatMap) return
    const rows = Object.keys(seatMap.seatMap).length
    const cols = Math.max(0, ...Object.values(seatMap.seatMap).map(r => r.length))
    setResizeRows(rows)
    setResizeCols(cols)
  }, [seatMap])

  /** Compute display type theo ưu tiên: pendingChange > isAisle > BLOCKED > BROKEN > seatType */
  function getDisplayType(seat: SeatItem): SeatTypeKey {
    const pending = pendingChanges.get(seat.id)
    if (pending) return pending
    if (seat.aisle) return 'AISLE'
    if (seat.status === 'BLOCKED') return 'BLOCKED'
    if (seat.status === 'BROKEN') return 'BROKEN'
    return seat.seatType
  }

  function getDisplayFromMap(seat: SeatItem, map: Map<number, SeatTypeKey>): SeatTypeKey {
    const m = map.get(seat.id)
    if (m) return m
    if (seat.aisle) return 'AISLE'
    if (seat.status === 'BLOCKED') return 'BLOCKED'
    if (seat.status === 'BROKEN') return 'BROKEN'
    return seat.seatType
  }

  /**
   * Apply tool lên ghế — handle TẤT CẢ case ghép cặp + cascade unpair.
   *
   * <p>Pair flow (activeTool là COUPLE/SWEETBOX):
   * 1. Tìm candidate partner (canonical odd-left, fallback opposite direction)
   * 2. Validate partner tồn tại + không phải lối đi / broken / blocked
   * 3. Cascade unpair: nếu seat hoặc partner đang ở cặp KHÁC → set mate cũ
   *    sang STANDARD để tránh orphan COUPLE 3 ghế kiểu 11-12-13
   * 4. Set seat + partner = activeTool
   *
   * <p>Unpair flow (currentType là double, activeTool khác):
   * 1. Tìm ACTUAL partner (findCurrentCouplePartner — same-type adjacent)
   *    KHÔNG dùng canonical vì cặp có thể được pair fallback direction
   * 2. Set seat + actualPartner = activeTool
   */
  const applySeatChange = useCallback((seat: SeatItem, seats: SeatItem[]) => {
    const currentType = getDisplayFromMap(seat, pendingChanges)
    if (currentType === activeTool) return

    // Pre-check ngoài setState (tránh React StrictMode chạy updater 2 lần → toast 2 lần)
    if (isDouble(activeTool)) {
      const partner = getDoublePartner(seat, seats)
      const toolLabel = activeTool === 'SWEETBOX' ? 'Sweetbox' : 'ghế đôi'
      if (!partner) {
        toast.warning(`${seat.seatNumber} không thể đặt ${toolLabel} — không có ghế kề bên hợp lệ.`)
        return
      }
      const seatBlocking = getBlockingState(seat, pendingChanges)
      const partnerBlocking = getBlockingState(partner, pendingChanges)
      if (seatBlocking || partnerBlocking) {
        const reason = seatBlocking || partnerBlocking
        toast.warning(
          `Không đặt được ${toolLabel} ở ${seat.seatNumber}-${partner.seatNumber} — ` +
          `${reason} chặn cặp ghế. Chuyển ô đó thành Thường trước.`
        )
        return
      }
    }

    setPendingChanges(prev => {
      const next = new Map(prev)
      const displayInPrev = (s: SeatItem) => getDisplayFromMap(s, prev)

      if (isDouble(activeTool)) {
        const partner = getDoublePartner(seat, seats)!

        // Cascade: nếu SEAT đang là double và pair với ai khác (không phải
        // partner mới) → set mate cũ sang STANDARD để không thành orphan.
        const seatOldMate = findCurrentCouplePartner(seat, seats, displayInPrev)
        if (seatOldMate && seatOldMate.id !== partner.id) {
          next.set(seatOldMate.id, 'STANDARD')
        }
        // Cascade: nếu PARTNER đang là double với ai khác (không phải seat)
        // → set mate cũ sang STANDARD. Ví dụ 11-12 COUPLE, click 13 với
        // COUPLE → partner = 12 (fallback), 12's old mate = 11 → 11 sang
        // STANDARD; cuối cùng 12-13 paired, 11 đứng riêng.
        const partnerOldMate = findCurrentCouplePartner(partner, seats, displayInPrev)
        if (partnerOldMate && partnerOldMate.id !== seat.id) {
          next.set(partnerOldMate.id, 'STANDARD')
        }

        next.set(seat.id, activeTool)
        next.set(partner.id, activeTool)
      } else if (isDouble(currentType)) {
        // Unpair: tìm partner ACTUAL (same-type adjacent), không phải canonical.
        // Cặp có thể được pair fallback direction (12-13 ở phòng 13 cột) —
        // canonical lookup sẽ trả nhầm 11 thay vì 13.
        const actualPartner = findCurrentCouplePartner(seat, seats, displayInPrev)
        next.set(seat.id, activeTool)
        if (actualPartner) {
          next.set(actualPartner.id, activeTool)
        }
      } else {
        next.set(seat.id, activeTool)
      }
      return next
    })
  }, [activeTool, pendingChanges])

  const handleMouseDown = useCallback((seat: SeatItem, seats: SeatItem[]) => {
    setIsDragging(true)
    applySeatChange(seat, seats)
  }, [applySeatChange])

  const handleMouseEnter = useCallback((seat: SeatItem, seats: SeatItem[]) => {
    if (!isDragging) return
    applySeatChange(seat, seats)
  }, [isDragging, applySeatChange])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  function handleSave() {
    if (pendingChanges.size === 0) {
      toast.info('Không có thay đổi nào')
      return
    }
    if (!seatMap) return
    const allSeats: SeatItem[] = Object.values(seatMap.seatMap).flat()

    // Pre-save validation: scan orphan COUPLE/SWEETBOX trước khi gửi BE.
    const orphanError = findOrphanCouple(pendingChanges, allSeats)
    if (orphanError) {
      toast.error(orphanError)
      return
    }

    // Hard block: tổng số ghế bán được sau pending phải > 0. Nếu admin lỡ
    // mark tất cả thành lối đi/hỏng/chặn → phòng không bán được vé.
    const NON_BOOKABLE = new Set(['AISLE', 'BROKEN', 'BLOCKED'])
    const totalBookable = allSeats.filter(s => !NON_BOOKABLE.has(getDisplayType(s))).length
    if (totalBookable === 0) {
      toast.error('Toàn bộ ghế đang là lối đi / hỏng / chặn — phòng sẽ không bán được vé. Giữ ít nhất 1 ghế thường.')
      return
    }

    // Warn (không block) nếu có row bị 0% bookable sau thay đổi.
    const rows = Object.entries(seatMap.seatMap).sort(([a], [b]) => a.localeCompare(b))
    const emptyRows = findEmptyRows(pendingChanges, rows)
    if (emptyRows.length > 0) {
      toast.warning(`Hàng ${emptyRows.join(', ')} sẽ không còn ghế bán được. Vẫn tiếp tục lưu.`)
    }

    bulkUpdateMut.mutate(pendingChanges, {
      onSuccess: () => setPendingChanges(new Map()),
    })
  }

  function handleReset() {
    setPendingChanges(new Map())
    toast.info('Đã hoàn tác tất cả thay đổi')
  }

  if (isLoading) return <Loading />

  if (!seatMap || Object.keys(seatMap.seatMap).length === 0) {
    return <EmptyGridSetup roomId={id} roomName={seatMap?.roomName} />
  }

  const rows = Object.entries(seatMap.seatMap).sort(([a], [b]) => a.localeCompare(b))
  const maxCols = Math.max(...rows.map(([, seats]) => seats.length))
  const currentRows = rows.length
  const currentCols = maxCols

  // Tổng ghế bán được TÍNH LIVE theo pending changes — paint 1 ô thành lối
  // đi / hỏng / chặn là Stats strip giảm ngay, không phải đợi Save.
  const NON_BOOKABLE_TYPES = new Set<SeatTypeKey>(['AISLE', 'BROKEN', 'BLOCKED'])
  const liveBookableTotal = rows.reduce(
    (sum, [, seats]) =>
      sum + seats.filter(s => !NON_BOOKABLE_TYPES.has(getDisplayType(s))).length,
    0,
  )
  const sizeDirty = resizeRows !== currentRows || resizeCols !== currentCols
  const sizeValid = resizeRows >= 1 && resizeRows <= 26 && resizeCols >= 1 && resizeCols <= 40

  /** Shrink → mở ConfirmDialog; grow → commit thẳng. */
  function applyResize() {
    if (!sizeDirty || !sizeValid) return
    if (pendingChanges.size > 0) {
      toast.warning('Bạn có thay đổi chưa lưu — hãy Lưu hoặc Reset trước khi đổi kích thước')
      return
    }
    const shrinking = resizeRows < currentRows || resizeCols < currentCols
    if (shrinking) {
      setShrinkConfirmOpen(true)
      return
    }
    resizeMut.mutate({ rows: resizeRows, cols: resizeCols })
  }
  function confirmShrinkResize() {
    resizeMut.mutate({ rows: resizeRows, cols: resizeCols }, {
      onSuccess: () => setShrinkConfirmOpen(false),
    })
  }
  const removedRows = Math.max(0, currentRows - resizeRows)
  const removedCols = Math.max(0, currentCols - resizeCols)

  function resetResize() {
    setResizeRows(currentRows)
    setResizeCols(currentCols)
  }

  return (
    <div className="space-y-4" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white">{seatMap.roomName}</h1>
          <p className="text-xs text-gray-400">Sơ đồ ghế</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingChanges.size > 0 && (
            <span className="text-xs text-[#ffc107] mr-2">{pendingChanges.size} thay đổi</span>
          )}
          <Button variant="outline" size="sm" onClick={handleReset}
            disabled={pendingChanges.size === 0}
            className="border-white/10 text-gray-300 hover:bg-white/5">
            <RotateCcw size={14} className="mr-1" /> Reset
          </Button>
          <Button size="sm" onClick={handleSave}
            disabled={pendingChanges.size === 0 || bulkUpdateMut.isPending}
            className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
            <Save size={14} className="mr-1" /> Lưu
          </Button>
        </div>
      </div>

      {/* Resize bar compact — pattern Vista/Cinetixx: dimensions controls
          inline 1 hàng, NO before/after stats card. Grid bên dưới tự là
          live preview (placeholder dashed cho hàng/cột mới, overlay đỏ cho
          hàng/cột sẽ xoá). User thấy ngay tác động, không cần card riêng. */}
      <ResizeBar
        currentRows={currentRows}
        currentCols={currentCols}
        resizeRows={resizeRows}
        resizeCols={resizeCols}
        onChangeRows={setResizeRows}
        onChangeCols={setResizeCols}
        sizeDirty={sizeDirty}
        sizeValid={sizeValid}
        isPending={resizeMut.isPending}
        onReset={resetResize}
        onApply={applyResize}
      />

      {/* Stats strip horizontal — đặt cạnh resize bar để khi tăng/giảm
          hàng/cột hoặc paint loại ghế, admin thấy tổng update ngay không
          phải nhìn xuống sidebar. Sidebar trái giữ tool picker focus. */}
      <SeatStatsStrip
        types={SEAT_TYPES}
        rows={rows}
        totalSeats={liveBookableTotal}
        getDisplayType={getDisplayType}
      />

      <div className="flex gap-6">
        <SeatEditorToolPanel
          types={SEAT_TYPES}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
        />

        <SeatEditorGrid
          rows={rows}
          maxCols={maxCols}
          targetRows={resizeRows}
          targetCols={resizeCols}
          pendingChanges={pendingChanges}
          activeTool={activeTool}
          getDisplayType={getDisplayType}
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseEnter}
        />
      </div>

      <ConfirmDialog
        open={shrinkConfirmOpen}
        onClose={() => setShrinkConfirmOpen(false)}
        onConfirm={confirmShrinkResize}
        title="Xác nhận thu nhỏ lưới ghế"
        message={
          [
            removedRows > 0 && `${removedRows} hàng cuối`,
            removedCols > 0 && `${removedCols} cột cuối`,
          ].filter(Boolean).join(' và ') +
          ` sẽ bị xoá. Booking lịch sử (đã CHECKED_IN / CANCELLED) vẫn ref được. Tiếp tục?`
        }
        confirmText="Xoá và áp dụng"
        loading={resizeMut.isPending}
      />
    </div>
  )
}

/**
 * Compact resize toolbar — pattern Vista Veezi / Cinetixx.
 *
 * <p>1 hàng inline: icon + label + dimensions controls + delta badge + actions.
 * KHÔNG có before/after stats card vì grid bên dưới đã là live preview
 * (placeholder dashed cho hàng/cột mới, overlay đỏ cho hàng/cột sẽ xoá).
 */
interface ResizeBarProps {
  currentRows: number
  currentCols: number
  resizeRows: number
  resizeCols: number
  onChangeRows: (v: number) => void
  onChangeCols: (v: number) => void
  sizeDirty: boolean
  sizeValid: boolean
  isPending: boolean
  onReset: () => void
  onApply: () => void
}

function ResizeBar(props: ResizeBarProps) {
  const {
    currentRows, currentCols, resizeRows, resizeCols,
    onChangeRows, onChangeCols, sizeDirty, sizeValid, isPending,
    onReset, onApply,
  } = props
  const delta = (resizeRows * resizeCols) - (currentRows * currentCols)

  return (
    <div className="bg-[#201b11] border border-[#3f382d] rounded-2xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Maximize2 size={14} className="text-[#ffc107]" />
        Kích thước
      </div>
      <ResizeControl label="Hàng" value={resizeRows} min={1} max={26} onChange={onChangeRows} />
      <ResizeControl label="Cột" value={resizeCols} min={1} max={40} onChange={onChangeCols} />
      {sizeDirty && delta !== 0 && (
        <span className={`text-xs font-medium px-2 py-1 rounded-md border ${
          delta > 0
            ? 'bg-green-500/10 text-green-400 border-green-500/30'
            : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
        }`}>
          {delta > 0 ? `+${delta}` : delta} vị trí
        </span>
      )}
      <div className="flex-1" />
      {sizeDirty && (
        <>
          <Button variant="outline" size="sm" onClick={onReset} disabled={isPending}
            className="border-white/10 text-gray-300 hover:bg-white/5 rounded-lg h-8">
            Hoàn tác
          </Button>
          <Button size="sm" onClick={onApply} disabled={!sizeValid || isPending}
            className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg h-8">
            {isPending ? 'Đang đổi…' : 'Áp dụng'}
          </Button>
        </>
      )}
    </div>
  )
}

/**
 * Empty state khi phòng chưa có ghế — inline form khởi tạo grid trực tiếp
 * trong editor (industry pattern Vista Veezi / Cinetixx: editor handle cả
 * create + edit, không tách dialog riêng).
 */
const EMPTY_DIMS_SUGGESTIONS: Record<string, { rows: number; cols: number }> = {
  '2D':   { rows: 10, cols: 15 },
  '3D':   { rows: 12, cols: 16 },
  IMAX:   { rows: 14, cols: 20 },
  '4DX':  { rows: 8,  cols: 10 },
}

function EmptyGridSetup({ roomId, roomName }: { roomId: number; roomName?: string }) {
  const [rows, setRows] = useState(EMPTY_DIMS_SUGGESTIONS['2D'].rows)
  const [cols, setCols] = useState(EMPTY_DIMS_SUGGESTIONS['2D'].cols)
  const generateMut = useGenerateSeats()
  const isValid = rows >= 1 && rows <= 26 && cols >= 1 && cols <= 40
  const total = rows * cols

  function submit() {
    if (!isValid) return
    generateMut.mutate(
      { roomId, data: { totalRows: rows, totalCols: cols } },
      { onSuccess: () => toast.success(`Đã tạo ${total} ghế thường. Tinh chỉnh tự do bên dưới.`) },
    )
  }

  return (
    <div className="space-y-4">
      {roomName && (
        <div>
          <h1 className="text-lg font-bold text-white">{roomName}</h1>
          <p className="text-xs text-gray-400">Chưa có ghế — khởi tạo grid bên dưới</p>
        </div>
      )}

      <div className="max-w-xl mx-auto mt-8 bg-[#201b11] border border-[#3f382d] rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-[#ffc107]/10 flex items-center justify-center">
            <LayoutGrid size={20} className="text-[#ffc107]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Khởi tạo sơ đồ ghế</h2>
            <p className="text-xs text-gray-500">Tạo grid trống, paint custom sau</p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-gray-400 px-1">
          <Info size={12} className="mt-0.5 shrink-0 text-[#ffc107]" />
          <span>
            Sẽ tạo toàn bộ ghế Thường. Đổi loại (VIP, Đôi, Sweetbox, Deluxe...) và
            đánh dấu lối đi trong sơ đồ sau khi tạo xong.
          </span>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
            Gợi ý kích thước
          </p>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(EMPTY_DIMS_SUGGESTIONS).map(([key, d]) => {
              const active = rows === d.rows && cols === d.cols
              return (
                <button key={key} type="button"
                  onClick={() => { setRows(d.rows); setCols(d.cols) }}
                  className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                    active
                      ? 'bg-[#ffc107]/10 border-[#ffc107]/40 text-[#ffc107]'
                      : 'border-white/10 bg-[#2a2317] text-gray-300 hover:bg-white/5'
                  }`}>
                  <div className="text-xs font-semibold">{key}</div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                    {d.rows} × {d.cols}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
            Kích thước tuỳ chỉnh
          </p>
          <div className="grid grid-cols-2 gap-3">
            <ResizeControl label="Hàng" value={rows} min={1} max={26} onChange={setRows} />
            <ResizeControl label="Cột" value={cols} min={1} max={40} onChange={setCols} />
          </div>
        </div>

        <div className="rounded-xl bg-[#2a2317] border border-white/5 p-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">Sẽ tạo</span>
          <span className="text-sm font-mono">
            <span className="text-amber-50 font-bold">{rows} × {cols}</span>
            <span className="text-gray-500 mx-2">=</span>
            <span className="text-green-400 font-semibold">{total}</span>
            <span className="text-gray-400 ml-1">ghế thường</span>
          </span>
        </div>

        <Button onClick={submit} disabled={!isValid || generateMut.isPending}
          className="w-full bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg h-10">
          {generateMut.isPending ? 'Đang tạo...' : `Tạo ${total} ghế thường`}
        </Button>
      </div>
    </div>
  )
}

/** Stepper control: -/+/input gộp vào 1 segmented button group chuẩn industry. */
function ResizeControl({ label, value, min, max, onChange }: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="inline-flex items-center rounded-lg border border-white/10 bg-[#2a2317] overflow-hidden">
        <button type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className="h-7 w-7 flex items-center justify-center text-gray-300 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent">
          <Minus size={11} />
        </button>
        <input type="number" min={min} max={max} value={value}
          onChange={e => onChange(clamp(Number(e.target.value) || min))}
          className="w-10 h-7 bg-transparent text-center text-sm text-amber-50 font-mono
                     focus:outline-none border-l border-r border-white/10" />
        <button type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="h-7 w-7 flex items-center justify-center text-gray-300 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent">
          <Plus size={11} />
        </button>
      </div>
    </div>
  )
}
