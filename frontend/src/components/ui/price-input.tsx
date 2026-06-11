import * as React from 'react'
import { cn } from '@/lib/utils'

interface PriceInputProps {
  value: number | string | undefined
  onChange: (value: number) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

function formatDisplay(val: number | string | undefined): string {
  if (val === undefined || val === '' || val === null) return ''
  const num = typeof val === 'string' ? parseInt(val, 10) : val
  if (isNaN(num)) return ''
  return num.toLocaleString('vi-VN')
}


const PriceInput = React.forwardRef<HTMLInputElement, PriceInputProps>(
  ({ value, onChange, placeholder = '0', className, disabled }, ref) => {
    const [display, setDisplay] = React.useState(() => formatDisplay(value))

    // Sync khi value thay đổi từ bên ngoài (reset form)
    React.useEffect(() => {
      setDisplay(formatDisplay(value))
    }, [value])

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value.replace(/[^0-9]/g, '') // Chỉ giữ số
      if (raw === '') {
        setDisplay('')
        onChange(0)
        return
      }
      const num = parseInt(raw, 10)
      setDisplay(num.toLocaleString('vi-VN'))
      onChange(num)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      // Cho phép: số, backspace, delete, tab, arrow, home, end
      const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'a']
      if (allowed.includes(e.key)) return
      if (e.ctrlKey || e.metaKey) return // Ctrl+A, Ctrl+C, etc.
      if (!/^[0-9]$/.test(e.key)) {
        e.preventDefault()
      }
    }

    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full rounded-lg border border-white/10 bg-[#2a2317] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#ffc107] focus:border-[#ffc107] disabled:cursor-not-allowed disabled:opacity-50 pr-8',
            className,
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">đ</span>
      </div>
    )
  },
)
PriceInput.displayName = 'PriceInput'

export { PriceInput }
