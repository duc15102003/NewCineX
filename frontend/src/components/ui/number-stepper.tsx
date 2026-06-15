import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NumberStepperProps {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
  /** Width của input chính giữa. Default w-14. */
  inputWidth?: string
}

/**
 * Number stepper — input số kèm nút +/- 2 bên.
 * Dùng cho quantity (số ghế, số lượng combo item) — UX chuẩn e-commerce.
 */
export function NumberStepper({
  value, onChange, min = 0, max = 999, step = 1, disabled,
  className, inputWidth = 'w-14',
}: NumberStepperProps) {
  function clamp(n: number): number {
    if (Number.isNaN(n)) return min
    return Math.max(min, Math.min(max, n))
  }
  return (
    <div className={cn('inline-flex items-center rounded-md border border-white/10 bg-[#2a2317] overflow-hidden', className)}>
      <button type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={disabled || value <= min}
        className="h-9 w-9 flex items-center justify-center text-gray-300 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Giảm">
        <Minus size={14} />
      </button>
      <input type="number"
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        min={min} max={max} step={step}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault()
        }}
        className={cn(
          'h-9 text-center bg-transparent border-x border-white/10 text-white text-sm font-medium',
          'focus:outline-none focus:bg-white/5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          inputWidth,
        )} />
      <button type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={disabled || value >= max}
        className="h-9 w-9 flex items-center justify-center text-gray-300 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Tăng">
        <Plus size={14} />
      </button>
    </div>
  )
}
