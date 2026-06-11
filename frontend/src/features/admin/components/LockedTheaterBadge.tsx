import { Building2 } from 'lucide-react'
import type { Theater } from '@/hooks/useAdminTheaters'

export interface LockedTheaterBadgeProps {
  /** ID chi nhánh đã lock. */
  theaterId: number | null | undefined
  /** Danh sách theater để resolve tên (đã load sẵn ở component cha). */
  theaters: Theater[]
  /** True nếu user là branch ADMIN (chi nhánh gán theo tài khoản, không thể đổi). */
  isBranchAdmin: boolean
  /** True khi đang ở edit mode — hiển thị nhãn "không thể đổi" thay vì gợi ý đổi dropdown header. */
  isEdit?: boolean
}

/**
 * Badge subtle hiển thị chi nhánh đã lock — dùng thay cho dropdown disabled trong form.
 * UX rule: dropdown chỉ làm rối khi chỉ có 1 lựa chọn không thể đổi. Badge truyền tải
 * cùng thông tin mà không tốn không gian và không gợi ý sai rằng có thể chọn.
 */
export default function LockedTheaterBadge({
  theaterId, theaters, isBranchAdmin, isEdit,
}: LockedTheaterBadgeProps) {
  const theater = theaters.find(t => t.id === theaterId)
  const display = theater
    ? `${theater.name}${theater.city ? ` (${theater.city})` : ''}`
    : `Chi nhánh #${theaterId}`

  const hint = isEdit
    ? 'Không thể đổi chi nhánh — tạo mới nếu cần.'
    : isBranchAdmin
      ? 'Chi nhánh được gán theo tài khoản.'
      : 'Đổi ở dropdown trên cùng nếu cần tạo cho chi nhánh khác.'

  return (
    <div className="col-span-12">
      <label className="text-sm text-gray-400 mb-1.5 block">
        Chi nhánh <span className="text-red-400">*</span>
      </label>
      <div className="flex items-center gap-2 p-3 rounded-lg border border-white/10 bg-[#2a2317]/40">
        <Building2 size={16} className="text-[#ffc107] shrink-0" />
        <span className="text-white text-sm font-medium">{display}</span>
      </div>
      <p className="text-gray-500 text-xs mt-1">{hint}</p>
    </div>
  )
}
