import * as React from 'react'
import { X, Filter as FilterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * FilterDrawer — drawer trượt từ phải, dùng cho mọi trang admin cần "Lọc nâng cao".
 *
 * Vì project chưa cài `shadcn/sheet`, component dùng portal-less overlay tự build:
 *  - Backdrop bg-black/50 — click để đóng.
 *  - Panel cố định bên phải, w-full max-w-md, full height.
 *  - Body scrollable, footer có 2 nút Reset + Áp dụng.
 *
 * Props rõ nghĩa cho việc tái sử dụng:
 *  - open / onOpenChange: state mở/đóng (controlled)
 *  - title: tiêu đề drawer
 *  - onApply: callback khi user bấm "Áp dụng" — page tự áp filter
 *  - onReset: callback khi user bấm "Đặt lại" — page tự clear filter
 *  - activeCount: số filter đang áp dụng — hiển thị badge trên trigger button
 */

interface FilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: React.ReactNode
  onApply?: () => void
  onReset?: () => void
  applyLabel?: string
  resetLabel?: string
}

export default function FilterDrawer({
  open,
  onOpenChange,
  title = 'Lọc nâng cao',
  children,
  onApply,
  onReset,
  applyLabel = 'Áp dụng',
  resetLabel = 'Đặt lại',
}: FilterDrawerProps) {
  // Lock scroll body khi mở
  React.useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ESC để đóng
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full max-w-md',
          // Admin Dark Brown theme: card surface #201b11, bo góc rounded-2xl ở mép trái
          'bg-[#201b11] border-l border-white/5 text-white shadow-xl rounded-l-2xl',
          'flex flex-col',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-md text-gray-400 hover:bg-white/5 hover:text-white"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/5">
          {onReset && (
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              className="border-white/10 text-gray-300 hover:bg-white/5"
            >
              {resetLabel}
            </Button>
          )}
          {onApply && (
            <Button
              type="button"
              onClick={onApply}
              className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
            >
              {applyLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Trigger button kèm badge đếm filter — dùng chung trên toolbar.
 */
interface FilterTriggerProps {
  onClick: () => void
  activeCount?: number
  label?: string
}

export function FilterTrigger({ onClick, activeCount = 0, label = 'Lọc nâng cao' }: FilterTriggerProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="border-white/10 text-gray-300 hover:bg-white/5 relative"
    >
      <FilterIcon size={16} className="mr-1.5" />
      {label}
      {activeCount > 0 && (
        <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-[#ffc107] text-black">
          {activeCount}
        </span>
      )}
    </Button>
  )
}

/**
 * Field wrapper — label + control consistent.
 */
export function FilterField({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1.5 block font-medium uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}
