import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-[#ffc107] text-black font-semibold hover:bg-[#e6ac06] focus-visible:ring-[#ffc107]',
        destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
        outline: 'border border-[#ffc107] text-[#ffc107] bg-transparent hover:bg-[#ffc107]/10 focus-visible:ring-[#ffc107]',
        secondary: 'border border-white/10 text-gray-300 bg-transparent hover:bg-white/5 focus-visible:ring-white/20',
        ghost: 'text-gray-300 hover:bg-white/5 hover:text-white focus-visible:ring-white/20',
        link: 'text-[#ffc107] underline-offset-4 hover:underline',
      },
      size: {
        // default = admin primary action (Lưu, Tạo, Thêm mới...) — h-9 = 36px,
        // compact đủ cho UI dense nhưng vẫn dễ click. Match Input h-10 cũng OK
        // vì button thường ở row riêng (toolbar/footer), không cùng row Input.
        default: 'h-9 px-4 py-2 text-sm',
        sm: 'h-8 rounded-md px-3 text-xs',
        // lg = CTA public (Đặt vé, Thanh toán). KHÔNG dùng cho admin.
        lg: 'h-11 rounded-lg px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
