import { useMemo, useState } from 'react'
import { Calendar, Loader2, Sparkles } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAutoScheduleShowtimes, type AutoScheduleResult } from '@/hooks/useAdminShowtimes'
import { useAdminMovies, useAdminRooms, useTheaterOptions } from '@/hooks/useAdmin'
import { OPTIONS_DROPDOWN_PAGE_SIZE } from '@/utils/constants'
import { fmtDateTime } from '@/utils/labels'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Khi BRANCH_ADMIN hoặc super admin đã pick CN — lock theater field. */
  scopedTheaterId: number | null
  theaterLocked: boolean
}

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

/**
 * Auto-schedule dialog — tạo nhiều suất chiếu 1 click.
 *
 * <p><b>Pain point user fix:</b> Tạo 175 suất/tuần thủ công từng giờ → 1 click
 * tạo all với form ngắn gọn.
 *
 * <p>UX: 2 phases:
 * 1. Form (movie/rooms/dates/hours/prices)
 * 2. Result preview (created vs skipped với reason)
 */
export default function AutoScheduleDialog({ open, onOpenChange, scopedTheaterId, theaterLocked }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  // Form state
  const [movieId, setMovieId] = useState<number | null>(null)
  const [theaterId, setTheaterId] = useState<number | null>(scopedTheaterId)
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<number>>(new Set())
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [startHour, setStartHour] = useState(8)
  const [endHour, setEndHour] = useState(23)
  const [bufferMinutes, setBufferMinutes] = useState<number>(15)
  const [basePrice, setBasePrice] = useState<number>(80000)
  const [vipPrice, setVipPrice] = useState<number | ''>(120000)
  const [couplePrice, setCouplePrice] = useState<number | ''>(200000)

  // Result state (sau khi submit)
  const [result, setResult] = useState<AutoScheduleResult | null>(null)

  const effectiveTheaterId = theaterLocked ? scopedTheaterId : theaterId

  // Load options scoped theater
  const { data: moviesData } = useAdminMovies({
    size: OPTIONS_DROPDOWN_PAGE_SIZE,
    theaterId: effectiveTheaterId ?? undefined,
  })
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

  // Tính preview số suất sẽ tạo (FE estimate, BE final là authoritative)
  const previewCount = useMemo(() => {
    if (!movieId || !effectiveTheaterId || selectedRoomIds.size === 0) return 0
    const movie = movies.find(m => m.id === movieId)
    if (!movie) return 0
    const slotDuration = movie.duration + (bufferMinutes ?? 15)
    const hoursPerDay = endHour - startHour
    const slotsPerDay = Math.floor((hoursPerDay * 60) / slotDuration)
    const days = Math.max(1, Math.floor((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1)
    return slotsPerDay * selectedRoomIds.size * days
  }, [movieId, effectiveTheaterId, selectedRoomIds, movies, bufferMinutes, startHour, endHour, dateFrom, dateTo])

  function toggleRoom(id: number) {
    setSelectedRoomIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAllRooms() {
    setSelectedRoomIds(prev =>
      prev.size === rooms.length ? new Set() : new Set(rooms.map(r => r.id)),
    )
  }

  function submit() {
    if (!movieId || !effectiveTheaterId || selectedRoomIds.size === 0) return
    mut.mutate(
      {
        movieId,
        theaterId: effectiveTheaterId,
        roomIds: [...selectedRoomIds],
        dateFrom,
        dateTo,
        startHour,
        endHour,
        bufferMinutes,
        basePrice,
        vipPrice: vipPrice === '' ? undefined : Number(vipPrice),
        couplePrice: couplePrice === '' ? undefined : Number(couplePrice),
      },
      {
        onSuccess: resp => setResult(resp.data),
      },
    )
  }

  function reset() {
    setResult(null)
    setMovieId(null)
    setSelectedRoomIds(new Set())
  }

  function handleClose() {
    if (mut.isPending) return
    onOpenChange(false)
    // Delay reset để khỏi flash
    setTimeout(reset, 200)
  }

  // ====== Render result phase ======
  if (result) {
    const createdItems = result.details.filter(d => d.status === 'CREATED')
    const skippedItems = result.details.filter(d => d.status === 'SKIPPED')
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-[#201b11] border-[#3f382d] text-white max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-amber-50">Kết quả Auto-schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-3">
                <div className="text-2xl font-bold text-green-400">{result.created}</div>
                <div className="text-xs text-gray-300">Đã tạo</div>
              </div>
              <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-3">
                <div className="text-2xl font-bold text-orange-400">{result.skipped}</div>
                <div className="text-xs text-gray-300">Đã skip</div>
              </div>
            </div>

            {skippedItems.length > 0 && (
              <details className="rounded-xl border border-[#3f382d] bg-[#2a2317]">
                <summary className="cursor-pointer text-sm text-gray-300 px-3 py-2">
                  Chi tiết skip ({skippedItems.length})
                </summary>
                <div className="max-h-60 overflow-y-auto px-3 pb-3 space-y-1 text-xs">
                  {skippedItems.slice(0, 50).map((d, i) => (
                    <div key={i} className="flex justify-between text-gray-400">
                      <span>{d.roomName} · {fmtDateTime(d.startTime)}</span>
                      <span className="text-orange-300/80">{d.reason}</span>
                    </div>
                  ))}
                  {skippedItems.length > 50 && (
                    <div className="text-gray-500 text-center pt-2">+ {skippedItems.length - 50} mục khác</div>
                  )}
                </div>
              </details>
            )}

            {createdItems.length > 0 && createdItems.length <= 20 && (
              <details className="rounded-xl border border-[#3f382d] bg-[#2a2317]">
                <summary className="cursor-pointer text-sm text-gray-300 px-3 py-2">
                  Suất đã tạo ({createdItems.length})
                </summary>
                <div className="max-h-60 overflow-y-auto px-3 pb-3 space-y-1 text-xs">
                  {createdItems.map((d, i) => (
                    <div key={i} className="text-gray-400">
                      {d.roomName} · {fmtDateTime(d.startTime)}
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={reset}
                className="border-white/10 text-gray-300 hover:bg-white/5">
                Tạo tiếp
              </Button>
              <Button onClick={() => handleClose()}
                className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold">
                Đóng
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // ====== Render form phase ======
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#201b11] border-[#3f382d] text-white max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-amber-50 flex items-center gap-2">
            <Sparkles size={18} className="text-[#ffc107]" />
            Tạo lịch chiếu hàng loạt
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Movie + Theater */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm text-gray-400 mb-1.5 block">Phim</Label>
              <select className={SELECT_CLS}
                value={movieId ?? ''}
                onChange={e => setMovieId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">— Chọn phim —</option>
                {movies.map(m => (
                  <option key={m.id} value={m.id}>{m.title} ({m.duration}p)</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm text-gray-400 mb-1.5 block">Chi nhánh</Label>
              <select className={SELECT_CLS}
                value={effectiveTheaterId ?? ''}
                disabled={theaterLocked}
                onChange={e => {
                  setTheaterId(e.target.value ? Number(e.target.value) : null)
                  setSelectedRoomIds(new Set())
                }}>
                <option value="">— Chọn chi nhánh —</option>
                {theaters.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rooms */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-sm text-gray-400">Phòng chiếu ({selectedRoomIds.size}/{rooms.length})</Label>
              <button type="button" onClick={toggleAllRooms}
                className="text-xs text-[#ffc107] hover:underline">
                {selectedRoomIds.size === rooms.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2 rounded-md border border-white/10 bg-[#2a2317]">
              {rooms.length === 0 ? (
                <span className="text-xs text-gray-500 col-span-3">Chưa chọn chi nhánh</span>
              ) : (
                rooms.map(r => (
                  <label key={r.id} className="flex items-center gap-1.5 text-sm text-gray-200 cursor-pointer">
                    <input type="checkbox"
                      checked={selectedRoomIds.has(r.id)}
                      onChange={() => toggleRoom(r.id)}
                      className="accent-[#ffc107]" />
                    <span>{r.name} <span className="text-gray-500 text-xs">({r.type})</span></span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm text-gray-400 mb-1.5 block">Từ ngày</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm text-gray-400 mb-1.5 block">Đến ngày (tối đa 30 ngày)</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>

          {/* Hours + buffer */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-sm text-gray-400 mb-1.5 block">Giờ bắt đầu (0-23)</Label>
              <Input type="number" min={0} max={23}
                value={startHour}
                onChange={e => setStartHour(Math.max(0, Math.min(23, Number(e.target.value))))} />
            </div>
            <div>
              <Label className="text-sm text-gray-400 mb-1.5 block">Giờ kết thúc (1-24)</Label>
              <Input type="number" min={1} max={24}
                value={endHour}
                onChange={e => setEndHour(Math.max(1, Math.min(24, Number(e.target.value))))} />
            </div>
            <div>
              <Label className="text-sm text-gray-400 mb-1.5 block">Buffer (phút)</Label>
              <Input type="number" min={0} max={120}
                value={bufferMinutes}
                onChange={e => setBufferMinutes(Math.max(0, Math.min(120, Number(e.target.value))))} />
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-sm text-gray-400 mb-1.5 block">Giá thường</Label>
              <Input type="number" min={0}
                value={basePrice}
                onChange={e => setBasePrice(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-sm text-gray-400 mb-1.5 block">Giá VIP</Label>
              <Input type="number" min={0} placeholder="(để trống nếu phòng không có)"
                value={vipPrice}
                onChange={e => setVipPrice(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-sm text-gray-400 mb-1.5 block">Giá đôi</Label>
              <Input type="number" min={0} placeholder="(để trống nếu phòng không có)"
                value={couplePrice}
                onChange={e => setCouplePrice(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
          </div>

          {/* Preview */}
          {previewCount > 0 && (
            <div className="rounded-xl bg-[#ffc107]/10 border border-[#ffc107]/30 p-3 text-sm">
              <div className="flex items-center gap-2 text-[#ffc107] font-semibold mb-1">
                <Calendar size={14} />
                Ước lượng: ~{previewCount} suất chiếu sẽ tạo
              </div>
              <div className="text-xs text-gray-300">
                Hệ thống sẽ skip slot trùng suất hiện có, quá khứ, hoặc ngoài đợt chiếu.
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={handleClose}
              className="border-white/10 text-gray-300 hover:bg-white/5">
              Hủy
            </Button>
            <Button onClick={submit}
              disabled={mut.isPending || !movieId || !effectiveTheaterId || selectedRoomIds.size === 0}
              className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold disabled:bg-gray-600 disabled:text-gray-300">
              {mut.isPending ? (
                <><Loader2 size={14} className="mr-1 animate-spin" /> Đang tạo…</>
              ) : (
                <><Sparkles size={14} className="mr-1" /> Tạo {previewCount > 0 ? `~${previewCount} suất` : 'lịch chiếu'}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
