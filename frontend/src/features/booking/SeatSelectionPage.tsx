import React, { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useShowtimeSeatMap, useHoldSeats } from '@/hooks/useBooking'
import { useSeatWebSocket } from '@/hooks/useWebSocket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { SeatItem } from '@/types/booking'
import { label, SEAT_TYPE_LABELS } from '@/utils/labels'
import { toast } from 'sonner'
import { Tag, X } from 'lucide-react'
import api, { getErrorMessage } from '@/api/axios'
import Loading from '@/components/common/Loading'

// Màu ghế theo type + trạng thái
function getSeatColor(
  seat: SeatItem,
  isSelected: boolean,
  isOccupied: boolean,
): string {
  if (seat.status === 'BROKEN') return 'bg-red-600 cursor-not-allowed opacity-70'
  if (isOccupied) return 'bg-gray-600 cursor-not-allowed opacity-50'
  if (isSelected) return 'bg-[#eab308] text-black font-bold scale-110'
  if (seat.seatType === 'VIP') return 'bg-yellow-600 hover:bg-yellow-500'
  if (seat.seatType === 'COUPLE') return 'bg-purple-600 hover:bg-purple-500'
  return 'bg-green-600 hover:bg-green-500'
}

function formatPrice(amount: number) {
  return amount.toLocaleString('vi-VN') + 'đ'
}

// Giá ghế được lấy từ showtime data, không hardcode
function getSeatPrice(seatType: string, showtime: { basePrice: number; vipPrice?: number; couplePrice?: number }): number {
  if (seatType === 'VIP') return showtime.vipPrice ?? showtime.basePrice
  if (seatType === 'COUPLE') return showtime.couplePrice ?? showtime.basePrice
  return showtime.basePrice // STANDARD
}

