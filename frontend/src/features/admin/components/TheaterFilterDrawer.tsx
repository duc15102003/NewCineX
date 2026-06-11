import FilterDrawer, { FilterField } from '@/components/common/FilterDrawer'
import { Input } from '@/components/ui/input'
import type { TheaterParams, TheaterStatus } from '@/hooks/useAdminTheaters'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

const THEATER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  MAINTENANCE: 'Bảo trì',
  CLOSED: 'Ngừng',
}

export interface TheaterFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftFilter: TheaterParams
  onPatchDraft: (patch: Partial<TheaterParams>) => void
  onApply: () => void
  onReset: () => void
}

/** Filter cho theater: city, status, includeDeleted. */
export default function TheaterFilterDrawer(props: TheaterFilterDrawerProps) {
  const { open, onOpenChange, draftFilter, onPatchDraft, onApply, onReset } = props
  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Lọc chi nhánh"
      onApply={onApply}
      onReset={onReset}
    >
      <FilterField label="Thành phố">
        <Input
          placeholder="Hà Nội, TP.HCM, Đà Nẵng..."
          value={draftFilter.city ?? ''}
          onChange={(e) => onPatchDraft({ city: e.target.value })}
        />
      </FilterField>
      <FilterField label="Trạng thái">
        <select
          value={draftFilter.status ?? ''}
          onChange={(e) => onPatchDraft({ status: e.target.value ? (e.target.value as TheaterStatus) : undefined })}
          className={SELECT_CLS}
        >
          <option value="">Tất cả</option>
          {Object.entries(THEATER_STATUS_LABELS).map(([v, lbl]) => (
            <option key={v} value={v}>{lbl}</option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Bao gồm đã lưu trữ" hint="Hiển thị cả bản ghi đã bị xoá mềm (ARCHIVED).">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draftFilter.includeDeleted ?? true}
            onChange={(e) => onPatchDraft({ includeDeleted: e.target.checked })}
            className="accent-[#ffc107] w-4 h-4"
          />
          <span className="text-sm text-gray-300">Hiển thị chi nhánh đã lưu trữ</span>
        </label>
      </FilterField>
    </FilterDrawer>
  )
}
