import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'flex h-10 w-full rounded-md border border-white/10 bg-[#2a2317] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#ffc107] focus:border-[#ffc107] disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer',
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  },
)
Select.displayName = 'Select'

export { Select }
