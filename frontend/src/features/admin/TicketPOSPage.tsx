import { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Ticket } from 'lucide-react'

import { useSeatWebSocket } from '@/hooks/useWebSocket'
import Loading from '@/components/common/Loading'

import POSShowtimePicker from './components/POSShowtimePicker'
import POSSeatGrid from './components/POSSeatGrid'
import POSOrderSummary, { type PosPaymentMethod } from './components/POSOrderSummary'
import POSTheaterRequired from './components/POSTheaterRequired'
import ReceiptDialog, { type TicketReceiptData } from './components/ReceiptDialog'
import ConfirmCounterPaymentDialog from './components/ConfirmCounterPaymentDialog'

import { useAuthStore } from '@/store/authStore'
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
  const [receipt, setReceipt] = useState<TicketReceiptData | null>(null)
  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false)

  // POS BẮT BUỘC bind 1 theater context. Priority: topbar switcher (SUPER_ADMIN
  // pick) > JWT theaterId (ADMIN + STAFF đều có sẵn). STAFF không phải chọn
  // lại — đã gắn chi nhánh từ lúc tạo tài khoản.
  const { currentTheater } = useAdminTheaterStore()
  const user = useAuthStore(s => s.user)
  const theaterId = currentTheater?.id ?? user?.theaterId ?? null

  const today = getTodayLocal()
  const { data: allShowtimes = [], isLoading: loadingShowtimes } =
    usePOSShowtimes(today, theaterId)
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

  /** Step 1: NV bấm "Xác nhận bán vé" → mở dialog xác nhận đã thu tiền. */
  function openPaymentConfirm() {
    if (!selectedShowtime || selectedSeats.length === 0) return
    setConfirmPaymentOpen(true)
  }

  /** Step 2: trong dialog, NV xác nhận tiền đã thu → mới gọi BE tạo booking. */
  function handleConfirmSale() {
    if (!selectedShowtime) return
    // Snapshot trước khi clear state — onSuccess sẽ reset selectedSeats.
    const seatDetails = selectedSeats.map(id => {
      const seat = allSeats.find(s => s.id === id)
      if (!seat) return null
      const st = selectedShowtime
      const base = st.basePrice
      const vip = st.vipPrice ?? base
      const couple = st.couplePrice ?? base
      let price: number
      switch (seat.seatType) {
        case 'VIP':      price = vip; break
        case 'COUPLE':   price = couple; break
        case 'SWEETBOX': price = st.sweetboxPrice ?? couple * 2; break
        case 'DELUXE':   price = st.deluxePrice ?? Math.round(vip * 1.5); break
        case 'HANDICAP': price = base; break
        default:         price = base
      }
      return { seatNumber: seat.seatNumber, seatType: seat.seatType, price }
    }).filter((s): s is { seatNumber: string; seatType: string; price: number } => s !== null)
    const snapshotShowtime = selectedShowtime
    const snapshotTotal = totalAmount
    const snapshotMethod = paymentMethod
    saleMut.mutate({ seatIds: selectedSeats, paymentMethod }, {
      onSuccess: (data) => {
        setReceipt({
          kind: 'TICKET',
          bookingCode: data.bookingCode,
          movieTitle: snapshotShowtime.movieTitle,
          roomName: snapshotShowtime.roomName,
          startTime: snapshotShowtime.startTime,
          seats: seatDetails,
          total: snapshotTotal,
          paymentMethod: snapshotMethod,
          paidAt: new Date().toISOString(),
        })
        setSelectedSeats([])
        setConfirmPaymentOpen(false)
      },
    })
  }

  if (!theaterId) return <POSTheaterRequired mode="TICKET" />
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
            onConfirmSale={openPaymentConfirm}
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

      <ConfirmCounterPaymentDialog
        open={confirmPaymentOpen}
        onOpenChange={setConfirmPaymentOpen}
        paymentMethod={paymentMethod}
        totalAmount={totalAmount}
        loading={saleMut.isPending}
        onConfirm={handleConfirmSale}
      />

      <ReceiptDialog
        open={!!receipt}
        onClose={() => setReceipt(null)}
        data={receipt}
        theaterName={currentTheater?.name ?? user?.theaterName ?? null}
        cashierName={user?.username ?? null}
      />
    </div>
  )
}
