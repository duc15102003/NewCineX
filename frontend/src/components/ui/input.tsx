import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onKeyDown, ...props }, ref) => {
    // Chặn ký tự e, E, +, - trên input number (scientific notation không cần)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (type === 'number' && ['e', 'E', '+', '-'].includes(e.key)) {
        e.preventDefault()
      }
      onKeyDown?.(e)
    }

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-white/10 bg-[#2a2317] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#ffc107] focus:border-[#ffc107] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        onKeyDown={handleKeyDown}
        min={type === 'number' ? 0 : undefined}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
