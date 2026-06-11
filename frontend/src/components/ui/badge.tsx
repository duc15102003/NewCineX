import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Badge — Phase 7a low-opacity pattern: bg-{color}/10 + text-{color} + border-{color}/30.
 *
 * Đồng nhất với status badges trong table khắp app (movie status, booking status, ...).
 * Border radius `rounded-md` (status tag) khác từ legacy `rounded-full` (pill-style).
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30',
        secondary: 'bg-white/5 text-gray-300 border-white/10',
        destructive: 'bg-red-500/10 text-red-400 border-red-500/30',
        success: 'bg-green-500/10 text-green-400 border-green-500/30',
        warning: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
        info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        outline: 'bg-transparent text-gray-300 border-white/10',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
