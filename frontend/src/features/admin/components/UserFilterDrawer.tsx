import FilterDrawer, { FilterField } from '@/components/common/FilterDrawer'
import { Input } from '@/components/ui/input'
import type { AdminUserFilter } from '@/hooks/useAdminUsers'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

export interface UserFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftFilter: AdminUserFilter
  onPatchDraft: (patch: Partial<AdminUserFilter>) => void
  onApply: () => void
  onReset: () => void
}

/** Filter cho user: role, enabled, createdFrom/To, includeDeleted. */
export default function UserFilterDrawer(props: UserFilterDrawerProps) {
  const { open, onOpenChange, draftFilter, onPatchDraft, onApply, onReset } = props
  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Lọc người dùng"
      onApply={onApply}
      onReset={onReset}
    >
      <FilterField label="Vai trò">
        <select
          value={draftFilter.role ?? ''}
          onChange={(e) => onPatchDraft({ role: (e.target.value || '') as AdminUserFilter['role'] })}
          className={SELECT_CLS}
        >
          <option value="">Tất cả</option>
          <option value="USER">Người dùng</option>
          <option value="ADMIN">Quản trị viên chi nhánh</option>
          <option value="SUPER_ADMIN">Quản trị tổng</option>
        </select>
      </FilterField>

      <FilterField label="Trạng thái tài khoản">
        <select
          value={draftFilter.enabled === undefined ? '' : String(draftFilter.enabled)}
          onChange={(e) => {
            const v = e.target.value
            onPatchDraft({ enabled: v === '' ? undefined : v === 'true' })
          }}
          className={SELECT_CLS}
        >
          <option value="">Tất cả</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Bị khóa</option>
        </select>
      </FilterField>

      <FilterField label="Đăng ký từ ngày">
        <Input
          type="datetime-local"
          value={draftFilter.createdFrom ?? ''}
          onChange={(e) => onPatchDraft({ createdFrom: e.target.value })}
        />
      </FilterField>

      <FilterField label="Đăng ký đến ngày">
        <Input
          type="datetime-local"
          value={draftFilter.createdTo ?? ''}
          onChange={(e) => onPatchDraft({ createdTo: e.target.value })}
        />
      </FilterField>

      <FilterField label="Bao gồm đã lưu trữ" hint="Hiển thị cả bản ghi đã bị xoá mềm (ARCHIVED).">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!draftFilter.includeDeleted}
            onChange={(e) => onPatchDraft({ includeDeleted: e.target.checked })}
            className="accent-[#ffc107] w-4 h-4"
          />
          <span className="text-sm text-gray-300">Hiển thị tài khoản đã lưu trữ</span>
        </label>
      </FilterField>
    </FilterDrawer>
  )
}
