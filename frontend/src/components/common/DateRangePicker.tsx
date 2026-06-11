import { Input } from '@/components/ui/input'

/**
 * DateRangePicker — 2 input ngày side-by-side cho khoảng "Từ → Đến".
 *
 * Dùng <input type="date"> hoặc <input type="datetime-local">. Value/onChange
 * truyền nguyên chuỗi (string) để parent quản lý — không tự ép kiểu Date,
 * giảm rủi ro lệch timezone giữa BE và FE.
 *
 * Single Responsibility: chỉ render 2 input + label "Từ" "Đến", không xử lý
 * filter logic.
 *
 * Theme: Admin Dark Brown — bg-[#2a2317] + focus-ring [#ffc107]. Vì component
 * <Input> mặc định mang public-site tokens, ta override qua className (tailwind-merge
 * sẽ thay thế bg/focus đúng cách).
 */
const ADMIN_INPUT_CLS =
  'bg-[#2a2317] focus:ring-[#ffc107] focus:border-[#ffc107]'
interface DateRangePickerProps {
  from?: string
  to?: string
  onChange: (from: string, to: string) => void
  /** datetime-local nếu cần cả giờ phút, mặc định 'date'. */
  type?: 'date' | 'datetime-local'
  fromLabel?: string
  toLabel?: string
}

export default function DateRangePicker({
  from = '',
  to = '',
  onChange,
  type = 'date',
  fromLabel = 'Từ',
  toLabel = 'Đến',
}: DateRangePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="text-xs text-gray-400 mb-1 block">{fromLabel}</label>
        <Input
          type={type}
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
          className={ADMIN_INPUT_CLS}
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-1 block">{toLabel}</label>
        <Input
          type={type}
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
          className={ADMIN_INPUT_CLS}
        />
      </div>
    </div>
  )
}
