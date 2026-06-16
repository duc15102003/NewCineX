import FilterDrawer, { FilterField } from '@/components/common/FilterDrawer'
import { Input } from '@/components/ui/input'
import DateRangePicker from '@/components/common/DateRangePicker'
import NumberRangeInput from '@/components/common/NumberRangeInput'
import { ROOM_TYPE_LABELS, SHOWTIME_STATUS_LABELS, label } from '@/utils/labels'
import type { AdminMovie } from '@/hooks/useAdminMovies'
import type { AdminRoom } from '@/hooks/useAdminRooms'
import type { Theater } from '@/hooks/useAdminTheaters'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

export interface ShowtimeFilterDraft {
  theaterId: string
  movieId: string
  roomId: string
  status: string
  roomType: string
  startDate: string
  startTimeFrom: string
  startTimeTo: string
  minPrice: string
  maxPrice: string
  /** '' = chỉ ACTIVE; 'true' = bao gồm ARCHIVED. String để khớp signature onSetDraft. */
  includeDeleted: string
}

export interface ShowtimeFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftFilter: ShowtimeFilterDraft
  onSetDraft: <K extends keyof ShowtimeFilterDraft>(key: K, val: string) => void
  onApply: () => void
  onReset: () => void
  movies: AdminMovie[]
  rooms: AdminRoom[]
  theaters: Theater[]
  /**
   * Hiện field "Chi nhánh" — chỉ ON khi user đang ở "Tất cả chi nhánh" mode
   * (super admin chưa pick chi nhánh nào). Khi đã pick theater hoặc là branch
   * admin → field bị ẩn vì redundant với theater switcher cấp trên.
   */
  showTheaterFilter: boolean
  /**
   * Bật khi user đang ở view Calendar. Khi true:
   * - Field "Ngày chiếu" (startDate) VẪN cho chọn — đồng bộ với navigator
   *   calendar, dùng làm shortcut nhảy tới ngày bất kỳ.
   * - Field "Khoảng giờ chiếu" (startTimeFrom/To) bị khoá vì calendar luôn
   *   hiển thị full ngày (8h-24h), không support range giờ.
   */
  calendarMode?: boolean
}

/** Filter nâng cao cho list showtime: chi nhánh, phim, phòng, ngày, khoảng giờ, khoảng giá. */
export default function ShowtimeFilterDrawer(props: ShowtimeFilterDrawerProps) {
  const { open, onOpenChange, draftFilter, onSetDraft, onApply, onReset, movies, rooms, theaters, showTheaterFilter, calendarMode = false } = props
  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      onApply={onApply}
      onReset={onReset}
    >
      {calendarMode && (
        <div className="rounded-md border border-[#ffc107]/30 bg-[#ffc107]/10 px-3 py-2 text-xs text-amber-50 leading-relaxed">
          Đang xem chế độ <span className="font-semibold">Lịch (Calendar)</span>:
          <ul className="mt-1 ml-4 list-disc space-y-0.5 text-amber-50/90">
            <li>Chọn "Ngày chiếu" → calendar nhảy thẳng tới ngày đó</li>
            <li>"Khoảng giờ chiếu" tạm khoá — calendar luôn hiển thị nguyên ngày từ 8:00 đến 24:00</li>
          </ul>
        </div>
      )}
      {showTheaterFilter && (
        <FilterField label="Chi nhánh">
          <select
            value={draftFilter.theaterId}
            onChange={(e) => onSetDraft('theaterId', e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">Tất cả chi nhánh</option>
            {theaters.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.city ? ` — ${t.city}` : ''}
              </option>
            ))}
          </select>
        </FilterField>
      )}

      <FilterField label="Phim">
        <select
          value={draftFilter.movieId}
          onChange={(e) => onSetDraft('movieId', e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">Tất cả phim</option>
          {movies.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Phòng chiếu" hint="Lọc 1 phòng cụ thể (vd Phòng A1). Tên kèm loại trong ngoặc.">
        <select
          value={draftFilter.roomId}
          onChange={(e) => onSetDraft('roomId', e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">Tất cả phòng</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({label(ROOM_TYPE_LABELS, r.type)})
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Loại phòng" hint="Lọc theo công nghệ (vd tất cả phòng IMAX của tất cả CN).">
        <select
          value={draftFilter.roomType}
          onChange={(e) => onSetDraft('roomType', e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">Tất cả loại</option>
          {Object.entries(ROOM_TYPE_LABELS).map(([v, lbl]) => (
            <option key={v} value={v}>{lbl}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Trạng thái">
        <select
          value={draftFilter.status}
          onChange={(e) => onSetDraft('status', e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(SHOWTIME_STATUS_LABELS).map(([v, lbl]) => (
            <option key={v} value={v}>{lbl}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Ngày chiếu" hint={calendarMode ? 'Apply → Calendar nhảy tới ngày này' : 'Chọn 1 ngày cụ thể (ưu tiên hơn khoảng thời gian)'}>
        <Input type="date" value={draftFilter.startDate}
          onChange={(e) => onSetDraft('startDate', e.target.value)} />
      </FilterField>

      <FilterField label="Khoảng giờ chiếu" hint={calendarMode ? 'Calendar luôn hiển thị full ngày — field này tạm khoá' : 'Chỉ áp dụng khi không chọn ngày cụ thể'}>
        <div className={calendarMode ? 'opacity-50 pointer-events-none' : ''}>
          <DateRangePicker
            type="datetime-local"
            from={draftFilter.startTimeFrom}
            to={draftFilter.startTimeTo}
            onChange={(from, to) => {
              onSetDraft('startTimeFrom', from)
              onSetDraft('startTimeTo', to)
            }}
          />
        </div>
      </FilterField>

      <FilterField label="Khoảng giá vé thường">
        <NumberRangeInput
          min={draftFilter.minPrice}
          max={draftFilter.maxPrice}
          onChange={(min, max) => {
            onSetDraft('minPrice', min)
            onSetDraft('maxPrice', max)
          }}
          suffix="đ"
          step={1000}
        />
      </FilterField>

      <FilterField label="Bao gồm bản đã lưu trữ" hint="Lưu trữ = ẩn khỏi danh sách thường, có thể khôi phục lại bất cứ lúc nào.">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draftFilter.includeDeleted === 'true'}
            onChange={(e) => onSetDraft('includeDeleted', e.target.checked ? 'true' : '')}
            className="accent-[#ffc107] w-4 h-4"
          />
          <span className="text-sm text-gray-300">Hiển thị suất chiếu đã lưu trữ</span>
        </label>
      </FilterField>
    </FilterDrawer>
  )
}
