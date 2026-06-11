import type { useForm } from 'react-hook-form'
import { Globe2, Building2 } from 'lucide-react'
import type { PricingRule } from '@/hooks/useAdminPricingRules'
import type { FormData, ScopeChoice } from './types'

export interface ScopeRadioProps {
  watchedScope: ScopeChoice
  register: ReturnType<typeof useForm<FormData>>['register']
  editingItem: PricingRule | null
  branchLocked: boolean
}

/** Radio chọn phạm vi GLOBAL vs THEATER override — chỉ hiện khi SUPER_ADMIN tạo mới. */
export function ScopeRadio({ watchedScope, register, editingItem, branchLocked }: ScopeRadioProps) {
  const editLocked = !!editingItem
  return (
    <div className="col-span-12">
      <label className="text-sm text-gray-400 mb-1.5 block">
        Phạm vi áp dụng <span className="text-red-400">*</span>
        {(branchLocked || editLocked) && <span className="text-xs text-gray-500 ml-2">(không thể đổi)</span>}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <ScopeOption
          value="GLOBAL"
          icon={<Globe2 size={16} className="text-[#ffc107]" />}
          title="Toàn hệ thống (default)"
          subtitle="Áp dụng mọi rạp nếu không có override"
          active={watchedScope === 'GLOBAL'}
          disabled={branchLocked || editLocked}
          register={register}
        />
        <ScopeOption
          value="THEATER"
          icon={<Building2 size={16} className="text-blue-400" />}
          title="Override theo chi nhánh"
          subtitle="Cùng mã sẽ thay rule toàn hệ tại rạp này"
          active={watchedScope === 'THEATER'}
          disabled={editLocked}
          register={register}
        />
      </div>
      {branchLocked && (
        <p className="text-gray-500 text-xs mt-1">
          Admin chi nhánh chỉ tạo override cho rạp mình.
        </p>
      )}
    </div>
  )
}

interface ScopeOptionProps {
  value: ScopeChoice
  icon: React.ReactNode
  title: string
  subtitle: string
  active: boolean
  disabled: boolean
  register: ReturnType<typeof useForm<FormData>>['register']
}

function ScopeOption({ value, icon, title, subtitle, active, disabled, register }: ScopeOptionProps) {
  const borderCls = active ? 'border-[#ffc107] bg-[#ffc107]/5' : 'border-white/10 bg-[#2a2317]'
  const disabledCls = disabled ? 'opacity-50 cursor-not-allowed' : ''
  return (
    <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border transition ${borderCls} ${disabledCls}`}>
      <input type="radio" value={value} {...register('scope')} disabled={disabled} className="accent-[#ffc107]" />
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <div className="text-sm font-medium text-white">{title}</div>
          <div className="text-xs text-gray-400">{subtitle}</div>
        </div>
      </div>
    </label>
  )
}

export interface ScopeReadOnlyBadgeProps {
  isGlobal: boolean
  theaterName?: string
}

/** Badge read-only hiển thị scope hiện tại trong edit mode — thay cho radio disabled rườm rà. */
export function ScopeReadOnlyBadge({ isGlobal, theaterName }: ScopeReadOnlyBadgeProps) {
  return (
    <div className="col-span-12">
      <label className="text-sm text-gray-400 mb-1.5 block">
        Phạm vi áp dụng
      </label>
      <div className="flex items-center gap-2 p-3 rounded-lg border border-white/10 bg-[#2a2317]/40">
        {isGlobal ? (
          <>
            <Globe2 size={16} className="text-[#ffc107] shrink-0" />
            <span className="text-white text-sm font-medium">Toàn hệ thống</span>
          </>
        ) : (
          <>
            <Building2 size={16} className="text-blue-400 shrink-0" />
            <span className="text-white text-sm font-medium">
              {theaterName ?? 'Chi nhánh cụ thể'}
            </span>
          </>
        )}
      </div>
      <p className="text-gray-500 text-xs mt-1">Không thể đổi phạm vi — tạo rule mới nếu cần.</p>
    </div>
  )
}