export default function SeatSelectionPage() {
  const { showtimeId } = useParams<{ showtimeId: string }>()
  const navigate = useNavigate()
  const id = Number(showtimeId)

  const { data, isLoading, isError } = useShowtimeSeatMap(id)
  const holdSeats = useHoldSeats()

  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([])
  const [occupiedSeatIds, setOccupiedSeatIds] = useState<number[]>([])
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherResult, setVoucherResult] = useState<{ valid: boolean; code?: string; discountAmount: number; message: string } | null>(null)
  const [voucherLoading, setVoucherLoading] = useState(false)
  const [availableVouchers, setAvailableVouchers] = useState<{ code: string; description: string; discountAmount: number; message: string }[]>([])
  const [showVoucherList, setShowVoucherList] = useState(true)

  // Load ghế đã bán/đang giữ khi mở trang
  useEffect(() => {
    if (!id) return
    api.get(`/api/bookings/showtimes/${id}/occupied-seats`)
      .then(res => {
        const ids = res.data?.data ?? []
        setOccupiedSeatIds(ids)
      })
      .catch(() => {})
  }, [id])

  // WebSocket: nhận update ghế real-time
  const handleSeatUpdate = useCallback((update: { seatIds: number[]; status: string }) => {
    if (update.status === 'HOLDING' || update.status === 'CONFIRMED') {
      setOccupiedSeatIds(prev => [...new Set([...prev, ...update.seatIds])])
    } else if (update.status === 'AVAILABLE') {
      setOccupiedSeatIds(prev => prev.filter(sid => !update.seatIds.includes(sid)))
    }
  }, [])

  useSeatWebSocket(id, handleSeatUpdate)

  function toggleSeat(seat: SeatItem, seats?: SeatItem[]) {
    if (seat.status === 'BROKEN') return
    if (occupiedSeatIds.includes(seat.id)) return

    // COUPLE: chọn/bỏ cả cặp
    if (seat.seatType === 'COUPLE' && seats) {
      const isOdd = seat.colNumber % 2 === 1
      const partnerCol = isOdd ? seat.colNumber + 1 : seat.colNumber - 1
      const partner = seats.find(s => s.colNumber === partnerCol && s.seatType === 'COUPLE')
      const ids = partner ? [seat.id, partner.id] : [seat.id]
      const allSelected = ids.every(id => selectedSeatIds.includes(id))

      setSelectedSeatIds(prev =>
        allSelected
          ? prev.filter(id => !ids.includes(id))
          : [...new Set([...prev, ...ids])]
      )
      return
    }

    setSelectedSeatIds(prev =>
      prev.includes(seat.id)
        ? prev.filter(s => s !== seat.id)
        : [...prev, seat.id],
    )
  }

  function getSelectedSeats(): SeatItem[] {
    if (!data?.seatMap?.seatMap) return []
    return Object.values(data.seatMap.seatMap)
      .flat()
      .filter(s => selectedSeatIds.includes(s.id))
  }

  function calcTotal(): number {
    if (!data?.showtime) return 0
    return getSelectedSeats().reduce((sum, s) => sum + getSeatPrice(s.seatType, data.showtime), 0)
  }

  // Fetch voucher khả dụng khi tổng tiền thay đổi
  useEffect(() => {
    const total = calcTotal()
    if (total <= 0) { setAvailableVouchers([]); return }
    api.get('/api/vouchers/available', { params: { orderAmount: total } })
      .then(res => setAvailableVouchers(res.data?.data ?? []))
      .catch(() => setAvailableVouchers([]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeatIds.length])

  function selectVoucher(v: { code: string; discountAmount: number; description: string }) {
    setVoucherCode(v.code)
    setVoucherResult({ valid: true, code: v.code, discountAmount: v.discountAmount, message: v.description })
    setShowVoucherList(false)
  }

  async function handleApplyVoucher() {
    if (!voucherCode.trim()) return
    const total = calcTotal()
    if (total === 0) { toast.error('Vui lòng chọn ghế trước'); return }
    setVoucherLoading(true)
    try {
      const res = await api.post('/api/vouchers/validate', {
        code: voucherCode.trim(),
        orderAmount: total,
      })
      const result = res.data.data
      setVoucherResult(result)
      if (!result.valid) toast.error(result.message)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Không thể kiểm tra voucher'))
      setVoucherResult(null)
    } finally {
      setVoucherLoading(false)
    }
  }

  function clearVoucher() {
    setVoucherCode('')
    setVoucherResult(null)
  }

  function getFinalTotal(): number {
    const total = calcTotal()
    if (voucherResult?.valid && voucherResult.discountAmount) {
      return Math.max(0, total - voucherResult.discountAmount)
    }
    return total
  }

  async function handleHoldSeats() {
    if (selectedSeatIds.length === 0) return
    const result = await holdSeats.mutateAsync({
      showtimeId: id,
      seatIds: selectedSeatIds,
      voucherCode: voucherCode.trim() || undefined,
    })
    navigate(`/payment/${result.bookingId}`)
  }

  if (isLoading) return <Loading />

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[#051424] flex items-center justify-center">
        <p className="text-red-400">Không thể tải thông tin suất chiếu.</p>
      </div>
    )
  }

  const { showtime, seatMap } = data
  const rows = Object.entries(seatMap.seatMap ?? {}).sort(([a], [b]) => a.localeCompare(b))
  const selectedSeats = getSelectedSeats()

  return (
    <div className="min-h-screen bg-[#051424] text-white py-8 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Thông tin suất chiếu */}
        <div className="bg-[#0a1929] border border-white/5 rounded-xl p-5 mb-6">
          <h1 className="text-xl font-bold text-[#eab308] mb-1">{showtime.movieTitle}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-300">
            <span>Phòng: <span className="text-white font-medium">{seatMap.roomName}</span></span>
            <span>Suất: <span className="text-white font-medium">
              {new Date(showtime.startTime).toLocaleString('vi-VN', {
                weekday: 'short', day: '2-digit', month: '2-digit',
                year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span></span>
            <span>Tổng ghế: <span className="text-white font-medium">{seatMap.totalSeats}</span></span>
          </div>
        </div>

        {/* Màn chiếu */}
        <div className="flex justify-center mb-8">
          <div className="w-3/4 text-center">
            <div className="h-1.5 bg-gradient-to-r from-transparent via-[#eab308] to-transparent rounded-full" />
            <div className="h-8 bg-gradient-to-b from-[#eab308]/10 to-transparent" />
            <p className="text-xs text-gray-500 tracking-[0.3em] uppercase -mt-4">Màn hình</p>
          </div>
        </div>

        {/* Sơ đồ ghế */}
        <div className="overflow-x-auto pb-4">
          <div className="inline-block min-w-full">
            {rows.map(([rowLabel, seats]) => (
              <div key={rowLabel} className="flex items-center gap-2 mb-2 justify-center">
                <span className="w-6 text-center text-sm text-gray-500 font-mono">{rowLabel}</span>
                <div className="flex gap-1.5 flex-wrap justify-center">
                  {(() => {
                    const rendered: React.ReactElement[] = []
                    const skipCols = new Set<number>()
                    for (let i = 0; i < seats.length; i++) {
                      const seat = seats[i]
                      if (skipCols.has(seat.colNumber)) continue
                      const isSelected = selectedSeatIds.includes(seat.id)
                      const isOccupied = occupiedSeatIds.includes(seat.id)

                      // COUPLE: gộp 2 ô
                      if (seat.seatType === 'COUPLE') {
                        const partner = seats[i + 1]
                        const partnerIsCouple = partner?.seatType === 'COUPLE'
                        if (partnerIsCouple && seat.colNumber % 2 === 1) {
                          skipCols.add(partner.colNumber)
                          const pairSelected = isSelected && selectedSeatIds.includes(partner.id)
                          const pairOccupied = isOccupied || occupiedSeatIds.includes(partner.id)
                          const colorClass = pairOccupied
                            ? 'bg-gray-600 cursor-not-allowed opacity-50'
                            : pairSelected
                              ? 'bg-[#eab308] text-black font-bold scale-105'
                              : 'bg-purple-600 hover:bg-purple-500'
                          rendered.push(
                            <button key={seat.id}
                              title={`${seat.seatNumber}-${partner.seatNumber} — Ghế đôi`}
                              onClick={() => toggleSeat(seat, seats)}
                              disabled={seat.status === 'BROKEN' || pairOccupied}
                              className={`h-8 rounded-t-md text-xs font-medium transition-all duration-150 ${colorClass}`}
                              style={{ width: `calc(2 * 2rem + 0.375rem)` }}>
                              {seat.colNumber}-{partner.colNumber}
                            </button>
                          )
                          continue
                        }
                      }

                      // Ghế đơn
                      const colorClass = getSeatColor(seat, isSelected, isOccupied)
                      rendered.push(
                        <button key={seat.id}
                          title={`${seat.seatNumber} — ${label(SEAT_TYPE_LABELS, seat.seatType)}`}
                          onClick={() => toggleSeat(seat, seats)}
                          disabled={seat.status === 'BROKEN' || isOccupied}
                          className={`w-8 h-8 rounded-t-md text-xs font-medium transition-all duration-150 ${colorClass}`}>
                          {seat.colNumber}
                        </button>
                      )
                    }
                    return rendered
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chú thích màu ghế */}
        <div className="flex flex-wrap justify-center gap-4 mt-6 mb-8 text-xs text-gray-300">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-green-600 inline-block" /> Thường
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-yellow-600 inline-block" /> VIP
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-8 h-4 rounded bg-purple-600 inline-block" /> Đôi
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-[#eab308] inline-block" /> Đang chọn
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-gray-600 inline-block" /> Đã bán
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-red-600 inline-block" /> Hỏng
          </span>
        </div>

        {/* Booking summary */}
        <div className="bg-[#0a1929] border border-white/5 rounded-xl p-5 sticky bottom-4">
          <h2 className="font-semibold text-gray-200 mb-3">
            Ghế đã chọn {selectedSeats.length > 0 && `(${selectedSeats.length})`}
          </h2>

          {selectedSeats.length === 0 ? (
            <p className="text-gray-500 text-sm mb-4">Chưa chọn ghế nào</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedSeats.map(s => (
                <Badge key={s.id} variant="warning" className="text-xs">
                  {s.seatNumber} ({label(SEAT_TYPE_LABELS, s.seatType)}) — {formatPrice(getSeatPrice(s.seatType, showtime))}
                </Badge>
              ))}
            </div>
          )}

          {/* Voucher */}
          <div className="mb-4">
            {voucherResult?.valid ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <Tag size={14} className="text-green-400" />
                <div className="flex-1">
                  <span className="text-sm text-green-400 font-medium">{voucherResult.code}</span>
                  <span className="text-xs text-green-400/70 ml-2">— {voucherResult.message}</span>
                </div>
                <button onClick={clearVoucher} className="text-gray-400 hover:text-white"><X size={14} /></button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Danh sách voucher khả dụng */}
                {availableVouchers.length > 0 && selectedSeats.length > 0 && (
                  <div>
                    <button onClick={() => setShowVoucherList(!showVoucherList)}
                      className="text-sm text-[#eab308] hover:underline flex items-center gap-1 mb-1">
                      <Tag size={12} /> 🎟️ {availableVouchers.length} voucher khả dụng {showVoucherList ? '▲' : '▼'}
                    </button>
                    {showVoucherList && (
                      <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                        {availableVouchers.map(v => (
                          <button key={v.code} onClick={() => selectVoucher(v)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-[#eab308]/30 transition-colors text-left">
                            <div>
                              <span className="text-sm font-mono text-[#eab308] font-medium">{v.code}</span>
                              <p className="text-xs text-gray-400 mt-0.5">{v.description}</p>
                            </div>
                            <span className="text-sm text-green-400 font-semibold shrink-0 ml-3">-{formatPrice(v.discountAmount)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Nhập mã thủ công */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Hoặc nhập mã voucher"
                    value={voucherCode}
                    onChange={e => { setVoucherCode(e.target.value.toUpperCase()); setVoucherResult(null) }}
                    onKeyDown={e => e.key === 'Enter' && handleApplyVoucher()}
                    className="flex-1 sm:w-56 sm:flex-none"
                  />
                  <Button
                    onClick={handleApplyVoucher}
                    disabled={!voucherCode.trim() || voucherLoading || selectedSeats.length === 0}
                    variant="outline"
                    className="border-[#eab308] text-[#eab308] hover:bg-[#eab308]/10 shrink-0"
                  >
                    {voucherLoading ? '...' : 'Áp dụng'}
                  </Button>
                </div>
              </div>
            )}
            {voucherResult && !voucherResult.valid && (
              <p className="text-red-400 text-xs mt-1">{voucherResult.message}</p>
            )}
          </div>

          {/* Price breakdown */}
          <div className="flex items-end justify-between">
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-400">Tổng tiền ghế:</span>
                <span className="text-white">{formatPrice(calcTotal())}</span>
              </div>
              {voucherResult?.valid && (
                <div className="flex items-center gap-4">
                  <span className="text-gray-400">Giảm giá:</span>
                  <span className="text-green-400">-{formatPrice(voucherResult.discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center gap-4 pt-1 border-t border-white/10">
                <span className="text-gray-300 font-medium">Thanh toán:</span>
                <span className="text-xl font-bold text-[#eab308]">{formatPrice(getFinalTotal())}</span>
              </div>
            </div>
            <Button
              onClick={handleHoldSeats}
              disabled={selectedSeats.length === 0 || holdSeats.isPending}
              loading={holdSeats.isPending}
              className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold px-6 h-11"
            >
              Giữ ghế
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
