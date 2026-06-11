import FilterDrawer, { FilterField } from '@/components/common/FilterDrawer'
import { Input } from '@/components/ui/input'
import DateRangePicker from '@/components/common/DateRangePicker'
import { NumberRangeInput } from '@/components/common/NumberRangeInput'
import type { AdminReviewFilter } from '@/hooks/useAdminReviews'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

interface MovieOption {
  id: number
  title: string
}

export interface ReviewFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftFilter: AdminReviewFilter
  onPatchDraft: (patch: Partial<AdminReviewFilter>) => void
  onApply: () => void
  onReset: () => void
  movies: MovieOption[]
}

/** Filter nâng cao cho review: phim, userId, rating range, datetime range, hasComment, includeDeleted. */
export default function ReviewFilterDrawer(props: ReviewFilterDrawerProps) {
  const { open, onOpenChange, draftFilter, onPatchDraft, onApply, onReset, movies } = props
  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Lọc đánh giá nâng cao"
      onApply={onApply}
      onReset={onReset}
    >
      <FilterField label="Phim">
        <select
          className={SELECT_CLS}
          value={draftFilter.movieId ?? ''}
          onChange={(e) => onPatchDraft({ movieId: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">— Tất cả phim —</option>
          {movies.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="ID người dùng" hint="Lọc theo userId cụ thể">
        <Input
          type="number"
          placeholder="VD: 5"
          value={draftFilter.userId ?? ''}
          onChange={(e) => onPatchDraft({ userId: e.target.value ? Number(e.target.value) : undefined })}
        />
      </FilterField>

      <FilterField label="Khoảng rating (1 - 10)">
        <NumberRangeInput
          min={draftFilter.minRating ?? ''}
          max={draftFilter.maxRating ?? ''}
          onChange={(minStr, maxStr) =>
            onPatchDraft({
              minRating: minStr ? Number(minStr) : undefined,
              maxRating: maxStr ? Number(maxStr) : undefined,
            })
          }
          suffix="★"
          step={1}
        />
      </FilterField>

      <FilterField label="Khoảng thời gian tạo">
        <DateRangePicker
          type="datetime-local"
          from={draftFilter.createdFrom ?? ''}
          to={draftFilter.createdTo ?? ''}
          onChange={(from, to) =>
            onPatchDraft({
              createdFrom: from || undefined,
              createdTo: to || undefined,
            })
          }
        />
      </FilterField>

      <FilterField label="Tùy chọn khác">
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draftFilter.hasComment === true}
              onChange={(e) => onPatchDraft({ hasComment: e.target.checked ? true : undefined })}
              className="accent-[#ffc107] w-4 h-4"
            />
            <span className="text-sm text-gray-300">Chỉ review có comment</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draftFilter.includeDeleted ?? true}
              onChange={(e) => onPatchDraft({ includeDeleted: e.target.checked })}
              className="accent-[#ffc107] w-4 h-4"
            />
            <span className="text-sm text-gray-300">Hiển thị đánh giá đã lưu trữ</span>
          </label>
        </div>
      </FilterField>
    </FilterDrawer>
  )
}
