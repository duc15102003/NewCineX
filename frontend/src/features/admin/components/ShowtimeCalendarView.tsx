import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, DoorOpen } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAdminShowtimes, type AdminShowtime, type AdminShowtimeParams } from '@/hooks/useAdminShowtimes'
import { useAdminRooms } from '@/hooks/useAdminRooms'
import { OPTIONS_DROPDOWN_PAGE_SIZE } from '@/utils/constants'
import { fmtVnd, fmtTime, ROOM_TYPE_LABELS, label } from '@/utils/labels'
import { ROOM_TYPE_TONE } from '@/utils/colors'

interface Props {
  scopedTheaterId: number | null
  onCreateAt: (roomId: number, startTime: string) => void
  onEdit: (showtimeId: number) => void
  /**
   * Filter từ drawer áp dụng song song với ngày của calendar. Đã loại bỏ các
   * field date (startDate / startTimeFrom / startTimeTo) ở parent — calendar
   * tự quản ngày qua selectedDate, các field date trong drawer bị disable.
   */
  extraQuery?: Partial<AdminShowtimeParams>
  activeFilterCount?: number
  /**
   * Ngày từ filter drawer (yyyy-MM-dd). Khi parent set → calendar nhảy ngay
   * tới ngày đó. Cho phép user dùng filter để chọn ngày bất kỳ thay vì click
   * mũi tên / date picker trên navigator.
   */
  filterStartDate?: string
}

/**
 * Resource scheduler — rows = phòng, cols = time 8h-24h, block positioned theo
 * (room, startTime, duration). Click block → edit. Click ô trống → tạo pre-filled.
 *
 * <p>Lane allocation chạy ngầm như safety net: nếu lỡ data có suất overlap thì
 * sẽ stack vào sub-row thay vì đè lên nhau. Validation thật phải nằm ở BE
 * (ShowtimeService.findConflictingShowtimes + UNIQUE INDEX migration 024) +
 * không trông cậy vào admin phát hiện.
 */
