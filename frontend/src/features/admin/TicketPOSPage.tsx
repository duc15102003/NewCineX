import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSeatWebSocket } from '@/hooks/useWebSocket'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Ticket, Check } from 'lucide-react'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import Loading from '@/components/common/Loading'
import { fmtDateTime, label, SEAT_TYPE_LABELS } from '@/utils/labels'

function fmt(n: number) {
  return (n ?? 0).toLocaleString('vi-VN') + 'đ'
}

interface ShowtimeOption {
  id: number
  movieTitle: string
  roomId: number
  roomName: string
  startTime: string
  endTime: string
  basePrice: number
  vipPrice: number
  couplePrice: number
}

interface SeatItem {
  id: number
  rowLabel: string
  colNumber: number
  seatNumber: string
  seatType: 'STANDARD' | 'VIP' | 'COUPLE'
  status: string
}

function getSeatColor(seat: SeatItem, isSelected: boolean, isOccupied: boolean): string {
  if (seat.status === 'BROKEN') return 'bg-red-600 cursor-not-allowed opacity-70'
  if (isOccupied) return 'bg-gray-600 cursor-not-allowed opacity-50'
  if (isSelected) return 'bg-[#eab308] text-black font-bold scale-110'
  if (seat.seatType === 'VIP') return 'bg-yellow-600 hover:bg-yellow-500'
  if (seat.seatType === 'COUPLE') return 'bg-purple-600 hover:bg-purple-500'
  return 'bg-green-600 hover:bg-green-500'
}

