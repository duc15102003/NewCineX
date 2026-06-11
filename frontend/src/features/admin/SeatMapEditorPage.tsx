import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Save, RotateCcw, Eye } from 'lucide-react'
import { toast } from 'sonner'
import Loading from '@/components/common/Loading'
import { useSeatMap, useBulkUpdateSeats } from '@/hooks/useAdmin'
import type { SeatItem } from '@/hooks/useAdmin'

import SeatEditorToolPanel from './components/SeatEditorToolPanel'
import SeatEditorGrid from './components/SeatEditorGrid'
import { SEAT_TYPES, type SeatTypeKey } from '@/types/seatEditor'

/** Loại tool gộp đôi (chiếm 2 ô): COUPLE + SWEETBOX */
const DOUBLE_TOOLS: SeatTypeKey[] = ['COUPLE', 'SWEETBOX']
function isDouble(t: SeatTypeKey): boolean {
  return DOUBLE_TOOLS.includes(t)
}

/**
 * Tìm ghế partner cho COUPLE/SWEETBOX — ghế lẻ ghép với ghế chẵn kề bên.
 * VD: col 1 ↔ col 2, col 3 ↔ col 4, ...
 */
function getDoublePartner(seat: SeatItem, seats: SeatItem[]): SeatItem | null {
  const isOdd = seat.colNumber % 2 === 1
  const partnerCol = isOdd ? seat.colNumber + 1 : seat.colNumber - 1
  return seats.find(s => s.colNumber === partnerCol) ?? null
}

/**
 * Quét pendingChanges tìm orphan COUPLE/SWEETBOX (1 nửa pending COUPLE
 * nhưng partner không pending cùng type hoặc partner đã ở loại khác trong DB).
 *
 * Trả message lỗi cho toast hoặc null nếu hợp lệ.
 */
function findOrphanCouple(
  pending: Map<number, SeatTypeKey>,
  seatMap: { seatMap: Record<string, SeatItem[]> } | undefined,
): string | null {
  if (!seatMap) return null
  const allSeats: SeatItem[] = Object.values(seatMap.seatMap).flat()
  const byId = new Map(allSeats.map(s => [s.id, s]))

  for (const [seatId, pendingType] of pending) {
    if (pendingType !== 'COUPLE' && pendingType !== 'SWEETBOX') continue
    const seat = byId.get(seatId)
    if (!seat) continue
    const partnerCol = seat.colNumber % 2 === 1 ? seat.colNumber + 1 : seat.colNumber - 1
    const partner = allSeats.find(s => s.rowLabel === seat.rowLabel && s.colNumber === partnerCol)
    if (!partner) {
      return `Ghế ${seat.seatNumber} không có ghế cặp ở cột ${partnerCol}.`
    }
    const partnerPending = pending.get(partner.id)
    // Partner cũng đang pending cùng type → OK
    if (partnerPending === pendingType) continue
    // Partner đang pending khác type → orphan
    if (partnerPending) {
      return `Ghế ${seat.seatNumber} (${pendingType}) không khớp với cặp ${partner.seatNumber} (${partnerPending}).`
    }
    // Partner không pending → check DB state
    if (partner.seatType !== pendingType || partner.aisle) {
      return `Ghế ${seat.seatNumber} không có cặp hợp lệ — ${partner.seatNumber} hiện là ${partner.aisle ? 'lối đi' : partner.seatType}.`
    }
  }
  return null
}

/**
 * Trả về lý do tại sao ô không thể là 1 nửa của ghế đôi/sweetbox.
 * null = OK để pair. String = mô tả ngắn để hiển thị toast.
 *
 * Ưu tiên: pending change (FE chưa lưu) > flag DB (aisle/status).
 */
function getBlockingState(seat: SeatItem, pending: Map<number, SeatTypeKey>): string | null {
  const pendingType = pending.get(seat.id)
  if (pendingType === 'AISLE') return 'lối đi'
  if (pendingType === 'BROKEN') return 'ghế hỏng'
  if (pendingType === 'BLOCKED') return 'ghế bị chặn'
  if (pendingType) return null  // đang pending sang loại ghế khác → OK
  if (seat.aisle) return 'lối đi'
  if (seat.status === 'BROKEN') return 'ghế hỏng'
  if (seat.status === 'BLOCKED') return 'ghế bị chặn'
  return null
}

