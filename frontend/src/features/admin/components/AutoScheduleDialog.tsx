import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { AlertTriangle, CalendarRange, Clock, Film, Loader2, MapPin, Repeat,
  Sparkles, Tag, Wallet, Info, X } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import MultiSelect from '@/components/common/MultiSelect'
import api from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import { useAutoScheduleShowtimes, useAdminShowtimes, type AutoScheduleResult,
  type AutoScheduleSlotMode, type ShowtimeFormat,
  type ShowtimeLanguageMode } from '@/hooks/useAdminShowtimes'
import { useAdminMovies, useAdminRooms, useTheaterOptions } from '@/hooks/useAdmin'
import { useMovieRuns } from '@/hooks/useMovieRuns'
import { usePublicConfigNumber } from '@/hooks/useConfig'
import type { RoomSeatTypeSummary, SeatType } from '@/hooks/useAdminRooms'
import { OPTIONS_DROPDOWN_PAGE_SIZE } from '@/utils/constants'
import { fmtDate, fmtDateTime, fmtVnd,
  SHOWTIME_FORMAT_LABELS, SHOWTIME_LANGUAGE_LABELS } from '@/utils/labels'
import { SEAT_TYPE_PRICE_TEXT } from '@/utils/colors'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  scopedTheaterId: number | null
  theaterLocked: boolean
}

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 ' +
  'focus:outline-none focus:ring-1 focus:ring-[#ffc107] focus:border-[#ffc107]'

/**
 * Auto-schedule dialog — tạo nhiều suất chiếu 1 click.
 *
 * <p>Form chia thành sections rõ ràng cho admin dễ scan:
 * 1. Phim & Chi nhánh
 * 2. Phòng chiếu (multi-select)
 * 3. Khoảng ngày & khung giờ
 * 4. Bảng giá
 *
 * <p><b>Buffer dọn phòng:</b> đọc từ Cấu hình hệ thống — không cho sửa
 * per-batch để giữ policy thống nhất toàn rạp.
 */
