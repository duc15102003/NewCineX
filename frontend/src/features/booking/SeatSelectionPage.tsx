import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import {
  useShowtimeSeatMap, useHoldSeats,
  useOccupiedSeats, useAvailableVouchers, useValidateVoucher,
  type AvailableVoucher, type VoucherValidateResult,
} from '@/hooks/useBooking'
import { useSeatWebSocket } from '@/hooks/useWebSocket'
import { usePublicConfigNumber } from '@/hooks/useConfig'
import { usePageTitle } from '@/hooks/usePageTitle'
import Loading from '@/components/common/Loading'

import SeatMap from './components/SeatMap'
import BookingSummary from './components/BookingSummary'
import AgeConfirmDialog from './components/AgeConfirmDialog'
import type { SeatItem } from '@/types/booking'
import { needsAgeConfirm } from '@/utils/labels'
import type { AgeRating } from '@/types/movie'
import { getSeatPrice } from '@/utils/pricing'

export default function SeatSelectionPage() {
  const { showtimeId } = useParams<{ showtimeId: string }>()
  const navigate = useNavigate()
  const id = Number(showtimeId)

  const { data, isLoading, isError } = useShowtimeSeatMap(id)
  usePageTitle(data?.showtime?.movieTitle ? `Chọn ghế — ${data.showtime.movieTitle}` : 'Chọn ghế')
  const holdSeats = useHoldSeats()
  const validateVoucherMut = useValidateVoucher()
  // Hold minutes từ system_config (admin có thể chỉnh) — KHÔNG hardcode "10 phút"
  const { data: holdMinutes = 10 } = usePublicConfigNumber('booking.hold_minutes', 10)

  // Restore selection từ localStorage khi mount — tránh mất ghế đang chọn khi
  // user lỡ F5 / đóng tab nhầm. Key scope theo showtimeId để không lẫn lộn
  // giữa các suất chiếu khác nhau. Voucher CODE cũng restore nhưng VOUCHER
  // RESULT để user re-apply (tránh stale discount khi user back lại sau lâu).
  const storageKey = `cinex.booking.seat-selection.${id}`
  const initialState = readPersistedState(storageKey)

  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>(initialState.selectedSeatIds)
  const [occupiedSeatIds, setOccupiedSeatIds] = useState<number[]>([])
  const [voucherCode, setVoucherCode] = useState(initialState.voucherCode)
  const [voucherResult, setVoucherResult] = useState<VoucherValidateResult | null>(null)
  const [showVoucherList, setShowVoucherList] = useState(true)
  const [ageConfirmOpen, setAgeConfirmOpen] = useState(false)

  // Persist mỗi khi selection / voucher code thay đổi. Bỏ qua initial render
  // (đã restore xong) để tránh ghi đè state bằng chính nó.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (selectedSeatIds.length === 0 && !voucherCode) {
      localStorage.removeItem(storageKey)
    } else {
      localStorage.setItem(storageKey, JSON.stringify({ selectedSeatIds, voucherCode }))
    }
  }, [selectedSeatIds, voucherCode, storageKey])

  // Ghế đã occupied — load qua hook, đồng bộ vào local state để WS có thể patch tăng dần
  const { data: initialOccupied = [] } = useOccupiedSeats(id || null)
  useEffect(() => {
    if (initialOccupied.length === 0) return
    setOccupiedSeatIds(initialOccupied)
    // Sau F5 restore: nếu ghế đã chọn nằm trong occupied (người khác giành
    // trong lúc user offline) → loại ra + báo cho user biết, tránh user click
    // "Giữ ghế" rồi BE từ chối.
    setSelectedSeatIds(prev => {
      const stolen = prev.filter(sid => initialOccupied.includes(sid))
      if (stolen.length === 0) return prev
      toast.warning(`${stolen.length} ghế đã được người khác đặt — đã bỏ khỏi danh sách của bạn`)
      return prev.filter(sid => !initialOccupied.includes(sid))
    })
  }, [initialOccupied])

  // WebSocket: nhận update ghế real-time
  const handleSeatUpdate = useCallback((update: { seatIds: number[]; status: string }) => {
    if (update.status === 'HOLDING' || update.status === 'CONFIRMED') {
      setOccupiedSeatIds(prev => [...new Set([...prev, ...update.seatIds])])
    } else if (update.status === 'AVAILABLE') {
      setOccupiedSeatIds(prev => prev.filter(sid => !update.seatIds.includes(sid)))
    }
  }, [])
  useSeatWebSocket(id, handleSeatUpdate)

  // beforeunload warning: ngăn user vô tình đóng tab / nav-away khi đã chọn ghế.
  // Ghế chưa thực sự lock cho mình tới khi click "Giữ ghế" → user khác có thể giành ghế nếu rời trang.
  useEffect(() => {
    if (selectedSeatIds.length === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Chrome/Edge cần returnValue; Firefox đọc text returned. Browser hiện
      // generic warning, không hiện string custom (security policy).
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [selectedSeatIds.length])

  function toggleSeat(seat: SeatItem, seats?: SeatItem[]) {
    if (seat.aisle) return  // lối đi không phải ghế
    if (seat.status === 'BROKEN' || seat.status === 'BLOCKED') return
    if (occupiedSeatIds.includes(seat.id)) return

    // COUPLE & SWEETBOX: chọn/bỏ cả cặp
    if ((seat.seatType === 'COUPLE' || seat.seatType === 'SWEETBOX') && seats) {
      const isOdd = seat.colNumber % 2 === 1
      const partnerCol = isOdd ? seat.colNumber + 1 : seat.colNumber - 1
      const partner = seats.find(s => s.colNumber === partnerCol && s.seatType === seat.seatType)
      const ids = partner ? [seat.id, partner.id] : [seat.id]
      const allSelected = ids.every(sid => selectedSeatIds.includes(sid))

      setSelectedSeatIds(prev =>
        allSelected
          ? prev.filter(sid => !ids.includes(sid))
          : [...new Set([...prev, ...ids])]
      )
      return
    }

    setSelectedSeatIds(prev =>
      prev.includes(seat.id) ? prev.filter(s => s !== seat.id) : [...prev, seat.id],
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

  // Fetch voucher khả dụng khi tổng tiền thay đổi.
  // theaterId từ showtime → server resolve theater-specific + global voucher.
  const total = calcTotal()
  const showtimeTheaterId = data?.showtime?.theaterId
  const { data: availableVouchers = [] } = useAvailableVouchers(total, showtimeTheaterId)

  function selectVoucher(v: AvailableVoucher) {
    setVoucherCode(v.code)
    setVoucherResult({ valid: true, code: v.code, discountAmount: v.discountAmount, message: v.description })
    setShowVoucherList(false)
  }

  async function handleApplyVoucher() {
    if (!voucherCode.trim()) return
    if (total === 0) { toast.error('Vui lòng chọn ghế trước'); return }
    validateVoucherMut.mutate(
      { code: voucherCode.trim(), orderAmount: total, theaterId: showtimeTheaterId },
      {
        onSuccess: (result) => {
          setVoucherResult(result)
          if (!result.valid) toast.error(result.message)
        },
        onError: () => setVoucherResult(null),
      },
    )
  }

  function clearVoucher() {
    setVoucherCode('')
    setVoucherResult(null)
  }

  function getFinalTotal(): number {
    if (voucherResult?.valid && voucherResult.discountAmount) {
      return Math.max(0, total - voucherResult.discountAmount)
    }
    return total
  }

  async function doHoldSeats() {
    try {
      const result = await holdSeats.mutateAsync({
        showtimeId: id,
        seatIds: selectedSeatIds,
        voucherCode: voucherCode.trim() || undefined,
      })
      // Hold thành công → BE đã lock ghế dưới bookingId, không cần state ở
      // page này nữa. Clear để lần sau quay lại trang chọn ghế bắt đầu lại từ
      // đầu, không restore selection cũ.
      localStorage.removeItem(storageKey)
      navigate(`/payment/${result.bookingId}`)
    } catch {
      // Toast generic đã hiện từ hook onError. Show thêm toast với nút "Thử
      // lại" để user re-attempt mà không phải scroll xuống click button nữa.
      // Đặc biệt hữu ích khi user trên mobile, button có thể bị che bởi keyboard.
      toast.error('Giữ ghế thất bại', {
        action: { label: 'Thử lại', onClick: () => doHoldSeats() },
        duration: 10_000,
      })
    }
  }

  async function handleHoldSeats() {
    if (selectedSeatIds.length === 0) return
    // Chuẩn industry: T13/T16/T18/C → mở confirm dialog xác nhận tuổi + cảnh báo mang CCCD.
    // P/K → vào thẳng hold seats.
    if (needsAgeConfirm(data?.showtime?.movieAgeRating)) {
      setAgeConfirmOpen(true)
      return
    }
    await doHoldSeats()
  }

  async function handleConfirmAge() {
    setAgeConfirmOpen(false)
    await doHoldSeats()
  }

  if (isLoading) return <Loading />
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[#181309] flex items-center justify-center">
        <p className="text-red-400">Không thể tải thông tin suất chiếu.</p>
      </div>
    )
  }

  const { showtime, seatMap } = data
  const rows = Object.entries(seatMap.seatMap ?? {}).sort(([a], [b]) => a.localeCompare(b))
  const selectedSeats = getSelectedSeats()

  return (
    <div className="min-h-screen bg-[#181309] text-white py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <ShowtimeInfoCard
          movieTitle={showtime.movieTitle}
          roomName={seatMap.roomName}
          startTime={showtime.startTime}
          totalSeats={seatMap.totalSeats}
          appliedRules={showtime.appliedRules ?? undefined}
        />

        {/* Cảnh báo ghế chưa lock — user khác có thể giành mất nếu rời trang lâu */}
        {selectedSeatIds.length > 0 && (
          <div className="mb-4 flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-sm">
            <span className="text-orange-400 text-base leading-none mt-0.5">⚠️</span>
            <p className="text-orange-200/90 leading-relaxed">
              Ghế bạn chọn <span className="font-semibold">chưa được giữ riêng</span>. Hãy bấm
              <span className="text-[#ffc107] font-semibold"> "Giữ ghế" </span>
              ở dưới để khóa ghế trong {holdMinutes} phút và tiến hành thanh toán.
            </p>
          </div>
        )}

        <SeatMap
          rows={rows}
          selectedSeatIds={selectedSeatIds}
          occupiedSeatIds={occupiedSeatIds}
          onToggle={toggleSeat}
        />

        <BookingSummary
          selectedSeats={selectedSeats}
          showtime={showtime}
          total={total}
          finalTotal={getFinalTotal()}
          voucherCode={voucherCode}
          onVoucherCodeChange={(code) => { setVoucherCode(code); setVoucherResult(null) }}
          voucherResult={voucherResult}
          voucherLoading={validateVoucherMut.isPending}
          onApplyVoucher={handleApplyVoucher}
          onClearVoucher={clearVoucher}
          availableVouchers={availableVouchers}
          showVoucherList={showVoucherList}
          onToggleVoucherList={() => setShowVoucherList(s => !s)}
          onSelectVoucher={selectVoucher}
          onHoldSeats={handleHoldSeats}
          holdSeatsPending={holdSeats.isPending}
        />
      </div>

      {data?.showtime?.movieAgeRating && (
        <AgeConfirmDialog
          open={ageConfirmOpen}
          onOpenChange={setAgeConfirmOpen}
          ageRating={data.showtime.movieAgeRating as AgeRating}
          movieTitle={data.showtime.movieTitle}
          onConfirm={handleConfirmAge}
          loading={holdSeats.isPending}
        />
      )}
    </div>
  )
}

// ============================================================
//  Helpers
// ============================================================

interface PersistedState {
  selectedSeatIds: number[]
  voucherCode: string
}

const EMPTY_STATE: PersistedState = { selectedSeatIds: [], voucherCode: '' }

/**
 * Đọc state từ localStorage — defensive: storage có thể bị corrupted (user
 * sửa tay, browser sync conflict). Mọi lỗi → trả empty state thay vì throw.
 */
function readPersistedState(key: string): PersistedState {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return EMPTY_STATE
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.selectedSeatIds)) return EMPTY_STATE
    return {
      selectedSeatIds: parsed.selectedSeatIds.filter((n: unknown) => typeof n === 'number'),
      voucherCode: typeof parsed.voucherCode === 'string' ? parsed.voucherCode : '',
    }
  } catch {
    return EMPTY_STATE
  }
}

