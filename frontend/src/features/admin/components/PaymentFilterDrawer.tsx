import FilterDrawer, { FilterField } from '@/components/common/FilterDrawer'
import { Input } from '@/components/ui/input'
import DateRangePicker from '@/components/common/DateRangePicker'
import { NumberRangeInput } from '@/components/common/NumberRangeInput'
import { PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/utils/labels'
import type { AdminPaymentFilter } from '@/hooks/useAdminPayments'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

export interface PaymentFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  adv: AdminPaymentFilter
  onPatch: (patch: Partial<AdminPaymentFilter>) => void
  onApply: () => void
  onReset: () => void
}

/** Filter cho payment: status, method, paidAt/createdAt range, amount range, userId, bookingId. */
export default function PaymentFilterDrawer(props: PaymentFilterDrawerProps) {
  const { open, onOpenChange, adv, onPatch, onApply, onReset } = props
  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Lọc giao dịch nâng cao"
      onReset={onReset}
      onApply={onApply}
    >
      <FilterField label="Trạng thái">
        <select
          className={SELECT_CLS}
          value={adv.status ?? ''}
          onChange={(e) => onPatch({ status: e.target.value || undefined })}
        >
          <option value="">— Tất cả —</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Phương thức">
        <select
          className={SELECT_CLS}
          value={adv.method ?? ''}
          onChange={(e) => onPatch({ method: e.target.value || undefined })}
        >
          <option value="">— Tất cả —</option>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Khoảng thanh toán (paidAt)">
        <DateRangePicker
          type="datetime-local"
          from={(adv.paidFrom as string) ?? ''}
          to={(adv.paidTo as string) ?? ''}
          onChange={(from, to) => onPatch({ paidFrom: from || undefined, paidTo: to || undefined })}
        />
      </FilterField>

      <FilterField label="Khoảng tạo (createdAt)">
        <DateRangePicker
          type="datetime-local"
          from={(adv.createdFrom as string) ?? ''}
          to={(adv.createdTo as string) ?? ''}
          onChange={(from, to) => onPatch({ createdFrom: from || undefined, createdTo: to || undefined })}
        />
      </FilterField>

      <FilterField label="Khoảng số tiền">
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

      <FilterField label="ID người dùng">
        <Input
          type="number"
          placeholder="VD: 5"
          value={adv.userId ?? ''}
          onChange={(e) => onPatch({ userId: e.target.value ? Number(e.target.value) : undefined })}
        />
      </FilterField>

      <FilterField label="ID booking">
        <Input
          type="number"
          placeholder="VD: 12"
          value={adv.bookingId ?? ''}
          onChange={(e) => onPatch({ bookingId: e.target.value ? Number(e.target.value) : undefined })}
        />
      </FilterField>
    </FilterDrawer>
  )
}
