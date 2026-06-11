import FilterDrawer, { FilterField } from '@/components/common/FilterDrawer'
import { Input } from '@/components/ui/input'
import DateRangePicker from '@/components/common/DateRangePicker'
import NumberRangeInput from '@/components/common/NumberRangeInput'
import { ROOM_TYPE_LABELS, SHOWTIME_STATUS_LABELS } from '@/utils/labels'
import type { AdminMovie } from '@/hooks/useAdminMovies'
import type { AdminRoom } from '@/hooks/useAdminRooms'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

export interface ShowtimeFilterDraft {
  movieId: string
  roomId: string
  status: string
  roomType: string
  startDate: string
  startTimeFrom: string
  startTimeTo: string
  minPrice: string
  maxPrice: string
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
}

/** Filter nâng cao cho list showtime: phim, phòng, ngày, khoảng giờ, khoảng giá. */
export default function ShowtimeFilterDrawer(props: ShowtimeFilterDrawerProps) {
  const { open, onOpenChange, draftFilter, onSetDraft, onApply, onReset, movies, rooms } = props
  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      onApply={onApply}
      onReset={onReset}
    >
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

      <FilterField label="Phòng chiếu">
        <select
          value={draftFilter.roomId}
          onChange={(e) => onSetDraft('roomId', e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">Tất cả phòng</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Loại phòng">
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

      <FilterField label="Ngày chiếu" hint="Chọn 1 ngày cụ thể (ưu tiên hơn khoảng thời gian)">
        <Input type="date" value={draftFilter.startDate}
          onChange={(e) => onSetDraft('startDate', e.target.value)} />
      </FilterField>

      <FilterField label="Khoảng giờ chiếu" hint="Chỉ áp dụng khi không chọn ngày cụ thể">
        <DateRangePicker
          type="datetime-local"
          from={draftFilter.startTimeFrom}
          to={draftFilter.startTimeTo}
          onChange={(from, to) => {
            onSetDraft('startTimeFrom', from)
            onSetDraft('startTimeTo', to)
          }}
        />
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
    </FilterDrawer>
  )
}