// ============================================================
//  Sub-components
// ============================================================

interface ShowtimeInfoCardProps {
  movieTitle: string
  roomName: string
  startTime: string
  totalSeats: number
  appliedRules?: { code: string; name: string; discountPercent: number }[]
}

function ShowtimeInfoCard({ movieTitle, roomName, startTime, totalSeats, appliedRules }: ShowtimeInfoCardProps) {
  return (
    <div className="bg-[#201b11] border border-white/5 rounded-2xl p-5 mb-6">
      <h1 className="text-xl font-bold text-[#ffc107] mb-1">{movieTitle}</h1>
      <div className="flex flex-wrap gap-4 text-sm text-gray-300">
        <span>Phòng: <span className="text-white font-medium">{roomName}</span></span>
        <span>Suất: <span className="text-white font-medium">
          {new Date(startTime).toLocaleString('vi-VN', {
            weekday: 'short', day: '2-digit', month: '2-digit',
            year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span></span>
        <span>Tổng ghế: <span className="text-white font-medium">{totalSeats}</span></span>
      </div>
      {/* Chỉ hiện chip giảm (discountPercent < 0) — chuẩn rạp VN ẩn rule tăng giá. */}
      {appliedRules && appliedRules.some(r => r.discountPercent < 0) && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/5">
          {appliedRules.filter(r => r.discountPercent < 0).map(r => (
            <span
              key={r.code}
              className="text-xs px-2 py-1 rounded-md border bg-green-500/10 text-green-400 border-green-500/30"
              title={r.name}
            >
              {r.name} {r.discountPercent}%
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