export default function TicketPOSPage() {
  const qc = useQueryClient()
  const [showtimeId, setShowtimeId] = useState<number | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<number[]>([])

  // Dùng local date (VN timezone), không dùng toISOString() vì nó trả UTC
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const { data: allShowtimes = [], isLoading: loadingShowtimes } = useQuery({
    queryKey: ['pos-showtimes', today],
    queryFn: async () => {
      const res = await api.get('/api/showtimes', { params: { date: today, size: 50 } })
      return res.data.data.content as ShowtimeOption[]
    },
  })

  // Lấy config cutoff từ API (không hardcode)
  const { data: cutoffConfig } = useQuery({
    queryKey: ['config', 'cutoff-minutes'],
    queryFn: async () => {
      const res = await api.get('/api/configs/public/booking.cutoff_after_start_minutes')
      return res.data.data as string
    },
    staleTime: 5 * 60 * 1000,
  })
  const cutoffMinutes = Number(cutoffConfig ?? 15)

  // Chỉ hiện suất chiếu còn đặt được
  const showtimes = allShowtimes.filter(s => {
    const cutoffTime = new Date(new Date(s.startTime).getTime() + cutoffMinutes * 60 * 1000)
    return cutoffTime > new Date()
  })

  const { data: seatData } = useQuery({
    queryKey: ['pos-seats', showtimeId],
    queryFn: async () => {
      const st = showtimes.find(s => s.id === showtimeId)!
      const occupiedRes = await api.get(`/api/bookings/showtimes/${showtimeId}/occupied-seats`)
      const occupiedIds: number[] = occupiedRes.data.data ?? []
      const seatRes = await api.get(`/api/rooms/${st.roomId}/seats`)
      const seatMap: Record<string, SeatItem[]> = seatRes.data.data.seatMap
      return { seatMap, occupiedIds }
    },
    enabled: !!showtimeId,
  })

  const seatMap = seatData?.seatMap ?? {}
  const occupiedIds = seatData?.occupiedIds ?? []
  const rows = Object.entries(seatMap).sort(([a], [b]) => a.localeCompare(b))
  const allSeats = rows.flatMap(([, seats]) => seats)
  const selectedShowtime = showtimes.find(s => s.id === showtimeId)

  function toggleSeat(seat: SeatItem, rowSeats: SeatItem[]) {
    if (seat.status === 'BROKEN' || occupiedIds.includes(seat.id)) return
    // COUPLE: chọn/bỏ cả cặp
    if (seat.seatType === 'COUPLE') {
      const isOdd = seat.colNumber % 2 === 1
      const partnerCol = isOdd ? seat.colNumber + 1 : seat.colNumber - 1
      const partner = rowSeats.find(s => s.colNumber === partnerCol && s.seatType === 'COUPLE')
      const ids = partner ? [seat.id, partner.id] : [seat.id]
      setSelectedSeats(prev => {
        const has = prev.includes(seat.id)
        return has ? prev.filter(id => !ids.includes(id)) : [...prev, ...ids.filter(id => !prev.includes(id))]
      })
    } else {
      setSelectedSeats(prev =>
        prev.includes(seat.id) ? prev.filter(id => id !== seat.id) : [...prev, seat.id]
      )
    }
  }

  const totalAmount = useMemo(() => {
    if (!selectedShowtime) return 0
    return selectedSeats.reduce((sum, seatId) => {
      const seat = allSeats.find(s => s.id === seatId)
      if (!seat) return sum
      if (seat.seatType === 'VIP') return sum + (selectedShowtime.vipPrice ?? selectedShowtime.basePrice)
      if (seat.seatType === 'COUPLE') return sum + (selectedShowtime.couplePrice ?? selectedShowtime.basePrice)
      return sum + selectedShowtime.basePrice
    }, 0)
  }, [selectedSeats, allSeats, selectedShowtime])

  // WebSocket: cập nhật ghế real-time khi user hold/book/cancel
  const handleSeatUpdate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['pos-seats', showtimeId] })
  }, [qc, showtimeId])
  useSeatWebSocket(showtimeId ?? 0, handleSeatUpdate)

  const saleMut = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/bookings/counter-sale', { showtimeId, seatIds: selectedSeats })
      return res.data.data
    },
    onSuccess: (data: any) => {
      toast.success(`Bán vé thành công — Mã: ${data.bookingCode}`)
      setSelectedSeats([])
      qc.invalidateQueries({ queryKey: ['pos-seats', showtimeId] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi bán vé')),
  })

  if (loadingShowtimes) return <Loading />

  return (
    <div className="space-y-6">
      {/* Suất chiếu — full width, cuộn ngang */}
      <Card className="bg-[#0a1929] border-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base">Suất chiếu hôm nay ({showtimes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {showtimes.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Không có suất chiếu hôm nay</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {showtimes.map(s => (
                <button key={s.id}
                  onClick={() => { setShowtimeId(s.id); setSelectedSeats([]) }}
                  className={`flex-shrink-0 w-56 p-4 rounded-xl border text-left transition-all ${
                    showtimeId === s.id
                      ? 'border-[#eab308] bg-[#eab308]/10 shadow-lg shadow-[#eab308]/10'
                      : 'border-white/5 hover:border-white/15 bg-[#0d2137]'
                  }`}>
                  <p className="text-white font-semibold text-sm truncate">{s.movieTitle}</p>
                  <p className="text-gray-500 text-xs mt-1">{s.roomName}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-400 text-xs">{fmtDateTime(s.startTime)}</span>
                    <span className="text-[#eab308] text-sm font-bold">{fmt(s.basePrice)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sơ đồ ghế + Tóm tắt xếp dọc */}
      {showtimeId && (
        <div className="space-y-6">

          {/* Sơ đồ ghế */}
          <Card className="bg-[#0a1929] border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">
                Sơ đồ ghế — {selectedShowtime?.roomName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Màn chiếu — đồng bộ với SeatSelectionPage + SeatMapEditorPage */}
              <div className="flex justify-center mb-8">
                <div className="w-3/4 text-center">
                  <div className="h-1.5 bg-gradient-to-r from-transparent via-[#eab308] to-transparent rounded-full" />
                  <div className="h-8 bg-gradient-to-b from-[#eab308]/10 to-transparent" />
                  <p className="text-xs text-gray-500 tracking-[0.3em] uppercase -mt-4">Màn hình</p>
                </div>
              </div>

              {/* Grid ghế theo hàng */}
              <div className="space-y-2 overflow-x-auto pb-4">
                {rows.map(([rowLabel, seats]) => {
                  const rendered: React.ReactElement[] = []
                  const skipCols = new Set<number>()

                  for (let i = 0; i < seats.length; i++) {
                    const seat = seats[i]
                    if (skipCols.has(seat.colNumber)) continue

                    const isSelected = selectedSeats.includes(seat.id)
                    const isOccupied = occupiedIds.includes(seat.id)

                    // COUPLE gộp 2 ô
                    if (seat.seatType === 'COUPLE') {
                      const partner = seats[i + 1]
                      if (partner?.seatType === 'COUPLE' && seat.colNumber % 2 === 1) {
                        skipCols.add(partner.colNumber)
                        const pairSelected = isSelected && selectedSeats.includes(partner.id)
                        const pairOccupied = isOccupied || occupiedIds.includes(partner.id)
                        const pairBroken = seat.status === 'BROKEN' || partner.status === 'BROKEN'
                        let cls = 'bg-purple-600 hover:bg-purple-500'
                        if (pairBroken) cls = 'bg-red-600 opacity-70 cursor-not-allowed'
                        else if (pairOccupied) cls = 'bg-gray-600 opacity-50 cursor-not-allowed'
                        else if (pairSelected) cls = 'bg-[#eab308] text-black font-bold scale-105'

                        rendered.push(
                          <button key={seat.id}
                            title={`${seat.seatNumber}-${partner.seatNumber} (Đôi)`}
                            disabled={pairBroken || pairOccupied}
                            onClick={() => toggleSeat(seat, seats)}
                            className={`h-10 rounded-t-md text-sm font-medium transition-all ${cls}`}
                            style={{ width: 'calc(2 * 2.5rem + 0.375rem)' }}>
                            {seat.colNumber}-{partner.colNumber}
                          </button>
                        )
                        continue
                      }
                    }

                    // Ghế đơn
                    rendered.push(
                      <button key={seat.id}
                        title={`${seat.seatNumber} (${label(SEAT_TYPE_LABELS, seat.seatType)})`}
                        disabled={seat.status === 'BROKEN' || isOccupied}
                        onClick={() => toggleSeat(seat, seats)}
                        className={`w-10 h-10 rounded-t-md text-sm font-medium transition-all ${getSeatColor(seat, isSelected, isOccupied)}`}>
                        {seat.colNumber}
                      </button>
                    )
                  }

                  return (
                    <div key={rowLabel} className="flex items-center gap-2 justify-center">
                      <span className="w-6 text-center text-sm text-gray-500 font-mono">{rowLabel}</span>
                      <div className="flex gap-1.5">{rendered}</div>
                      <span className="w-6 text-center text-sm text-gray-500 font-mono">{rowLabel}</span>
                    </div>
                  )
                })}
              </div>

              {/* Chú thích */}
              <div className="flex flex-wrap justify-center gap-5 mt-6 pt-4 border-t border-white/5 text-xs text-gray-400">
                <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-green-600" /> Thường</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-yellow-600" /> VIP</span>
                <span className="flex items-center gap-1.5"><span className="w-8 h-4 rounded bg-purple-600" /> Đôi</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-[#eab308]" /> Đang chọn</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-gray-600 opacity-50" /> Đã bán</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-600" /> Hỏng</span>
              </div>
            </CardContent>
          </Card>

          {/* Tóm tắt đơn vé — nằm dưới sơ đồ ghế, layout ngang */}
          <Card className="bg-[#0a1929] border-white/5">
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Trái: thông tin + ghế đã chọn */}
                <div className="flex-1 space-y-3">
                  {selectedShowtime && (
                    <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
                      <span className="text-gray-400">Phim: <span className="text-white font-medium">{selectedShowtime.movieTitle}</span></span>
                      <span className="text-gray-400">Giờ: <span className="text-white">{fmtDateTime(selectedShowtime.startTime)}</span></span>
                      <span className="text-gray-400">Phòng: <span className="text-white">{selectedShowtime.roomName}</span></span>
                    </div>
                  )}

                  <div>
                    <p className="text-gray-400 text-xs mb-1.5">
                      Ghế đã chọn {selectedSeats.length > 0 && `(${selectedSeats.length})`}
                    </p>
                    {selectedSeats.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSeats.map(seatId => {
                          const seat = allSeats.find(s => s.id === seatId)
                          if (!seat) return null
                          return (
                            <span key={seatId} className="text-xs px-2.5 py-1 rounded-md bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/20 font-medium">
                              {seat.seatNumber}
                              <span className="text-[#eab308]/60 ml-1">
                                {seat.seatType === 'VIP' ? 'VIP' : seat.seatType === 'COUPLE' ? 'Đôi' : ''}
                              </span>
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-600 text-xs">Chưa chọn ghế nào</p>
                    )}
                  </div>

                  {/* Chi tiết giá */}
                  {selectedSeats.length > 0 && selectedShowtime && (
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-300">
                      {(() => {
                        const types = { STANDARD: 0, VIP: 0, COUPLE: 0 }
                        selectedSeats.forEach(id => {
                          const s = allSeats.find(seat => seat.id === id)
                          if (s) types[s.seatType as keyof typeof types]++
                        })
                        return (
                          <>
                            {types.STANDARD > 0 && <span>Thường x{types.STANDARD} = {fmt(types.STANDARD * selectedShowtime.basePrice)}</span>}
                            {types.VIP > 0 && <span>VIP x{types.VIP} = {fmt(types.VIP * (selectedShowtime.vipPrice ?? selectedShowtime.basePrice))}</span>}
                            {types.COUPLE > 0 && <span>Đôi x{types.COUPLE} = {fmt(types.COUPLE * (selectedShowtime.couplePrice ?? selectedShowtime.basePrice))}</span>}
                          </>
                        )
                      })()}
                    </div>
                  )}
                </div>

                {/* Phải: tổng tiền + nút bán */}
                <div className="flex flex-col items-end justify-center gap-3 md:border-l md:border-white/5 md:pl-6 min-w-[220px]">
                  <div className="text-right w-full">
                    <p className="text-gray-400 text-xs">Tổng tiền</p>
                    <p className="text-[#eab308] text-3xl font-bold">{fmt(totalAmount)}</p>
                  </div>
                  <Button
                    onClick={() => saleMut.mutate()}
                    disabled={selectedSeats.length === 0 || saleMut.isPending}
                    className="w-full bg-[#eab308] hover:bg-[#ca8a04] text-black font-bold h-12 text-base rounded-xl">
                    <Check size={18} className="mr-2" />
                    {saleMut.isPending ? 'Đang xử lý...' : 'Xác nhận bán vé'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chưa chọn suất */}
      {!showtimeId && showtimes.length > 0 && (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <Ticket size={48} className="mx-auto mb-3 opacity-30" />
            <p>Chọn suất chiếu ở trên để bắt đầu bán vé</p>
          </div>
        </div>
      )}
    </div>
  )
}
