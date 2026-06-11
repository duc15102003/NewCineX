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
import {
  isDouble, getDoublePartner, getBlockingState, findOrphanCouple, findEmptyRows,
} from './utils/seatPairing'

/* Pair logic tách sang ./utils/seatPairing.ts */

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
    if (!seatMap) return
    const allSeats: SeatItem[] = Object.values(seatMap.seatMap).flat()

    // Pre-save validation: scan orphan COUPLE/SWEETBOX trước khi gửi BE.
    const orphanError = findOrphanCouple(pendingChanges, allSeats)
    if (orphanError) {
      toast.error(orphanError)
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
        <SeatEditorToolPanel
          types={SEAT_TYPES}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          rows={rows}
          totalSeats={seatMap.totalSeats}
          getDisplayType={getDisplayType}
          previewMode={previewMode}
        />

        <SeatEditorGrid
          rows={rows}
          maxCols={maxCols}
          previewMode={previewMode}
          pendingChanges={pendingChanges}
          activeTool={activeTool}
          getDisplayType={getDisplayType}
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseEnter}
        />
      </div>
    </div>
  )
}
