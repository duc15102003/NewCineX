import React, { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Save, RotateCcw, Eye } from 'lucide-react'
import { toast } from 'sonner'
import Loading from '@/components/common/Loading'
import { useSeatMap, useBulkUpdateSeats } from '@/hooks/useAdmin'
import type { SeatItem } from '@/hooks/useAdmin'

type SeatTypeKey = 'STANDARD' | 'VIP' | 'COUPLE' | 'BROKEN'

const SEAT_TYPES: { key: SeatTypeKey; label: string; bgClass: string }[] = [
  { key: 'STANDARD', label: 'Thường', bgClass: 'bg-green-600' },
  { key: 'VIP', label: 'VIP', bgClass: 'bg-[#eab308]' },
  { key: 'BROKEN', label: 'Hỏng / Bảo trì', bgClass: 'bg-red-600' },
  { key: 'COUPLE', label: 'Ghế đôi (2 ô)', bgClass: 'bg-purple-500' },
]

const SEAT_BG: Record<SeatTypeKey, string> = {
  STANDARD: 'bg-green-600/80 hover:bg-green-500',
  VIP: 'bg-[#eab308]/80 hover:bg-[#eab308]',
  COUPLE: 'bg-purple-500/80 hover:bg-purple-400',
  BROKEN: 'bg-red-600/80 hover:bg-red-500',
}

/**
 * Tìm ghế partner cho COUPLE — ghế lẻ ghép với ghế chẵn kề bên.
 * VD: col 1 ↔ col 2, col 3 ↔ col 4, ...
 */