export default function AutoScheduleDialog({ open, onOpenChange, scopedTheaterId, theaterLocked }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  const [movieId, setMovieId] = useState<number | null>(null)
  const [theaterId, setTheaterId] = useState<number | null>(scopedTheaterId)
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([])
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [startHour, setStartHour] = useState(8)
  const [endHour, setEndHour] = useState(23)
  // Ngày trong tuần ISO (1=Mon..7=Sun). Default cả 7 ngày — admin off T2-T6
  // để chỉ chiếu cuối tuần là pattern thường gặp.
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(
    () => new Set([1, 2, 3, 4, 5, 6, 7]),
  )
  // Slot mode + giờ cố định cho lịch lặp ("giờ vàng" lặp các ngày).
  const [slotMode, setSlotMode] = useState<AutoScheduleSlotMode>('WINDOW')
  // Mảng HH:mm strings — UI là chip + time picker, không phải text input.
  // Sort ascending, dedupe khi thêm. Default 5 khung giờ phổ biến nhất.
  const [fixedTimes, setFixedTimes] = useState<string[]>(
    ['10:00', '13:00', '16:00', '19:00', '22:00'],
  )
  // Custom time picker — user gõ giờ tuỳ ý rồi ấn "Thêm".
  const [customTimeDraft, setCustomTimeDraft] = useState('')
  // Format + language áp cho TẤT CẢ suất sinh ra.
  // Default TWO_D + SUB_VI khớp BE default.
  const [format, setFormat] = useState<ShowtimeFormat>('TWO_D')
  const [languageMode, setLanguageMode] = useState<ShowtimeLanguageMode>('SUB_VI')
  // asDraft = true → tạo DRAFT (publish workflow: review trước khi public).
  // Default false để giữ hành vi cũ (tạo SCHEDULED ngay, public visible).
  const [asDraft, setAsDraft] = useState(false)
  // Bảng giá đầy đủ 5 tier — admin có nhập hay không tuỳ phòng có loại đó.
  // BE đã có resolveTierPrice: phòng không có loại nào thì BE tự skip.
  const [basePrice, setBasePrice] = useState<number>(80000)
  const [vipPrice, setVipPrice] = useState<number | ''>(120000)
  const [couplePrice, setCouplePrice] = useState<number | ''>(200000)
  const [sweetboxPrice, setSweetboxPrice] = useState<number | ''>('')
  const [deluxePrice, setDeluxePrice] = useState<number | ''>('')
  const [result, setResult] = useState<AutoScheduleResult | null>(null)

  const effectiveTheaterId = theaterLocked ? scopedTheaterId : theaterId

  // eligibleForShowtime=true (kèm theaterId) → BE lọc phim có MovieRun ACTIVE/UPCOMING
  // tại CN. KHÔNG truyền cờ này thì BE rơi vào nhánh "phim đã có showtime tại CN"
  // → bug chỉ hiện 1 phim (phim đầu tiên đã có lịch).
  const { data: moviesData } = useAdminMovies({
    size: OPTIONS_DROPDOWN_PAGE_SIZE,
    theaterId: effectiveTheaterId ?? undefined,
    eligibleForShowtime: effectiveTheaterId ? true : undefined,
  })
  // FE filter (defense-in-depth): chỉ NOW_SHOWING + COMING_SOON sau khi compute
  // per-theater status (BE đã filter tương đương, nhưng giữ để cover edge case
  // status compute lệch — vd phim có run ARCHIVED gần đây).
  const movies = useMemo(
    () => (moviesData?.content ?? []).filter(
      m => m.status === 'NOW_SHOWING' || m.status === 'COMING_SOON',
    ),
    [moviesData],
  )
  const { data: roomsData } = useAdminRooms({
    size: OPTIONS_DROPDOWN_PAGE_SIZE,
    theaterId: effectiveTheaterId ?? undefined,
  })
  const rooms = roomsData?.content ?? []
  const { data: theaters = [] } = useTheaterOptions()

  const mut = useAutoScheduleShowtimes()

  // Fetch seat types cho từng phòng đã chọn (parallel) → union ra tất cả loại
  // ghế present trong các phòng. Input giá cho loại nào hiện trong union mới
  // hiển thị + bắt buộc nhập. Loại không có (tất cả phòng đều thiếu) → ẩn input.
  const seatTypeQueries = useQueries({
    queries: selectedRoomIds.map(roomId => ({
      queryKey: ['admin', 'room-seat-types', roomId],
      queryFn: async () => {
        const res = await api.get<ApiResponse<RoomSeatTypeSummary>>(`/api/rooms/${roomId}/seats/types`)
        return res.data.data
      },
      enabled: roomId > 0,
      staleTime: 5 * 60 * 1000,
    })),
  })
  const presentSeatTypes = useMemo(() => {
    const set = new Set<SeatType>()
    seatTypeQueries.forEach(q => {
      q.data?.seatTypes.forEach(s => set.add(s.seatType))
    })
    return set
  }, [seatTypeQueries])
  const seatTypesLoading = seatTypeQueries.some(q => q.isLoading)
  const hasVIP = presentSeatTypes.has('VIP')
  const hasCouple = presentSeatTypes.has('COUPLE')
  const hasSweetbox = presentSeatTypes.has('SWEETBOX')
  const hasDeluxe = presentSeatTypes.has('DELUXE')

  // Buffer dọn phòng đọc thẳng từ Cấu hình hệ thống → preview FE khớp BE.
  // Fallback 15p khi config chưa fetch xong.
  const { data: bufferFromConfig } = usePublicConfigNumber('showtime.buffer_minutes', 15)
  const BUFFER_MINUTES = bufferFromConfig ?? 15
  const MAX_RANGE_DAYS = 30

  const selectedMovie = useMemo(
    () => movies.find(m => m.id === movieId) ?? null,
    [movies, movieId],
  )

  // Fetch MovieRun của phim + theater để cảnh báo phủ. Industry standard:
  // báo TRƯỚC submit nếu ngày chọn vượt khoảng [run.startDate, run.endDate],
  // thay vì để BE skip im lặng → admin tự đoán "sao tạo ít suất vậy".
  const { data: movieRuns = [] } = useMovieRuns(
    movieId ?? undefined,
    effectiveTheaterId ?? undefined,
  )

  // fixedTimes đã là HH:mm valid by construction (UI add từ time picker chỉ
  // accept format đúng). Wrapper giữ shape { times, invalid } để backward
  // compat với chỗ dùng cũ — invalid luôn [].
  const parsedFixedTimes = useMemo(
    () => ({ times: fixedTimes, invalid: [] as string[] }),
    [fixedTimes],
  )

  function addFixedTime(hhmm: string) {
    if (!/^\d{2}:\d{2}$/.test(hhmm)) return
    setFixedTimes(prev => {
      if (prev.includes(hhmm)) return prev
      return [...prev, hhmm].sort()
    })
  }
  function toggleFixedTime(hhmm: string) {
    setFixedTimes(prev =>
      prev.includes(hhmm) ? prev.filter(t => t !== hhmm) : [...prev, hhmm].sort(),
    )
  }
  function removeFixedTime(hhmm: string) {
    setFixedTimes(prev => prev.filter(t => t !== hhmm))
  }
  function handleAddCustom() {
    if (!customTimeDraft) return
    addFixedTime(customTimeDraft)
    setCustomTimeDraft('')
  }

  // Tính ngày phủ + validation tách riêng để hiển thị lỗi cụ thể từng case
  // thay vì gom 1 thông báo chung.
  const daysCovered = useMemo(() => {
    if (!dateFrom || !dateTo) return 0
    const diff = new Date(dateTo).getTime() - new Date(dateFrom).getTime()
    if (diff < 0) return 0
    return Math.floor(diff / 86400000) + 1
  }, [dateFrom, dateTo])

  // Số ngày THỰC SỰ chiếu = daysCovered ∩ selectedWeekdays — vì admin có thể off
  // T2-T6 → 30 ngày chỉ còn 10 ngày cuối tuần. Preview phải dựa số này, không
  // dùng daysCovered thô (gây ước lượng sai lệch nhiều lần).
  const effectiveDays = useMemo(() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return 0
    if (selectedWeekdays.size === 7) return daysCovered
    let count = 0
    const start = new Date(dateFrom + 'T00:00:00')
    for (let i = 0; i < daysCovered; i++) {
      const d = new Date(start.getTime() + i * 86400000)
      // JS getDay: 0=Sun..6=Sat → convert sang ISO 1=Mon..7=Sun
      const iso = d.getDay() === 0 ? 7 : d.getDay()
      if (selectedWeekdays.has(iso)) count++
    }
    return count
  }, [dateFrom, dateTo, daysCovered, selectedWeekdays])

  // Cảnh báo phủ MovieRun: liệt kê ngày trong [dateFrom, dateTo] không nằm
  // trong bất kỳ MovieRun nào → báo TRƯỚC submit, tránh BE skip im lặng.
  const runCoverage = useMemo(() => {
    if (!movieId || !effectiveTheaterId || !dateFrom || !dateTo) {
      return { uncoveredDays: 0, runs: [] as { startDate: string; endDate: string | null }[] }
    }
    const runs = movieRuns
      .filter(r => r.storageState !== 'ARCHIVED')
      .map(r => ({ startDate: r.startDate, endDate: r.endDate }))
    if (runs.length === 0) return { uncoveredDays: daysCovered, runs }
    let uncovered = 0
    const start = new Date(dateFrom + 'T00:00:00')
    for (let i = 0; i < daysCovered; i++) {
      const d = new Date(start.getTime() + i * 86400000)
      const iso = d.getDay() === 0 ? 7 : d.getDay()
      // Bỏ qua weekday off — đã không tạo suất ngày đó
      if (!selectedWeekdays.has(iso)) continue
      const dStr = d.toISOString().slice(0, 10)
      const covered = runs.some(r =>
        dStr >= r.startDate && (r.endDate == null || dStr <= r.endDate),
      )
      if (!covered) uncovered++
    }
    return { uncoveredDays: uncovered, runs }
  }, [movieId, effectiveTheaterId, dateFrom, dateTo, daysCovered, movieRuns, selectedWeekdays])

  const slotMinutes = selectedMovie ? selectedMovie.duration + BUFFER_MINUTES : 0
  const windowMinutes = (endHour - startHour) * 60
  // slotsPerDay phụ thuộc mode: WINDOW = floor(window/slot); TEMPLATES = số giờ
  // hợp lệ phù hợp duration (fit trong ngày). Preview chỉ là estimate FE.
  const slotsPerDay = useMemo(() => {
    if (slotMinutes <= 0) return 0
    if (slotMode === 'TEMPLATES') {
      return parsedFixedTimes.times.filter(t => {
        const [h, m] = t.split(':').map(Number)
        const startMin = h * 60 + m
        // fit nếu start + slotMinutes ≤ 24:00 (1440 phút)
        return startMin + slotMinutes <= 1440
      }).length
    }
    return windowMinutes > 0 ? Math.floor(windowMinutes / slotMinutes) : 0
  }, [slotMinutes, slotMode, windowMinutes, parsedFixedTimes])

  // Preview = ước lượng FE (BE quyết final + skip slot trùng/past/ngoài run).
  const previewCount = useMemo(() => {
    if (!movieId || !effectiveTheaterId || selectedRoomIds.length === 0) return 0
    if (slotsPerDay <= 0 || effectiveDays <= 0) return 0
    return slotsPerDay * selectedRoomIds.length * effectiveDays
  }, [movieId, effectiveTheaterId, selectedRoomIds, slotsPerDay, effectiveDays])

  // Fetch existing showtimes trong [dateFrom, dateTo] × selectedRooms để
  // preview slot trùng giờ TRƯỚC submit. Tránh trải nghiệm "ấn tạo xong mới
  // biết X suất bị skip".
  const conflictQueryEnabled = !!effectiveTheaterId
    && !!movieId && selectedRoomIds.length > 0
    && !!dateFrom && !!dateTo && dateFrom <= dateTo
  const { data: existingPage } = useAdminShowtimes(conflictQueryEnabled
    ? {
        theaterId: effectiveTheaterId ?? undefined,
        startTimeFrom: `${dateFrom}T00:00`,
        startTimeTo: `${dateTo}T23:59`,
        size: 500,
      }
    : {})
  const existingShowtimes = useMemo(
    () => conflictQueryEnabled ? (existingPage?.content ?? []) : [],
    [existingPage, conflictQueryEnabled],
  )

  // Đếm số slot dự kiến trùng với suất đã có (cùng phòng, overlap thời gian).
  // Match logic BE: 2 interval overlap ⇔ a.start < b.end ∧ b.start < a.end.
  const conflictPreview = useMemo(() => {
    if (!selectedMovie || selectedRoomIds.length === 0 || effectiveDays === 0
        || !dateFrom || !dateTo || dateFrom > dateTo) {
      return { proposed: 0, conflicts: 0 }
    }
    const roomNameById = new Map(rooms.map(r => [r.id, r.name]))
    const selectedRoomNames = new Set(
      selectedRoomIds.map(id => roomNameById.get(id)).filter((n): n is string => !!n),
    )
    // Group existing intervals by roomName (loại CANCELLED/ARCHIVED khỏi check
    // vì BE cũng không count đó là conflict).
    const existingByRoom = new Map<string, Array<[number, number]>>()
    existingShowtimes.forEach(s => {
      if (!selectedRoomNames.has(s.roomName)) return
      if (s.status === 'CANCELLED' || s.storageState === 'ARCHIVED') return
      const start = +new Date(s.startTime)
      const end = +new Date(s.endTime) + BUFFER_MINUTES * 60_000
      if (!existingByRoom.has(s.roomName)) existingByRoom.set(s.roomName, [])
      existingByRoom.get(s.roomName)!.push([start, end])
    })
    const slotMin = selectedMovie.duration + BUFFER_MINUTES
    const slotMs = slotMin * 60_000
    let proposed = 0
    let conflicts = 0
    const startDay = new Date(dateFrom + 'T00:00:00')
    for (let dayIdx = 0; dayIdx < daysCovered; dayIdx++) {
      const day = new Date(startDay.getTime() + dayIdx * 86400000)
      const iso = day.getDay() === 0 ? 7 : day.getDay()
      if (!selectedWeekdays.has(iso)) continue
      // Tính start times cho ngày này
      const startTimes: number[] = []
      if (slotMode === 'TEMPLATES') {
        parsedFixedTimes.times.forEach(t => {
          const [h, mi] = t.split(':').map(Number)
          if (h * 60 + mi + slotMin > 1440) return
          const dt = new Date(day); dt.setHours(h, mi, 0, 0)
          startTimes.push(+dt)
        })
      } else {
        const windowMin = (endHour - startHour) * 60
        const count = windowMin > 0 ? Math.floor(windowMin / slotMin) : 0
        for (let i = 0; i < count; i++) {
          const startMin = startHour * 60 + i * slotMin
          const dt = new Date(day); dt.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0)
          startTimes.push(+dt)
        }
      }
      selectedRoomIds.forEach(roomId => {
        const roomName = roomNameById.get(roomId)
        if (!roomName) return
        const roomExisting = existingByRoom.get(roomName) ?? []
        startTimes.forEach(startMs => {
          proposed++
          const endMs = startMs + slotMs
          if (roomExisting.some(([s, e]) => startMs < e && s < endMs)) conflicts++
        })
      })
    }
    return { proposed, conflicts }
  }, [
    selectedMovie, selectedRoomIds, rooms, existingShowtimes,
    daysCovered, dateFrom, dateTo, selectedWeekdays, slotMode,
    parsedFixedTimes, startHour, endHour, effectiveDays, BUFFER_MINUTES,
  ])

  // ============================================================
  // VALIDATION — bắt mọi edge case trước khi gọi BE:
  //   • Ngày: from ≤ to, không quá khứ, không quá MAX_RANGE_DAYS
  //   • Giờ: start < end, đủ thời gian cho ≥1 slot/ngày
  //   • Giá: bắt buộc nhập theo loại ghế phòng đang chọn
  // Mỗi lỗi push vào formIssues — hiển thị tất cả 1 lúc, không chặn user chỉnh
  // tiếp các field khác. Nếu có ≥1 issue → disable submit.
  // ============================================================
  const formIssues: string[] = []

  if (dateFrom && dateTo) {
    if (dateFrom > dateTo) {
      formIssues.push('"Từ ngày" phải ≤ "Đến ngày"')
    } else if (daysCovered > MAX_RANGE_DAYS) {
      formIssues.push(`Khoảng ngày tối đa ${MAX_RANGE_DAYS} ngày (đang chọn ${daysCovered} ngày)`)
    }
    if (dateTo < today) {
      formIssues.push('"Đến ngày" không được trong quá khứ')
    }
  }

  if (slotMode === 'WINDOW') {
    if (endHour <= startHour) {
      formIssues.push('"Giờ đóng" phải > "Giờ mở"')
    } else if (selectedMovie && slotsPerDay <= 0) {
      formIssues.push(
        `Khung giờ ${startHour}h–${endHour}h không đủ cho 1 suất ` +
        `(phim ${selectedMovie.duration}p + dọn phòng ${BUFFER_MINUTES}p = ${slotMinutes}p)`,
      )
    }
  } else {
    // TEMPLATES mode
    if (parsedFixedTimes.invalid.length > 0) {
      formIssues.push(`Giờ không hợp lệ: ${parsedFixedTimes.invalid.join(', ')} (định dạng HH:mm)`)
    }
    if (parsedFixedTimes.times.length === 0) {
      formIssues.push('Cần nhập ít nhất 1 giờ cố định (vd 10:00)')
    } else if (selectedMovie && slotsPerDay <= 0) {
      formIssues.push(
        `Tất cả giờ cố định đều không đủ thời gian chiếu hết ` +
        `(phim ${selectedMovie.duration}p + dọn phòng ${BUFFER_MINUTES}p)`,
      )
    }
  }

  if (selectedWeekdays.size === 0) {
    formIssues.push('Chọn ít nhất 1 ngày trong tuần')
  }

  // Required price validation: chỉ bắt nhập giá cho loại ghế present trong
  // union các phòng đã chọn. Nếu phòng A có VIP, phòng B không có VIP →
  // vẫn require VIP price (sẽ apply ở phòng A, BE skip ở phòng B).
  const missingPrices: string[] = []
  if (basePrice <= 0) missingPrices.push('Thường')
  if (hasVIP && (vipPrice === '' || Number(vipPrice) <= 0)) missingPrices.push('VIP')
  if (hasCouple && (couplePrice === '' || Number(couplePrice) <= 0)) missingPrices.push('Đôi')
  if (hasSweetbox && (sweetboxPrice === '' || Number(sweetboxPrice) <= 0)) missingPrices.push('Sweetbox')
  if (hasDeluxe && (deluxePrice === '' || Number(deluxePrice) <= 0)) missingPrices.push('Deluxe')

  const canSubmit = !!movieId
    && !!effectiveTheaterId
    && selectedRoomIds.length > 0
    && !seatTypesLoading
    && missingPrices.length === 0
    && formIssues.length === 0

  function toggleAllRooms() {
    setSelectedRoomIds(prev => prev.length === rooms.length ? [] : rooms.map(r => r.id))
  }

  function submit() {
    if (!canSubmit || !movieId || !effectiveTheaterId) return
    // weekdays: chỉ gửi khi != full (BE coi null/empty = full → tiết kiệm payload).
    // fixedTimes: chỉ gửi khi mode TEMPLATES. BE ignore nếu mode WINDOW.
    const weekdaysArr = selectedWeekdays.size === 7
      ? undefined
      : Array.from(selectedWeekdays).sort()
    mut.mutate(
      {
        movieId,
        theaterId: effectiveTheaterId,
        roomIds: selectedRoomIds,
        dateFrom, dateTo,
        startHour, endHour,
        basePrice,
        vipPrice: vipPrice === '' ? undefined : Number(vipPrice),
        couplePrice: couplePrice === '' ? undefined : Number(couplePrice),
        sweetboxPrice: sweetboxPrice === '' ? undefined : Number(sweetboxPrice),
        deluxePrice: deluxePrice === '' ? undefined : Number(deluxePrice),
        weekdays: weekdaysArr,
        slotMode,
        fixedTimes: slotMode === 'TEMPLATES' ? parsedFixedTimes.times : undefined,
        format,
        languageMode,
        asDraft: asDraft || undefined,
      },
      { onSuccess: resp => setResult(resp.data) },
    )
  }

  function toggleWeekday(iso: number) {
    setSelectedWeekdays(prev => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  function reset() {
    setResult(null)
    setMovieId(null)
    setSelectedRoomIds([])
    setSelectedWeekdays(new Set([1, 2, 3, 4, 5, 6, 7]))
    setSlotMode('WINDOW')
    setFixedTimes(['10:00', '13:00', '16:00', '19:00', '22:00'])
    setCustomTimeDraft('')
    setFormat('TWO_D')
    setLanguageMode('SUB_VI')
    setAsDraft(false)
  }

  function handleClose() {
    if (mut.isPending) return
    onOpenChange(false)
    setTimeout(reset, 200)
  }

  // ====== RESULT PHASE ======
  if (result) {
    const skippedItems = result.details.filter(d => d.status === 'SKIPPED')
    const createdItems = result.details.filter(d => d.status === 'CREATED')
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent size="2xl" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-amber-50 flex items-center gap-2">
              <Sparkles size={18} className="text-[#ffc107]" />
              Kết quả Auto-schedule
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4">
                  <div className="text-3xl font-bold text-green-400 leading-none mb-1">{result.created}</div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider">Đã tạo</div>
                </div>
                <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-4">
                  <div className="text-3xl font-bold text-orange-400 leading-none mb-1">{result.skipped}</div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider">Đã skip</div>
                </div>
              </div>

              {skippedItems.length > 0 && (
                <details className="rounded-xl border border-[#3f382d] bg-[#2a2317] overflow-hidden">
                  <summary className="cursor-pointer text-sm text-gray-300 px-4 py-3 hover:bg-white/[0.03]">
                    Chi tiết các suất đã bị bỏ qua ({skippedItems.length})
                  </summary>
                  <div className="max-h-60 overflow-y-auto px-4 pb-4 space-y-1 text-xs border-t border-[#3f382d] pt-2">
                    {skippedItems.slice(0, 50).map((d, i) => (
                      <div key={i} className="flex justify-between gap-3 py-1 border-b border-white/5 last:border-0">
                        <span className="text-gray-400 font-mono">{d.roomName} · {fmtDateTime(d.startTime)}</span>
                        <span className="text-orange-300/80">{d.reason}</span>
                      </div>
                    ))}
                    {skippedItems.length > 50 && (
                      <div className="text-gray-500 text-center pt-2">+ {skippedItems.length - 50} mục khác</div>
                    )}
                  </div>
                </details>
              )}

              {createdItems.length > 0 && createdItems.length <= 30 && (
                <details className="rounded-xl border border-[#3f382d] bg-[#2a2317] overflow-hidden">
                  <summary className="cursor-pointer text-sm text-gray-300 px-4 py-3 hover:bg-white/[0.03]">
                    Suất đã tạo ({createdItems.length})
                  </summary>
                  <div className="max-h-60 overflow-y-auto px-4 pb-4 space-y-1 text-xs border-t border-[#3f382d] pt-2">
                    {createdItems.map((d, i) => (
                      <div key={i} className="text-gray-400 font-mono py-1 border-b border-white/5 last:border-0">
                        {d.roomName} · {fmtDateTime(d.startTime)}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={reset}
              className="border-white/10 text-gray-300 hover:bg-white/5 rounded-lg">
              Tạo tiếp
            </Button>
            <Button onClick={handleClose}
              className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ====== FORM PHASE ======
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="2xl" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-amber-50 flex items-center gap-2">
            <Sparkles size={18} className="text-[#ffc107]" />
            Tạo lịch chiếu hàng loạt
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-5">
            {/* SECTION 1 — Phim & Chi nhánh */}
            <Section icon={<Film size={14} />} title="Phim & Chi nhánh">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phim chiếu" required>
                  <select className={SELECT_CLS}
                    value={movieId ?? ''}
                    onChange={e => setMovieId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">— Chọn phim —</option>
                    {movies.map(m => (
                      <option key={m.id} value={m.id}>{m.title} ({m.duration} phút)</option>
                    ))}
                  </select>
                </Field>
                <Field label="Chi nhánh" required>
                  <select className={SELECT_CLS}
                    value={effectiveTheaterId ?? ''}
                    disabled={theaterLocked}
                    onChange={e => {
                      setTheaterId(e.target.value ? Number(e.target.value) : null)
                      // Cascade reset: đổi CN → list phim eligible khác → reset
                      // movieId + rooms để tránh state stale ngoài dropdown mới.
                      setMovieId(null)
                      setSelectedRoomIds([])
                    }}>
                    <option value="">— Chọn chi nhánh —</option>
                    {theaters.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>

            {/* SECTION 2 — Phòng chiếu (multi-select pattern giống Genre picker) */}
            <Section
              icon={<MapPin size={14} />}
              title="Phòng chiếu"
              right={
                rooms.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500">
                      {selectedRoomIds.length}/{rooms.length} phòng
                    </span>
                    <button type="button" onClick={toggleAllRooms}
                      className="text-[11px] text-[#ffc107] hover:underline font-medium">
                      {selectedRoomIds.length === rooms.length ? 'Bỏ chọn' : 'Chọn tất cả'}
                    </button>
                  </div>
                )
              }>
              {rooms.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-500 rounded-md border border-white/10 bg-[#2a2317]">
                  {effectiveTheaterId ? 'Chi nhánh chưa có phòng' : 'Chọn chi nhánh trước'}
                </div>
              ) : (
                <MultiSelect
                  options={rooms.map(r => ({ value: r.id, label: r.name }))}
                  selected={selectedRoomIds}
                  onChange={setSelectedRoomIds}
                  placeholder="Tìm phòng và bấm để thêm..."
                />
              )}
            </Section>

            {/* SECTION 3 — Khoảng ngày */}
            <Section icon={<CalendarRange size={14} />} title="Khoảng ngày">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6">
                  <Field label="Từ ngày">
                    <Input type="date" min={today} value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)} />
                  </Field>
                </div>
                <div className="col-span-6">
                  <Field label="Đến ngày" hint={`tối đa ${MAX_RANGE_DAYS} ngày`}>
                    <Input type="date" min={dateFrom || today} value={dateTo}
                      onChange={e => setDateTo(e.target.value)} />
                  </Field>
                </div>
              </div>

              {/* Coverage warning — báo TRƯỚC submit nếu vượt MovieRun period,
                  tránh để admin submit rồi mới biết X ngày bị skip im lặng. */}
              {movieId && effectiveTheaterId && runCoverage.uncoveredDays > 0 && (
                <div className="mt-3 rounded-md border border-orange-500/30 bg-orange-500/[0.06]
                  px-3 py-2.5 flex items-start gap-2 text-xs text-gray-300">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-orange-400" />
                  <div>
                    {runCoverage.runs.length === 0 ? (
                      <span>
                        Phim chưa có đợt chiếu nào tại chi nhánh này — cả{' '}
                        <span className="text-orange-300 font-semibold">{daysCovered} ngày</span>{' '}
                        sẽ không tạo được suất. Tạo đợt chiếu trước qua menu "Đợt chiếu".
                      </span>
                    ) : (
                      <span>
                        <span className="text-orange-300 font-semibold">{runCoverage.uncoveredDays} ngày</span>{' '}
                        nằm ngoài đợt chiếu — sẽ không tạo suất cho các ngày này. Phim chỉ được chiếu trong:{' '}
                        {runCoverage.runs.map((r, i) => (
                          <span key={i} className="font-mono text-gray-200">
                            [{fmtDate(r.startDate)} → {r.endDate ? fmtDate(r.endDate) : 'chưa giới hạn'}]
                            {i < runCoverage.runs.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Section>

            {/* SECTION 3b — Ngày trong tuần */}
            <Section
              icon={<CalendarRange size={14} />}
              title="Ngày trong tuần"
              right={
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">{selectedWeekdays.size}/7</span>
                  <button type="button"
                    onClick={() => setSelectedWeekdays(
                      new Set(selectedWeekdays.size === 7 ? [] : [1, 2, 3, 4, 5, 6, 7]),
                    )}
                    className="text-[11px] text-[#ffc107] hover:underline font-medium">
                    {selectedWeekdays.size === 7 ? 'Bỏ chọn' : 'Chọn tất cả'}
                  </button>
                  <span className="text-gray-600">·</span>
                  <button type="button"
                    onClick={() => setSelectedWeekdays(new Set([6, 7]))}
                    className="text-[11px] text-[#ffc107] hover:underline font-medium">
                    Chỉ T7+CN
                  </button>
                </div>
              }>
              <div className="grid grid-cols-7 gap-2">
                {WEEKDAY_LABELS.map((label, idx) => {
                  const iso = idx + 1 // 1=Mon..7=Sun
                  const active = selectedWeekdays.has(iso)
                  return (
                    <button key={iso} type="button"
                      onClick={() => toggleWeekday(iso)}
                      className={
                        'h-10 rounded-md border text-sm font-semibold transition-colors ' +
                        (active
                          ? 'bg-[#ffc107]/10 border-[#ffc107]/50 text-[#ffc107]'
                          : 'bg-[#2a2317] border-white/10 text-gray-400 hover:bg-white/[0.03]')
                      }>
                      {label}
                    </button>
                  )
                })}
              </div>
            </Section>

            {/* SECTION 3c — Chế độ sắp xếp giờ */}
            <Section icon={<Repeat size={14} />} title="Chế độ sắp xếp giờ chiếu">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button type="button"
                  onClick={() => setSlotMode('WINDOW')}
                  className={
                    'rounded-md border px-3 py-2.5 text-left transition-colors ' +
                    (slotMode === 'WINDOW'
                      ? 'bg-[#ffc107]/10 border-[#ffc107]/50 text-[#ffc107]'
                      : 'bg-[#2a2317] border-white/10 text-gray-300 hover:bg-white/[0.03]')
                  }>
                  <div className="text-sm font-semibold">Tự động trong khung giờ</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Rải liên tiếp [giờ mở → giờ đóng] theo thời lượng phim
                  </div>
                </button>
                <button type="button"
                  onClick={() => setSlotMode('TEMPLATES')}
                  className={
                    'rounded-md border px-3 py-2.5 text-left transition-colors ' +
                    (slotMode === 'TEMPLATES'
                      ? 'bg-[#ffc107]/10 border-[#ffc107]/50 text-[#ffc107]'
                      : 'bg-[#2a2317] border-white/10 text-gray-300 hover:bg-white/[0.03]')
                  }>
                  <div className="text-sm font-semibold">Giờ cố định</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Chỉ tạo vào các khung giờ admin chỉ định
                  </div>
                </button>
              </div>

              {slotMode === 'WINDOW' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Giờ mở cửa" hint="vd 08:00 — bắt đầu rải suất từ giờ này">
                    <Input type="time" step={1800}
                      value={`${String(startHour).padStart(2, '0')}:00`}
                      onChange={e => {
                        const h = Number(e.target.value.split(':')[0])
                        if (h >= 0 && h <= 23) setStartHour(h)
                      }}
                      className="[color-scheme:dark]"
                      style={{ colorScheme: 'dark' }} />
                  </Field>
                  <Field label="Giờ đóng cửa" hint="vd 23:00 — không tạo suất sau giờ này">
                    <Input type="time" step={1800}
                      value={`${String(Math.min(endHour, 23)).padStart(2, '0')}:00`}
                      onChange={e => {
                        const h = Number(e.target.value.split(':')[0])
                        if (h >= 1 && h <= 23) setEndHour(h)
                        else if (h === 0) setEndHour(24)
                      }}
                      className="[color-scheme:dark]"
                      style={{ colorScheme: 'dark' }} />
                  </Field>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Khung giờ phổ biến — click toggle add/remove */}
                  <div>
                    <Label className="text-xs text-gray-400 mb-1.5 block">
                      Khung giờ phổ biến <span className="text-gray-600 font-normal ml-1">(click để bật/tắt)</span>
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_FIXED_TIMES.map(t => {
                        const active = fixedTimes.includes(t)
                        return (
                          <button key={t} type="button"
                            onClick={() => toggleFixedTime(t)}
                            className={
                              'px-2.5 py-1 rounded-md text-xs font-mono font-semibold border transition-colors ' +
                              (active
                                ? 'bg-[#ffc107]/15 text-[#ffc107] border-[#ffc107]/50'
                                : 'bg-[#2a2317] text-gray-400 border-white/10 hover:bg-white/[0.03] hover:text-gray-200')
                            }>
                            {t}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Thêm giờ tuỳ ý */}
                  <div>
                    <Label className="text-xs text-gray-400 mb-1.5 block">Thêm giờ tuỳ ý</Label>
                    <div className="flex items-center gap-2">
                      <Input type="time"
                        value={customTimeDraft}
                        onChange={e => setCustomTimeDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); handleAddCustom() }
                        }}
                        className="w-32 [color-scheme:dark]"
                        style={{ colorScheme: 'dark' }} />
                      <Button type="button" size="sm" onClick={handleAddCustom}
                        disabled={!customTimeDraft || fixedTimes.includes(customTimeDraft)}
                        variant="outline"
                        className="border-[#ffc107]/40 text-[#ffc107] hover:bg-[#ffc107]/10 hover:text-[#ffc107]">
                        + Thêm
                      </Button>
                      {customTimeDraft && fixedTimes.includes(customTimeDraft) && (
                        <span className="text-[11px] text-orange-400">Đã có giờ này</span>
                      )}
                    </div>
                  </div>

                  {/* Danh sách giờ đã chọn — chip removable, sort ASC */}
                  <div>
                    <Label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-2">
                      Giờ chiếu mỗi ngày
                      <span className="text-gray-600 font-normal">({fixedTimes.length} suất)</span>
                      {fixedTimes.length > 0 && (
                        <button type="button" onClick={() => setFixedTimes([])}
                          className="ml-auto text-[11px] text-gray-500 hover:text-red-400 hover:underline font-normal">
                          Xoá hết
                        </button>
                      )}
                    </Label>
                    {fixedTimes.length === 0 ? (
                      <div className="rounded-md border border-dashed border-white/10 bg-[#2a2317]/30 px-3 py-3 text-xs text-gray-500 text-center">
                        Chưa chọn giờ nào — click khung giờ phổ biến hoặc thêm giờ tuỳ ý ở trên.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {fixedTimes.map(t => (
                          <span key={t}
                            className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-xs font-mono font-semibold
                              bg-[#ffc107]/15 text-[#ffc107] border border-[#ffc107]/50">
                            {t}
                            <button type="button" onClick={() => removeFixedTime(t)}
                              className="ml-0.5 w-4 h-4 rounded-sm hover:bg-[#ffc107]/30 inline-flex items-center justify-center"
                              title={`Bỏ giờ ${t}`}>
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500 px-1">
                <Clock size={11} />
                <span>
                  Mỗi suất tự cộng thêm <span className="text-gray-300">{BUFFER_MINUTES} phút</span> dọn phòng.
                  Đổi giá trị này ở <span className="text-gray-300">Cấu hình hệ thống</span>.
                </span>
              </div>
            </Section>

            {/* SECTION 4 — Bảng giá (dynamic theo seat types các phòng đã chọn) */}
            <Section
              icon={<Wallet size={14} />}
              title="Bảng giá"
              right={
                selectedRoomIds.length > 0 && (
                  <span className="text-[11px] text-gray-500">
                    {seatTypesLoading
                      ? 'Đang phân tích loại ghế…'
                      : `Loại ghế trong phòng: ${describeTypes(presentSeatTypes)}`}
                  </span>
                )
              }>
              <div className="grid grid-cols-2 gap-3">
                {/* Giá thường — luôn bắt buộc vì mọi phòng đều có STANDARD */}
                <div className="col-span-2">
                  <Field label="Giá thường" required>
                    <Input type="number" min={0} value={basePrice}
                      onChange={e => setBasePrice(Number(e.target.value))} />
                  </Field>
                </div>

                {hasVIP && (
                  <Field label="Giá VIP" required>
                    <Input type="number" min={0} value={vipPrice}
                      onChange={e => setVipPrice(e.target.value === '' ? '' : Number(e.target.value))} />
                  </Field>
                )}
                {hasCouple && (
                  <Field label="Giá ghế đôi" required>
                    <Input type="number" min={0} value={couplePrice}
                      onChange={e => setCouplePrice(e.target.value === '' ? '' : Number(e.target.value))} />
                  </Field>
                )}
                {hasSweetbox && (
                  <Field label="Giá Sweetbox" required>
                    <Input type="number" min={0} value={sweetboxPrice}
                      onChange={e => setSweetboxPrice(e.target.value === '' ? '' : Number(e.target.value))} />
                  </Field>
                )}
                {hasDeluxe && (
                  <Field label="Giá Deluxe" required>
                    <Input type="number" min={0} value={deluxePrice}
                      onChange={e => setDeluxePrice(e.target.value === '' ? '' : Number(e.target.value))} />
                  </Field>
                )}
              </div>

              <div className="mt-3 flex items-start gap-2 text-[11px] text-gray-500 px-1">
                <Info size={11} className="mt-0.5 shrink-0" />
                <span>
                  Mỗi phòng chỉ apply giá cho các loại ghế có thật trong phòng đó.
                  Ví dụ phòng A có đủ 5 loại → dùng cả 5 giá; phòng B chỉ có Thường + VIP
                  → BE chỉ áp 2 giá tương ứng.
                </span>
              </div>
            </Section>

            {/* SECTION 5 — Định dạng + ngôn ngữ + workflow publish */}
            <Section icon={<Film size={14} />} title="Định dạng & ngôn ngữ">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Định dạng chiếu" required>
                  <select className={SELECT_CLS} value={format}
                    onChange={e => setFormat(e.target.value as ShowtimeFormat)}>
                    {(Object.keys(SHOWTIME_FORMAT_LABELS) as ShowtimeFormat[]).map(k => (
                      <option key={k} value={k}>{SHOWTIME_FORMAT_LABELS[k]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Ngôn ngữ" required>
                  <select className={SELECT_CLS} value={languageMode}
                    onChange={e => setLanguageMode(e.target.value as ShowtimeLanguageMode)}>
                    {(Object.keys(SHOWTIME_LANGUAGE_LABELS) as ShowtimeLanguageMode[]).map(k => (
                      <option key={k} value={k}>{SHOWTIME_LANGUAGE_LABELS[k]}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-3 flex items-start gap-3 px-3 py-2.5 rounded-md border border-white/10 bg-[#2a2317]">
                <Switch checked={asDraft} onChange={setAsDraft} />
                <div className="flex-1 -mt-0.5">
                  <div className="text-sm text-white font-medium">
                    Tạo dưới dạng <span className="text-amber-400">Nháp</span>
                    {asDraft && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 font-semibold uppercase">đang bật</span>}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Suất nháp KHÔNG hiện cho khách. Admin review/sửa, rồi bấm
                    nút <span className="text-[#ffc107] font-medium">Đăng</span> ở cột Trạng thái
                    (hoặc chọn nhiều suất và dùng menu "Lưu trữ → Đăng suất nháp") để đẩy lên lịch chính.
                  </div>
                </div>
              </div>
            </Section>

            {/* PREVIEW */}
            {previewCount > 0 && (
              <div className="rounded-xl bg-[#ffc107]/10 border border-[#ffc107]/30 p-4 flex items-start gap-3">
                <Tag size={16} className="text-[#ffc107] mt-0.5 shrink-0" />
                <div className="flex-1 text-sm">
                  <div className="text-[#ffc107] font-semibold">
                    Ước lượng tạo ~{previewCount} suất chiếu
                    {conflictPreview.conflicts > 0 && (
                      <span className="text-orange-300/90 font-normal text-xs ml-2">
                        (trừ ~{conflictPreview.conflicts} bị trùng → còn {Math.max(0, previewCount - conflictPreview.conflicts)})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Hệ thống tự bỏ qua các khung giờ trùng suất đã có, khung giờ đã qua, hoặc ngoài đợt chiếu phim.
                    Giá vé: <span className={SEAT_TYPE_PRICE_TEXT.STANDARD}>{fmtVnd(basePrice)}</span> /thường
                    {vipPrice !== '' && <> · <span className={SEAT_TYPE_PRICE_TEXT.VIP}>{fmtVnd(Number(vipPrice))}</span> /VIP</>}
                    {couplePrice !== '' && <> · <span className={SEAT_TYPE_PRICE_TEXT.COUPLE}>{fmtVnd(Number(couplePrice))}</span> /đôi</>}
                    {sweetboxPrice !== '' && <> · <span className={SEAT_TYPE_PRICE_TEXT.SWEETBOX}>{fmtVnd(Number(sweetboxPrice))}</span> /sweetbox</>}
                    {deluxePrice !== '' && <> · <span className={SEAT_TYPE_PRICE_TEXT.DELUXE}>{fmtVnd(Number(deluxePrice))}</span> /deluxe</>}
                  </div>
                </div>
              </div>
            )}

            {/* CONFLICT PREVIEW — báo TRƯỚC submit nếu có slot trùng giờ với
                suất hiện có. Tránh trải nghiệm "ấn tạo xong mới biết X bị skip". */}
            {previewCount > 0 && conflictPreview.conflicts > 0 && (
              <div className="rounded-md border border-orange-500/30 bg-orange-500/[0.06]
                px-3 py-2.5 flex items-start gap-2 text-xs text-gray-300">
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-orange-400" />
                <span>
                  <span className="text-orange-300 font-semibold">~{conflictPreview.conflicts} suất</span>{' '}
                  trên tổng <span className="text-amber-50">{conflictPreview.proposed}</span>{' '}
                  dự kiến sẽ trùng giờ với các suất đã có ở phòng tương ứng → hệ thống sẽ bỏ qua.
                  Nếu muốn tạo hết: đổi khung giờ, đổi phòng, hoặc xoá bớt suất cũ trước.
                </span>
              </div>
            )}

            {!canSubmit && (
              <div className="rounded-md border border-red-500/20 bg-red-500/[0.04] px-3 py-2.5 flex items-start gap-2 text-xs">
                <Info size={12} className="mt-0.5 shrink-0 text-red-400" />
                <div className="space-y-1 text-gray-300">
                  {(!movieId || !effectiveTheaterId || selectedRoomIds.length === 0) && (
                    <div>• Chọn đủ phim + chi nhánh + ít nhất 1 phòng để tiếp tục.</div>
                  )}
                  {seatTypesLoading && <div>• Đang phân tích loại ghế của các phòng…</div>}
                  {formIssues.map((msg, i) => <div key={`f${i}`}>• {msg}</div>)}
                  {missingPrices.length > 0 && (
                    <div>• Cần nhập giá cho: {missingPrices.join(', ')}.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}
            className="border-white/10 text-gray-300 hover:bg-white/5 rounded-lg">
            Hủy
          </Button>
          <Button onClick={submit}
            disabled={mut.isPending || !canSubmit}
            className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold disabled:bg-gray-700 disabled:text-gray-400 rounded-lg">
            {mut.isPending ? (
              <><Loader2 size={14} className="mr-1.5 animate-spin" /> Đang tạo…</>
            ) : (
              <><Sparkles size={14} className="mr-1.5" /> Tạo {previewCount > 0 ? `~${previewCount} suất` : 'lịch chiếu'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Section header consistent across all form blocks. */
function Section({ icon, title, right, children }: {
  icon: React.ReactNode
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
          <span className="text-[#ffc107]">{icon}</span>
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function Field({ label, required, hint, children }: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label className="text-xs text-gray-400 mb-1.5 block">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="text-gray-600 font-normal ml-1">({hint})</span>}
      </Label>
      {children}
    </div>
  )
}

// Khung giờ phổ biến rạp VN — sáng / trưa / chiều / tối / khuya. Admin click
// để bật/tắt nhanh; có thể thêm giờ tuỳ ý bằng time picker bên dưới.
const COMMON_FIXED_TIMES = [
  '09:30', '10:00', '11:30', '13:00', '14:30',
  '16:00', '17:30', '19:00', '20:30', '22:00',
] as const

// ISO weekday labels (1=Mon..7=Sun). Khớp ChronoUnit BE và locale rạp VN.
const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const

const SEAT_TYPE_LABEL: Record<SeatType, string> = {
  STANDARD: 'Thường', VIP: 'VIP', COUPLE: 'Đôi',
  SWEETBOX: 'Sweetbox', DELUXE: 'Deluxe', HANDICAP: 'Khuyết tật',
}

function describeTypes(set: Set<SeatType>): string {
  // STANDARD luôn có nên không show; HANDICAP không có pricing tier riêng.
  const order: SeatType[] = ['VIP', 'COUPLE', 'SWEETBOX', 'DELUXE']
  const labels = order.filter(t => set.has(t)).map(t => SEAT_TYPE_LABEL[t])
  if (labels.length === 0) return 'chỉ Thường'
  return `Thường + ${labels.join(' + ')}`
}