export default function SeatMapEditorPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const id = Number(roomId)

  const [activeTool, setActiveTool] = useState<SeatTypeKey>('STANDARD')
  const [pendingChanges, setPendingChanges] = useState<Map<number, SeatTypeKey>>(new Map())
  const [isDragging, setIsDragging] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const { data: seatMap, isLoading } = useSeatMap(id)
  const bulkUpdateMut = useBulkUpdateSeats(id)

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
   * Apply tool lên ghế. Logic:
   * - COUPLE/SWEETBOX gộp đôi (cần partner kề bên cùng row)
   * - Đổi từ COUPLE/SWEETBOX sang khác → un-pair partner
   * - AISLE/BLOCKED/BROKEN không cần partner
   */
  const applySeatChange = useCallback((seat: SeatItem, seats: SeatItem[]) => {
    if (previewMode) return
    const currentType = getDisplayFromMap(seat, pendingChanges)
    if (currentType === activeTool) return

    // Check NGOÀI setState — tránh React StrictMode chạy updater 2 lần → toast 2 lần
    if (isDouble(activeTool)) {
      const partner = getDoublePartner(seat, seats)
      const toolLabel = activeTool === 'SWEETBOX' ? 'Sweetbox' : 'ghế đôi'
      if (!partner) {
        toast.warning(`${seat.seatNumber} không thể đặt ${toolLabel} — ghế lẻ cuối hàng không có cặp.`)
        return
      }
      // Block ghế đôi vắt qua lối đi / ghế broken / blocked — chuẩn industry CGV/Lotte.
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

      if (isDouble(activeTool)) {
        // Đã verify partner tồn tại ở check trên
        const partner = getDoublePartner(seat, seats)!
        next.set(seat.id, activeTool)
        next.set(partner.id, activeTool)
      } else if (isDouble(currentType)) {
        // Đổi từ double → un-pair partner cùng type
        const partner = getDoublePartner(seat, seats)
        next.set(seat.id, activeTool)
        if (partner && getDisplayFromMap(partner, prev) === currentType) {
          next.set(partner.id, activeTool)
        }
      } else {
        next.set(seat.id, activeTool)
      }
      return next
    })
  }, [activeTool, previewMode, pendingChanges])

  const handleMouseDown = useCallback((seat: SeatItem, seats: SeatItem[]) => {
    if (previewMode) return
    setIsDragging(true)
    applySeatChange(seat, seats)
  }, [applySeatChange, previewMode])

  const handleMouseEnter = useCallback((seat: SeatItem, seats: SeatItem[]) => {
    if (!isDragging || previewMode) return
    applySeatChange(seat, seats)
  }, [isDragging, applySeatChange, previewMode])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  function handleSave() {
    if (pendingChanges.size === 0) {
      toast.info('Không có thay đổi nào')
      return
    }
    // Pre-save validation: scan orphan COUPLE/SWEETBOX trước khi gửi BE.
    // Tránh BE reject với message dài, FE báo lỗi rõ ngay tại đây.
    const orphanError = findOrphanCouple(pendingChanges, seatMap)
    if (orphanError) {
      toast.error(orphanError)
      return
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
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg mb-2">Phòng chưa có ghế</p>
          <p className="text-sm">Hãy tạo sơ đồ ghế trước trong trang Quản lý phòng chiếu.</p>
        </div>
      </div>
    )
  }

  const rows = Object.entries(seatMap.seatMap).sort(([a], [b]) => a.localeCompare(b))
  const maxCols = Math.max(...rows.map(([, seats]) => seats.length))

  return (
    <div className="space-y-4" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white">{seatMap.roomName}</h1>
          <p className="text-xs text-gray-400">{seatMap.totalSeats} ghế</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingChanges.size > 0 && (
            <span className="text-xs text-[#ffc107] mr-2">{pendingChanges.size} thay đổi</span>
          )}
          <Button variant="outline" size="sm" onClick={() => setPreviewMode(!previewMode)}
            className={`border-white/10 ${previewMode ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'}`}>
            <Eye size={14} className="mr-1" /> {previewMode ? 'Đang xem' : 'Xem trước'}
          </Button>
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

      <div className="flex gap-6">
        {!previewMode && (
          <SeatEditorToolPanel
            types={SEAT_TYPES}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            rows={rows}
            totalSeats={seatMap.totalSeats}
            getDisplayType={getDisplayType}
          />
        )}

        <SeatEditorGrid
          rows={rows}
          maxCols={maxCols}
          previewMode={previewMode}
          pendingChanges={pendingChanges}
          getDisplayType={getDisplayType}
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseEnter}
        />
      </div>
    </div>
  )
}
