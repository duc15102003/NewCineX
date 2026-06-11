import FilterDrawer, { FilterField } from '@/components/common/FilterDrawer'
import DateRangePicker from '@/components/common/DateRangePicker'
import { NumberRangeInput } from '@/components/common/NumberRangeInput'
import { DISCOUNT_TYPE_LABELS } from '@/utils/labels'
import type { AdminVoucherFilter } from '@/hooks/useAdminVouchers'

const SELECT_CLS =
  'w-full h-10 rounded-lg border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

export interface VoucherFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  adv: AdminVoucherFilter
  onPatch: (patch: Partial<AdminVoucherFilter>) => void
  includeExpired: boolean
  onSetIncludeExpired: (v: boolean) => void
  branchLocked: boolean
  onApply: () => void
  onReset: () => void
}

/** Filter nâng cao cho voucher: scope, discount type, validity, value range, date ranges. */
export default function VoucherFilterDrawer(props: VoucherFilterDrawerProps) {
  const {
    open, onOpenChange, adv, onPatch, includeExpired, onSetIncludeExpired,
    branchLocked, onApply, onReset,
  } = props
  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Lọc voucher nâng cao"
      onReset={onReset}
      onApply={onApply}
    >
      {!branchLocked && (
        <FilterField label="Phạm vi áp dụng">
          <select
            className={SELECT_CLS}
            value={adv.globalOnly === true ? 'GLOBAL' : ''}
            onChange={(e) => onPatch({ globalOnly: e.target.value === 'GLOBAL' ? true : undefined })}
          >
            <option value="">— Tất cả phạm vi —</option>
            <option value="GLOBAL">Chỉ voucher toàn hệ thống</option>
          </select>
        </FilterField>
      )}

      <FilterField label="Loại giảm giá">
        <select
          className={SELECT_CLS}
          value={adv.discountType ?? ''}
          onChange={(e) => onPatch({ discountType: e.target.value || undefined })}
        >
          <option value="">— Tất cả —</option>
          {Object.entries(DISCOUNT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Điều kiện hiệu lực">
        <div className="space-y-2">
          <CheckboxRow
            checked={!!adv.currentlyValid}
            onChange={(c) => onPatch({ currentlyValid: c || undefined })}
            label="Chỉ voucher đang trong hạn (now ∈ [start, end])"
          />
          <CheckboxRow
            checked={!!adv.hasUsageLeft}
            onChange={(c) => onPatch({ hasUsageLeft: c || undefined })}
            label="Chỉ voucher còn lượt dùng"
          />
          <CheckboxRow
            checked={includeExpired}
            onChange={onSetIncludeExpired}
            label="Bao gồm voucher đã hết hạn"
          />
        </div>
      </FilterField>

      <FilterField label="Khoảng giá trị giảm">
        <NumberRangeInput
          min={adv.minDiscount ?? ''}
          max={adv.maxDiscount ?? ''}
          onChange={(min, max) => onPatch({
            minDiscount: min ? Number(min) : undefined,
            maxDiscount: max ? Number(max) : undefined,
          })}
          step={1000}
        />
      </FilterField>

      <FilterField label="Khoảng ngày bắt đầu">
        <DateRangePicker
          type="datetime-local"
          from={(adv.startDateFrom as string) ?? ''}
          to={(adv.startDateTo as string) ?? ''}
          onChange={(from, to) => onPatch({ startDateFrom: from || undefined, startDateTo: to || undefined })}
        />
      </FilterField>

      <FilterField label="Khoảng ngày kết thúc">
        <DateRangePicker
          type="datetime-local"
          from={(adv.endDateFrom as string) ?? ''}
          to={(adv.endDateTo as string) ?? ''}
          onChange={(from, to) => onPatch({ endDateFrom: from || undefined, endDateTo: to || undefined })}
        />
      </FilterField>
    </FilterDrawer>
  )
}

interface CheckboxRowProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

function CheckboxRow({ checked, onChange, label }: CheckboxRowProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
      <input
        type="checkbox"
        className="accent-[#ffc107]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}