export default function ShowtimeCalendarView({ scopedTheaterId, onCreateAt, onEdit, extraQuery, activeFilterCount = 0, filterStartDate }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [selectedDate, setSelectedDate] = useState<Date>(today)

  // Sync ngày từ filter drawer xuống calendar. Filter là "source of truth"
  // khi user explicitly apply — nhảy ngay tới ngày đó.
  useEffect(() => {
    if (!filterStartDate) return
    const [y, m, d] = filterStartDate.split('-').map(Number)
    if (!y || !m || !d) return
    setSelectedDate(new Date(y, m - 1, d, 0, 0, 0, 0))
  }, [filterStartDate])

  // Tokens — match CineX design system "Dark Brown + Warm Gold"
  const START_HOUR = 8
  const END_HOUR = 24
  const PX_PER_MIN = 3.5            // 30 phút = 105px → đọc thoải mái title 15+ ký tự
  const LANE_HEIGHT = 30
  const MIN_BLOCK_WIDTH = 70
  const ROOM_COL_WIDTH = 150
  const SLOT_MIN = 30
  const HOUR_HEADER_HEIGHT = 32

  const totalMinutes = (END_HOUR - START_HOUR) * 60
  const totalPx = totalMinutes * PX_PER_MIN

  const { data: roomsData } = useAdminRooms({
    size: OPTIONS_DROPDOWN_PAGE_SIZE,
    theaterId: scopedTheaterId ?? undefined,
  })
  const rooms = roomsData?.content ?? []

  const dayStart = new Date(selectedDate); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(selectedDate); dayEnd.setHours(23, 59, 59, 999)

  const { data: showtimePage } = useAdminShowtimes({
    ...(extraQuery ?? {}),
    theaterId: scopedTheaterId ?? undefined,
    startTimeFrom: toIsoDateTime(dayStart),
    startTimeTo: toIsoDateTime(dayEnd),
    size: 500,
  })
  const showtimes = showtimePage?.content ?? []

  // Greedy interval scheduling — silent fallback nếu lỡ có overlap.
  const byRoom = useMemo(() => {
    const m = new Map<string, LaneShowtime[]>()
    const grouped = new Map<string, AdminShowtime[]>()
    showtimes.forEach(s => {
      if (!grouped.has(s.roomName)) grouped.set(s.roomName, [])
      grouped.get(s.roomName)!.push(s)
    })
    grouped.forEach((items, roomName) => {
      const sorted = [...items].sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))
      const laneEndTimes: number[] = []
      const withLanes: LaneShowtime[] = sorted.map(st => {
        const startMs = +new Date(st.startTime)
        const endMs = +new Date(st.endTime)
        let lane = laneEndTimes.findIndex(end => end <= startMs)
        if (lane === -1) {
          lane = laneEndTimes.length
          laneEndTimes.push(endMs)
        } else {
          laneEndTimes[lane] = endMs
        }
        return { ...st, lane, maxLane: 0 }
      })
      const maxLane = laneEndTimes.length
      withLanes.forEach(s => { s.maxLane = maxLane })
      m.set(roomName, withLanes)
    })
    return m
  }, [showtimes])

  function shiftDay(deltaDays: number) {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + deltaDays)
    setSelectedDate(next)
  }
  function goToday() {
    const t = new Date(); t.setHours(0, 0, 0, 0)
    setSelectedDate(t)
  }
  function onPickDate(yyyyMmDd: string) {
    if (!yyyyMmDd) return
    const [y, m, d] = yyyyMmDd.split('-').map(Number)
    const next = new Date(y, m - 1, d, 0, 0, 0, 0)
    setSelectedDate(next)
  }

  function timeToPx(timeStr: string): number {
    const d = new Date(timeStr)
    const minutesFromStart = (d.getHours() - START_HOUR) * 60 + d.getMinutes()
    return Math.max(0, Math.min(totalPx, minutesFromStart * PX_PER_MIN))
  }

  function handleEmptyClick(roomId: number, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetPx = e.clientX - rect.left
    const minutesFromStart = Math.floor(offsetPx / PX_PER_MIN)
    const roundedMin = Math.floor(minutesFromStart / SLOT_MIN) * SLOT_MIN
    const hour = START_HOUR + Math.floor(roundedMin / 60)
    const minute = roundedMin % 60
    const dt = new Date(selectedDate)
    dt.setHours(hour, minute, 0, 0)
    onCreateAt(roomId, toIsoDateTime(dt))
  }

  if (!scopedTheaterId) {
    return (
      <div className="rounded-2xl border border-[#3f382d] bg-[#201b11] p-10 text-center">
        <CalendarIcon size={32} className="text-gray-500 mx-auto mb-3" />
        <p className="text-gray-300 mb-1">Calendar cần xem theo từng chi nhánh</p>
        <p className="text-sm text-gray-500">Chọn 1 chi nhánh ở thanh trên cùng để xem calendar.</p>
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="rounded-2xl border border-[#3f382d] bg-[#201b11] p-10 text-center">
        <p className="text-gray-300">Chi nhánh chưa có phòng chiếu nào.</p>
      </div>
    )
  }

  const tickCount = Math.ceil(totalMinutes / SLOT_MIN)
  const isToday = isSameDay(selectedDate, new Date())
  const nowOffsetPx = (() => {
    if (!isToday) return null
    const now = new Date()
    const minutesFromStart = (now.getHours() - START_HOUR) * 60 + now.getMinutes()
    if (minutesFromStart < 0 || minutesFromStart > totalMinutes) return null
    return minutesFromStart * PX_PER_MIN
  })()

  return (
    <div className="space-y-3">
      {/* Day navigator — đồng bộ với button style admin pages */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#2a2317] p-1">
          <Button variant="ghost" size="sm" onClick={() => shiftDay(-1)}
            className="h-7 w-7 p-0 text-gray-300 hover:bg-white/5 hover:text-white"
            title="Ngày trước">
            <ChevronLeft size={14} />
          </Button>
          {/* Date input visible — click thẳng vào sẽ mở native picker, onChange
              fire khi user chọn ngày. color-scheme:dark cho icon picker hợp tone
              tối. Style để trông như label, full-width clickable. */}
          <div className="inline-flex items-center gap-1.5 min-w-[180px] h-7 px-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer relative">
            <CalendarIcon size={12} className="text-[#ffc107]/80 shrink-0 pointer-events-none" />
            <input type="date"
              value={toIsoDate(selectedDate)}
              onChange={(e) => onPickDate(e.target.value)}
              className="bg-transparent border-0 outline-none text-xs text-amber-50 font-semibold cursor-pointer w-full px-0 py-0 [color-scheme:dark] focus:ring-0"
              style={{ colorScheme: 'dark' }}
              aria-label="Chọn ngày" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => shiftDay(1)}
            className="h-7 w-7 p-0 text-gray-300 hover:bg-white/5 hover:text-white"
            title="Ngày sau">
            <ChevronRight size={14} />
          </Button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <Button variant="ghost" size="sm" onClick={goToday}
            className="h-7 px-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white">
            Hôm nay
          </Button>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
          <span><span className="text-amber-50 font-medium">{showtimes.length}</span> suất chiếu</span>
          {activeFilterCount > 0 && (
            <>
              <span className="text-gray-600">·</span>
              <span className="text-[#ffc107]/90">Bộ lọc đang áp dụng ({activeFilterCount})</span>
            </>
          )}
          <span className="text-gray-600">·</span>
          <span>Click block để sửa · Click ô trống để tạo</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl border border-[#3f382d] bg-[#201b11] overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: ROOM_COL_WIDTH + totalPx + 16 }}>
            {/* Hour header */}
            <div className="flex border-b border-[#3f382d] bg-[#2a2317]">
              <div className="shrink-0 px-4 flex items-center text-[11px] uppercase tracking-wider text-gray-500 font-semibold border-r border-[#3f382d]"
                style={{ width: ROOM_COL_WIDTH, height: HOUR_HEADER_HEIGHT }}>
                Phòng
              </div>
              <div className="relative" style={{ width: totalPx, height: HOUR_HEADER_HEIGHT }}>
                {/* Alternating hour bands for easier scanning */}
                {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                  <div key={`band-${i}`}
                    className={i % 2 === 0 ? 'absolute inset-y-0 bg-white/[0.015]' : 'absolute inset-y-0'}
                    style={{ left: i * 60 * PX_PER_MIN, width: 60 * PX_PER_MIN }} />
                ))}
                {Array.from({ length: (END_HOUR - START_HOUR) + 1 }).map((_, i) => (
                  <div key={i}
                    className="absolute top-1/2 -translate-y-1/2 text-[11px] text-gray-400 font-mono"
                    style={{ left: i * 60 * PX_PER_MIN + 6 }}>
                    {String(START_HOUR + i).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            {rooms.map((room, rowIdx) => {
              const items = byRoom.get(room.name) ?? []
              const maxLanes = items[0]?.maxLane ?? 1
              const rowHeight = maxLanes * LANE_HEIGHT + 10
              return (
                <div key={room.id}
                  className={`flex border-b border-[#3f382d] last:border-b-0 transition-colors
                    ${rowIdx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.01]'}
                    hover:bg-white/[0.025]`}>
                  {/* Room label */}
                  <div className="shrink-0 px-4 border-r border-[#3f382d] flex flex-col gap-0.5 justify-center"
                    style={{ width: ROOM_COL_WIDTH, minHeight: rowHeight }}>
                    <span className="text-sm text-white font-medium flex items-center gap-1.5">
                      <DoorOpen size={12} className="text-[#ffc107] shrink-0" />
                      <span className="truncate">{room.name}</span>
                    </span>
                    <span className="text-[10px] text-gray-500 truncate ml-[18px]">
                      {label(ROOM_TYPE_LABELS, room.type)} · {room.totalSeats} ghế
                    </span>
                  </div>

                  {/* Timeline */}
                  <div className="relative cursor-cell group/row"
                    style={{ width: totalPx, height: rowHeight }}
                    onClick={(e) => handleEmptyClick(room.id, e)}>
                    {/* Alternating hour bands */}
                    {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                      <div key={`band-${i}`}
                        className={i % 2 === 0 ? 'absolute inset-y-0 bg-white/[0.015]' : 'absolute inset-y-0'}
                        style={{ left: i * 60 * PX_PER_MIN, width: 60 * PX_PER_MIN }} />
                    ))}
                    {/* Gridlines */}
                    {Array.from({ length: tickCount + 1 }).map((_, i) => (
                      <div key={i}
                        className={`absolute top-0 bottom-0 ${
                          i % 2 === 0 ? 'border-l border-[#3f382d]/60' : 'border-l border-[#3f382d]/15'
                        }`}
                        style={{ left: i * SLOT_MIN * PX_PER_MIN }} />
                    ))}

                    {/* Current time vertical line */}
                    {nowOffsetPx != null && (
                      <div className="absolute top-0 bottom-0 w-px bg-[#ffc107] z-[5] pointer-events-none shadow-[0_0_4px_rgba(255,193,7,0.6)]"
                        style={{ left: nowOffsetPx }} />
                    )}

                    {/* Showtime blocks */}
                    {items.map(s => {
                      const leftPx = timeToPx(s.startTime)
                      const endPx = timeToPx(s.endTime)
                      const widthPx = Math.max(MIN_BLOCK_WIDTH, endPx - leftPx)
                      const isCancelled = s.status === 'CANCELLED'
                      const isArchived = s.storageState === 'ARCHIVED'
                      const isDraft = s.status === 'DRAFT'
                      const tone = ROOM_TYPE_TONE[s.roomType] ?? ROOM_TYPE_TONE.DEFAULT
                      const topPx = 5 + s.lane * LANE_HEIGHT
                      const draftHint = isDraft ? '\n[Nháp — chưa public]' : ''
                      return (
                        <button key={s.id}
                          onClick={(e) => { e.stopPropagation(); onEdit(s.id) }}
                          className={`absolute rounded-md border text-left
                            ${tone.bg} ${tone.border}
                            ${isCancelled || isArchived ? 'opacity-40 line-through' : ''}
                            ${isDraft && !isArchived ? 'border-dashed !border-amber-400/70 ring-1 ring-amber-400/30' : ''}
                            hover:brightness-125 hover:ring-2 hover:ring-[#ffc107]/40 hover:z-10
                            transition-all
                            flex flex-col justify-center px-2 overflow-hidden cursor-pointer
                            shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}
                          style={{
                            left: leftPx,
                            width: widthPx,
                            top: topPx,
                            height: LANE_HEIGHT - 4,
                          }}
                          title={`${s.movieTitle}\n${fmtTime(s.startTime)} → ${fmtTime(s.endTime)}\n${fmtVnd(s.basePrice)}${draftHint}`}>
                          <span className={`text-[11px] font-semibold ${tone.text} truncate leading-tight flex items-center gap-1`}>
                            {isDraft && !isArchived && (
                              <span className="text-[8px] px-1 py-px rounded bg-amber-400/30 text-amber-100 font-bold uppercase tracking-wide leading-none shrink-0">
                                Nháp
                              </span>
                            )}
                            <span className="truncate">{s.movieTitle}</span>
                          </span>
                          {widthPx >= 110 && (
                            <span className="text-[9px] text-white/60 truncate leading-tight font-mono">
                              {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend — đồng bộ với pattern badge của list view */}
      <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
        <span className="text-gray-500">Loại phòng:</span>
        {(Object.keys(ROOM_TYPE_TONE) as Array<keyof typeof ROOM_TYPE_TONE>)
          .filter(k => k !== 'DEFAULT')
          .map(k => (
            <span key={k} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${ROOM_TYPE_TONE[k].bg} ${ROOM_TYPE_TONE[k].border}`}>
              <span className={`text-[10px] font-semibold ${ROOM_TYPE_TONE[k].text}`}>
                {label(ROOM_TYPE_LABELS, k as string)}
              </span>
            </span>
          ))}
        {isToday && nowOffsetPx != null && (
          <span className="inline-flex items-center gap-1.5 ml-1">
            <span className="w-0.5 h-3 bg-[#ffc107] shadow-[0_0_4px_rgba(255,193,7,0.6)]" />
            <span className="text-[10px]">Giờ hiện tại</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 ml-1">
          <span className="w-3 h-2 rounded-sm border border-dashed border-amber-400/80" />
          <span className="text-[10px]">Suất nháp (click để sửa và Đăng)</span>
        </span>
      </div>
    </div>
  )
}

type LaneShowtime = AdminShowtime & { lane: number; maxLane: number }

function toIsoDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}
