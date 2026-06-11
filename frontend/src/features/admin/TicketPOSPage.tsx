import { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Ticket } from 'lucide-react'

import { useSeatWebSocket } from '@/hooks/useWebSocket'
import Loading from '@/components/common/Loading'

import POSShowtimePicker from './components/POSShowtimePicker'
import POSSeatGrid from './components/POSSeatGrid'
import POSOrderSummary, { type PosPaymentMethod } from './components/POSOrderSummary'
import POSTheaterRequired from './components/POSTheaterRequired'

import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import {
  usePOSShowtimes, useCutoffMinutes, usePOSSeats, useCounterSale,
  type POSSeat,
} from '@/hooks/usePOS'

/** Local date string (VN timezone) — không dùng toISOString() vì nó trả UTC. */
function getTodayLocal(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function TicketPOSPage() {
  const qc = useQueryClient()
  const [showtimeId, setShowtimeId] = useState<number | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<number[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('CASH')

  // POS chuẩn industry (Vista/Veezi): BẮT BUỘC bind 1 theater context cụ thể.
  // BRANCH_ADMIN có theater từ JWT → store luôn có giá trị; SUPER_ADMIN chọn "Tất cả CN" → null → chặn.
  const { currentTheater } = useAdminTheaterStore()

  const today = getTodayLocal()
  const { data: allShowtimes = [], isLoading: loadingShowtimes } =
    usePOSShowtimes(today, currentTheater?.id)
  const { data: cutoffMinutes = 15 } = useCutoffMinutes()

  // Chỉ hiện suất chiếu còn đặt được (chưa quá cutoff)
  const showtimes = useMemo(
    () => allShowtimes.filter(s => {
      const cutoffTime = new Date(new Date(s.startTime).getTime() + cutoffMinutes * 60 * 1000)
      return cutoffTime > new Date()
    }),
    [allShowtimes, cutoffMinutes],
  )

  const selectedShowtime = showtimes.find(s => s.id === showtimeId)

  const { data: seatData } = usePOSSeats(showtimeId, selectedShowtime?.roomId)
  const seatMap = seatData?.seatMap ?? {}
  const occupiedIds = seatData?.occupiedIds ?? []
  const rows = Object.entries(seatMap).sort(([a], [b]) => a.localeCompare(b))
  const allSeats = rows.flatMap(([, seats]) => seats)

  // WebSocket: cập nhật ghế real-time khi user khác hold/book/cancel
  const handleSeatUpdate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['pos-seats', showtimeId] })
  }, [qc, showtimeId])
  useSeatWebSocket(showtimeId ?? 0, handleSeatUpdate)

  const saleMut = useCounterSale(showtimeId)

  const totalAmount = useMemo(() => {
    if (!selectedShowtime) return 0
    const st = selectedShowtime
    const base = st.basePrice
    const vip = st.vipPrice ?? base
    const couple = st.couplePrice ?? base
    return selectedSeats.reduce((sum, seatId) => {
      const seat = allSeats.find(s => s.id === seatId)
      if (!seat) return sum
      switch (seat.seatType) {
        case 'VIP':      return sum + vip
        case 'COUPLE':   return sum + couple
        // SWEETBOX fallback couple × 2 nếu chưa có giá
        case 'SWEETBOX': return sum + (st.sweetboxPrice ?? couple * 2)
        // DELUXE fallback vip × 1.5
        case 'DELUXE':   return sum + (st.deluxePrice ?? Math.round(vip * 1.5))
        // HANDICAP inclusive policy (basePrice)
        case 'HANDICAP': return sum + base
        default:         return sum + base  // STANDARD
      }
    }, 0)
  }, [selectedSeats, allSeats, selectedShowtime])

  function pickShowtime(id: number) {
    setShowtimeId(id)
    setSelectedSeats([])
  }

  function toggleSeat(seat: POSSeat, rowSeats: POSSeat[]) {
    if (seat.aisle) return  // lối đi không phải ghế
    if (seat.status === 'BROKEN' || seat.status === 'BLOCKED') return
    if (occupiedIds.includes(seat.id)) return
    // COUPLE + SWEETBOX: chọn/bỏ cả cặp
    if (seat.seatType === 'COUPLE' || seat.seatType === 'SWEETBOX') {
      const isOdd = seat.colNumber % 2 === 1
      const partnerCol = isOdd ? seat.colNumber + 1 : seat.colNumber - 1
      const partner = rowSeats.find(s => s.colNumber === partnerCol && s.seatType === seat.seatType)
      const ids = partner ? [seat.id, partner.id] : [seat.id]
      setSelectedSeats(prev => {
        const has = prev.includes(seat.id)
        return has
          ? prev.filter(id => !ids.includes(id))
          : [...prev, ...ids.filter(id => !prev.includes(id))]
      })
    } else {
      setSelectedSeats(prev =>
        prev.includes(seat.id) ? prev.filter(id => id !== seat.id) : [...prev, seat.id]
      )
    }
  }

  function handleConfirmSale() {
    saleMut.mutate({ seatIds: selectedSeats, paymentMethod }, {
      onSuccess: () => setSelectedSeats([]),
    })
  }

  if (!currentTheater) return <POSTheaterRequired mode="TICKET" />
  if (loadingShowtimes) return <Loading />

  return (
    <div className="space-y-6">
      <POSShowtimePicker
        showtimes={showtimes}
        selectedId={showtimeId}
        onSelect={pickShowtime}
      />

      {showtimeId && selectedShowtime && (
        <div className="space-y-6">
          <POSSeatGrid
            roomName={selectedShowtime.roomName}
            rows={rows}
            selectedSeats={selectedSeats}
            occupiedIds={occupiedIds}
            onToggleSeat={toggleSeat}
          />

          <POSOrderSummary
            showtime={selectedShowtime}
            selectedSeats={selectedSeats}
            allSeats={allSeats}
            totalAmount={totalAmount}
            saleInProgress={saleMut.isPending}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            onConfirmSale={handleConfirmSale}
          />
        </div>
      )}

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
