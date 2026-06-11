import FilterDrawer, { FilterField } from '@/components/common/FilterDrawer'
import NumberRangeInput from '@/components/common/NumberRangeInput'
import { ROOM_TYPE_LABELS, ROOM_STATUS_LABELS } from '@/utils/labels'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

export interface RoomFilterDraft {
  type: string
  status: string
  minSeats: string
  maxSeats: string
  includeDeleted: boolean
}

export interface RoomFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftFilter: RoomFilterDraft
  onSetDraft: <K extends keyof RoomFilterDraft>(key: K, val: RoomFilterDraft[K]) => void
  onApply: () => void
  onReset: () => void
}

/** Filter nâng cao cho room: type, status, seat range, includeDeleted. */
export default function RoomFilterDrawer(props: RoomFilterDrawerProps) {
  const { open, onOpenChange, draftFilter, onSetDraft, onApply, onReset } = props
  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      onApply={onApply}
      onReset={onReset}
    >
      <FilterField label="Loại phòng">
        <select
          value={draftFilter.type}
          onChange={(e) => onSetDraft('type', e.target.value)}
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
          {Object.entries(ROOM_STATUS_LABELS).map(([v, lbl]) => (
            <option key={v} value={v}>{lbl}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Số ghế">
        <NumberRangeInput
          min={draftFilter.minSeats}
          max={draftFilter.maxSeats}
          onChange={(min, max) => {
            onSetDraft('minSeats', min)
            onSetDraft('maxSeats', max)
          }}
          suffix="ghế"
        />
      </FilterField>

      <FilterField label="Bao gồm đã xóa">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draftFilter.includeDeleted}
            onChange={(e) => onSetDraft('includeDeleted', e.target.checked)}
            className="accent-[#ffc107] w-4 h-4"
          />
          <span className="text-sm text-gray-300">Hiển thị cả phòng đã lưu trữ</span>
        </label>
      </FilterField>
    </FilterDrawer>
  )
}
