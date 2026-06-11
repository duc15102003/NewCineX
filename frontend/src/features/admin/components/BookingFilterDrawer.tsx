import FilterDrawer, { FilterField } from '@/components/common/FilterDrawer'
import DateRangePicker from '@/components/common/DateRangePicker'
import { NumberRangeInput } from '@/components/common/NumberRangeInput'
import { Input } from '@/components/ui/input'
import { BOOKING_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/utils/labels'
import type { AdminBookingFilter } from '@/hooks/useAdminBookings'
import type { MovieListItem } from '@/types/movie'
import type { AdminRoom } from '@/hooks/useAdminRooms'

const SELECT_CLS =
  'w-full h-10 rounded-lg border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

export interface BookingFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  adv: AdminBookingFilter
  movies: MovieListItem[]
  rooms: AdminRoom[]
  onPatch: (patch: Partial<AdminBookingFilter>) => void
  onApply: () => void
  onReset: () => void
}

/** Filter nâng cao cho AdminBooking: status, movie, room, showtime, method, user, date ranges, amount range. */
export default function BookingFilterDrawer(props: BookingFilterDrawerProps) {
  const { open, onOpenChange, adv, movies, rooms, onPatch, onApply, onReset } = props
  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Lọc booking nâng cao"
      onReset={onReset}
      onApply={onApply}
    >
      <FilterField label="Trạng thái">
        <select className={SELECT_CLS} value={adv.status ?? ''}
          onChange={(e) => onPatch({ status: e.target.value || undefined })}>
          <option value="">— Tất cả —</option>
          {Object.entries(BOOKING_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Phim">
        <select className={SELECT_CLS} value={adv.movieId ?? ''}
          onChange={(e) => onPatch({ movieId: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">— Tất cả phim —</option>
          {movies.map(m => (<option key={m.id} value={m.id}>{m.title}</option>))}
        </select>
      </FilterField>

      <FilterField label="Phòng chiếu">
        <select className={SELECT_CLS} value={adv.roomId ?? ''}
          onChange={(e) => onPatch({ roomId: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">— Tất cả phòng —</option>
          {rooms.map(r => (<option key={r.id} value={r.id}>{r.name}</option>))}
        </select>
      </FilterField>

      <FilterField label="ID suất chiếu" hint="Nhập showtime ID nếu admin biết chính xác">
        <Input type="number" placeholder="VD: 42"
          value={adv.showtimeId ?? ''}
          onChange={(e) => onPatch({ showtimeId: e.target.value ? Number(e.target.value) : undefined })} />
      </FilterField>

      <FilterField label="Phương thức thanh toán">
        <select className={SELECT_CLS} value={adv.paymentMethod ?? ''}
          onChange={(e) => onPatch({ paymentMethod: e.target.value || undefined })}>
          <option value="">— Tất cả —</option>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="ID người dùng">
        <Input type="number" placeholder="VD: 5"
          value={adv.userId ?? ''}
          onChange={(e) => onPatch({ userId: e.target.value ? Number(e.target.value) : undefined })} />
      </FilterField>

      <FilterField label="Khoảng ngày đặt (createdAt)">
        <DateRangePicker
          type="datetime-local"
          from={(adv.createdFrom as string) ?? ''}
          to={(adv.createdTo as string) ?? ''}
          onChange={(from, to) => onPatch({ createdFrom: from || undefined, createdTo: to || undefined })}
        />
      </FilterField>

      <FilterField label="Khoảng ngày xác nhận (confirmedAt)">
        <DateRangePicker
          type="datetime-local"
          from={(adv.confirmedFrom as string) ?? ''}
          to={(adv.confirmedTo as string) ?? ''}
          onChange={(from, to) => onPatch({ confirmedFrom: from || undefined, confirmedTo: to || undefined })}
        />
      </FilterField>

      <FilterField label="Khoảng tổng tiền">
        <NumberRangeInput
          min={adv.minAmount ?? ''}
          max={adv.maxAmount ?? ''}
          onChange={(min, max) => onPatch({
            minAmount: min ? Number(min) : undefined,
            maxAmount: max ? Number(max) : undefined,
          })}
          suffix="đ"
          step={1000}
        />
      </FilterField>
    </FilterDrawer>
  )
}