function getCouplePartner(seat: SeatItem, seats: SeatItem[]): SeatItem | null {
  const isOdd = seat.colNumber % 2 === 1
  const partnerCol = isOdd ? seat.colNumber + 1 : seat.colNumber - 1
  return seats.find(s => s.colNumber === partnerCol) ?? null
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

  function getSeatDisplay(seat: SeatItem): SeatTypeKey {
    // Pending changes ưu tiên → sau đó check BROKEN → cuối cùng seatType
    return pendingChanges.get(seat.id)
        ?? (seat.status === 'BROKEN' ? 'BROKEN' : seat.seatType)
  }

  /**
   * Apply tool lên ghế — nếu COUPLE thì tự ghép partner, nếu bỏ COUPLE thì bỏ cả cặp.
   */
  const applySeatChange = useCallback((seat: SeatItem, seats: SeatItem[]) => {
    if (previewMode) return
    const currentType = getSeatDisplay(seat)
    if (currentType === activeTool) return

    setPendingChanges(prev => {
      const next = new Map(prev)

      if (activeTool === 'COUPLE') {
        // Ghép cặp: phải có partner mới cho đặt COUPLE
        const partner = getCouplePartner(seat, seats)
        if (!partner) return prev // Ghế lẻ cuối hàng → không cho đặt đôi
        next.set(seat.id, 'COUPLE')
        next.set(partner.id, 'COUPLE')
      } else {
        // Nếu đang là COUPLE → bỏ cả cặp về loại mới
        if (currentType === 'COUPLE') {
          const partner = getCouplePartner(seat, seats)
          next.set(seat.id, activeTool)
          if (partner && getSeatDisplayFromMap(partner, prev) === 'COUPLE') {
            next.set(partner.id, activeTool)
          }
        } else {
          next.set(seat.id, activeTool)
        }
      }

      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, previewMode, pendingChanges])

  function getSeatDisplayFromMap(seat: SeatItem, map: Map<number, SeatTypeKey>): SeatTypeKey {
    return map.get(seat.id) ?? seat.seatType
  }

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
    // Reset pending changes sau khi lưu thành công
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

  /**
   * Render 1 hàng ghế — gộp COUPLE thành 1 ô rộng 2 cột.
   */
  function renderRow(seats: SeatItem[]) {
    const rendered: React.ReactElement[] = []
    const skipCols = new Set<number>()

    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i]
      if (skipCols.has(seat.colNumber)) continue

      const displayType = getSeatDisplay(seat)
      const isChanged = pendingChanges.has(seat.id)

      if (displayType === 'COUPLE') {
        // Tìm partner (ô kề bên phải)
        const partner = seats[i + 1]
        const partnerIsCouple = partner && getSeatDisplay(partner) === 'COUPLE'

        if (partnerIsCouple && seat.colNumber % 2 === 1) {
          // Render gộp 2 ô
          const partnerChanged = pendingChanges.has(partner.id)
          skipCols.add(partner.colNumber)
          rendered.push(
            <button
              key={seat.id}
              onMouseDown={() => handleMouseDown(seat, seats)}
              onMouseEnter={() => handleMouseEnter(seat, seats)}
              title={`${seat.seatNumber}-${partner.seatNumber} — Ghế đôi`}
              className={`h-9 rounded-t-lg text-[10px] font-bold transition-all duration-100
                bg-purple-500/80 hover:bg-purple-400
                ${isChanged || partnerChanged ? 'ring-2 ring-white/40 scale-105' : ''}
                ${previewMode ? 'cursor-default' : 'cursor-pointer'}
              `}
              style={{ width: `calc(2 * 2.25rem + 0.375rem)` }} // 2 ô + 1 gap
            >
              {seat.colNumber}-{partner.colNumber}
            </button>
          )
          continue
        }
      }

      // Render ghế đơn (STANDARD, VIP, hoặc COUPLE lẻ chưa có partner)
      rendered.push(
        <button
          key={seat.id}
          onMouseDown={() => handleMouseDown(seat, seats)}
          onMouseEnter={() => handleMouseEnter(seat, seats)}
          title={`${seat.seatNumber} — ${SEAT_TYPES.find(t => t.key === displayType)?.label}`}
          className={`w-9 h-9 rounded-t-lg text-[10px] font-bold transition-all duration-100
            ${SEAT_BG[displayType]}
            ${isChanged ? 'ring-2 ring-white/40 scale-105' : ''}
            ${previewMode ? 'cursor-default' : 'cursor-pointer'}
          `}
        >
          {seat.colNumber}
        </button>
      )
    }

    return rendered
  }

  return (
    <div className="space-y-4" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white">{seatMap.roomName}</h1>
          <p className="text-xs text-gray-400">{seatMap.totalSeats} ghế</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingChanges.size > 0 && (
            <span className="text-xs text-[#eab308] mr-2">{pendingChanges.size} thay đổi</span>
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
            className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold">
            <Save size={14} className="mr-1" /> Lưu
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Tool Panel */}
        {!previewMode && (
          <div className="w-56 shrink-0 space-y-4">
            <div className="bg-[#0a1929] border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Loại ghế</h3>
              <div className="space-y-2">
                {SEAT_TYPES.map(({ key, label, bgClass }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTool(key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      activeTool === key
                        ? 'bg-white/10 ring-1 ring-[#eab308] text-white'
                        : 'text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    <span className={`${key === 'COUPLE' ? 'w-10 h-5' : 'w-5 h-5'} rounded ${bgClass}`} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#0a1929] border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Hướng dẫn</h3>
              <ul className="space-y-2 text-xs text-gray-400">
                <li>1. Chọn loại ghế ở trên</li>
                <li>2. Click vào ghế để đổi loại</li>
                <li>3. Kéo chuột để chọn nhiều ghế</li>
                <li>4. <strong className="text-purple-400">Ghế đôi</strong> tự ghép cặp 2 ô liền kề (1-2, 3-4...)</li>
                <li>5. Nhấn <strong className="text-white">Lưu</strong> để áp dụng</li>
              </ul>
            </div>

            <div className="bg-[#0a1929] border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Thống kê</h3>
              {SEAT_TYPES.map(({ key, label, bgClass }) => {
                const count = rows.reduce((sum, [, seats]) =>
                  sum + seats.filter(s => getSeatDisplay(s) === key).length, 0)
                const displayCount = key === 'COUPLE' ? `${count} (${Math.floor(count / 2)} đôi)` : String(count)
                return (
                  <div key={key} className="flex items-center justify-between py-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded ${bgClass}`} />
                      <span className="text-gray-400">{label}</span>
                    </div>
                    <span className="text-white font-medium">{displayCount}</span>
                  </div>
                )
              })}
              <div className="border-t border-white/5 mt-2 pt-2 flex justify-between text-sm">
                <span className="text-gray-400">Tổng</span>
                <span className="text-white font-bold">{seatMap.totalSeats}</span>
              </div>
            </div>
          </div>
        )}

        {/* Seat Grid */}
        <div className="flex-1 overflow-auto">
          <div className="bg-[#0a1929] border border-white/5 rounded-xl p-6 min-w-fit">
            {/* Màn chiếu */}
            <div className="flex justify-center mb-8">
              <div className="w-3/4 text-center">
                <div className="h-1.5 bg-gradient-to-r from-transparent via-[#eab308] to-transparent rounded-full" />
                <div className="h-8 bg-gradient-to-b from-[#eab308]/10 to-transparent" />
                <p className="text-xs text-gray-500 tracking-[0.3em] uppercase -mt-4">Màn hình</p>
              </div>
            </div>

            {/* Column labels */}
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <span className="w-6 shrink-0" />
              {Array.from({ length: maxCols }, (_, i) => (
                <div key={i} className="w-9 text-center text-xs text-gray-500 font-mono">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="space-y-1.5 select-none">
              {rows.map(([rowLabel, seats]) => (
                <div key={rowLabel} className="flex items-center justify-center gap-1.5">
                  <span className="w-6 text-center text-xs text-gray-500 font-mono font-bold shrink-0">
                    {rowLabel}
                  </span>
                  {renderRow(seats)}
                </div>
              ))}
            </div>

            {/* Chú thích — đồng bộ thứ tự: Thường → VIP → Đôi → Hỏng → Đã thay đổi */}
            <div className="flex flex-wrap justify-center gap-5 mt-8 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-4 h-4 rounded bg-green-600" />
                <span>Thường</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-4 h-4 rounded bg-yellow-600" />
                <span>VIP</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-8 h-4 rounded bg-purple-500" />
                <span>Ghế đôi</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-4 h-4 rounded bg-red-600" />
                <span>Hỏng</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-4 h-4 rounded ring-2 ring-white/40 bg-gray-600" />
                <span>Đã thay đổi</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
