import FilterDrawer, { FilterField } from '@/components/common/FilterDrawer'
import NumberRangeInput from '@/components/common/NumberRangeInput'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

export interface SnackFilterDraft {
  category: string
  available: '' | 'true' | 'false'
  minPrice: string
  maxPrice: string
  includeDeleted: boolean
}

export interface SnackFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftFilter: SnackFilterDraft
  onSetDraft: <K extends keyof SnackFilterDraft>(key: K, val: SnackFilterDraft[K]) => void
  onApply: () => void
  onReset: () => void
  categories: readonly string[]
}

/** Filter nâng cao cho snack: category, available, price range, includeDeleted. */
export default function SnackFilterDrawer(props: SnackFilterDrawerProps) {
  const { open, onOpenChange, draftFilter, onSetDraft, onApply, onReset, categories } = props
  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      onApply={onApply}
      onReset={onReset}
    >
      <FilterField label="Danh mục">
        <select
          value={draftFilter.category}
          onChange={(e) => onSetDraft('category', e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </FilterField>

      <FilterField label="Tình trạng hàng">
        <select
          value={draftFilter.available}
          onChange={(e) => onSetDraft('available', e.target.value as SnackFilterDraft['available'])}
          className={SELECT_CLS}
        >
          <option value="">Tất cả</option>
          <option value="true">Còn hàng</option>
          <option value="false">Hết hàng</option>
        </select>
      </FilterField>

      <FilterField label="Khoảng giá">
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
            checked={draftFilter.includeDeleted}
            onChange={(e) => onSetDraft('includeDeleted', e.target.checked)}
            className="accent-[#ffc107] w-4 h-4"
          />
          <span className="text-sm text-gray-300">Hiển thị đồ ăn đã lưu trữ</span>
        </label>
      </FilterField>
    </FilterDrawer>
  )
}
