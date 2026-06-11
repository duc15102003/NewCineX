import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Custom className cho phần <input>. Wrapper bọc ngoài luôn relative. */
  className?: string
}

/**
 * Input mật khẩu có nút mắt show/hide.
 * Dùng forwardRef để react-hook-form register() bind ref được.
 *
 * UX: nút mắt nằm bên phải, padding-right input đẩy ra để text không đè lên icon.
 * tabIndex=-1 trên button để Tab không nhảy vào nút mắt (chỉ skip giữa các form field).
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false)

    return (
      <div className="relative">
        <input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn(
            'flex h-10 w-full rounded-md border border-white/10 bg-[#2a2317] pl-3 pr-10 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#ffc107] focus:border-[#ffc107] disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-[#ffc107] rounded transition-colors"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
