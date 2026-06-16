import * as React from 'react'
import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  /** Label text bên phải switch. Optional — nếu không truyền, render switch trần. */
  label?: React.ReactNode
  /** Mô tả phụ dưới label — text-xs gray. */
  description?: React.ReactNode
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Switch toggle — chuẩn iOS/Material cho bật/tắt một giá trị boolean.
 * Dùng thay checkbox khi semantic là "trạng thái on/off", không phải "chọn nhiều".
 */
export function Switch({
  checked, onChange, disabled, label, description, size = 'md', className,
}: SwitchProps) {
  const trackW = size === 'sm' ? 'w-8' : 'w-10'
  const trackH = size === 'sm' ? 'h-4' : 'h-5'
  const thumbSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  const thumbX = size === 'sm' ? 'translate-x-4' : 'translate-x-5'

  const switchEl = (
    <button type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc107] focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        trackW, trackH,
        checked ? 'bg-[#ffc107]' : 'bg-white/15',
      )}>
      <span className={cn(
        'pointer-events-none inline-block rounded-full bg-white shadow-lg transform transition-transform',
        thumbSize,
        checked ? thumbX : 'translate-x-0',
      )} />
    </button>
  )

  if (!label && !description) return <span className={className}>{switchEl}</span>

  return (
    <label className={cn('inline-flex items-start gap-2.5 cursor-pointer select-none', disabled && 'cursor-not-allowed', className)}>
      {switchEl}
      <div className="flex flex-col">
        {label && <span className="text-sm text-white leading-tight">{label}</span>}
        {description && <span className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{description}</span>}
      </div>
    </label>
  )
}
