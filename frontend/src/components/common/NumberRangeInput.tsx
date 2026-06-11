import * as React from 'react'
import { Input } from '@/components/ui/input'

/**
 * NumberRangeInput — 2 input số side-by-side cho khoảng "Min → Max".
 *
 * Dùng cho lọc giá, số ghế, ... value là string để parent quản lý ép kiểu
 * (tránh quirky number behavior khi clear input).
 *
 * Chặn ký tự `e`, `+`, `-` (HTML number cho phép scientific notation
 * nhưng theo quy ước project không dùng).
 *
 * Export cả default + named để tương thích cả hai pattern import.
 *
 * Theme: Admin Dark Brown — override Input default classes qua className.
 */
const ADMIN_INPUT_CLS =
  'bg-[#2a2317] focus:ring-[#ffc107] focus:border-[#ffc107]'
interface NumberRangeInputProps {
  min?: string | number
  max?: string | number
  onChange: (min: string, max: string) => void
  suffix?: string         // VD: "đ", "ghế"
  minPlaceholder?: string
  maxPlaceholder?: string
  step?: number
}

function blockBadChars(e: React.KeyboardEvent<HTMLInputElement>) {
  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
}

export function NumberRangeInput({
  min,
  max,
  onChange,
  suffix,
  minPlaceholder = 'Từ',
  maxPlaceholder = 'Đến',
  step = 1,
}: NumberRangeInputProps) {
  const minStr = min == null ? '' : String(min)
  const maxStr = max == null ? '' : String(max)

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="relative">
        <Input
          type="number"
          min={0}
          step={step}
          value={minStr}
          onChange={(e) => onChange(e.target.value, maxStr)}
          onKeyDown={blockBadChars}
          placeholder={minPlaceholder}
          className={`${ADMIN_INPUT_CLS} ${suffix ? 'pr-8' : ''}`}
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      <div className="relative">
        <Input
          type="number"
          min={0}
          step={step}
          value={maxStr}
          onChange={(e) => onChange(minStr, e.target.value)}
          onKeyDown={blockBadChars}
          placeholder={maxPlaceholder}
          className={`${ADMIN_INPUT_CLS} ${suffix ? 'pr-8' : ''}`}
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

export default NumberRangeInput
