import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Globe2, Building2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'

import { useCreatePricingRule, useUpdatePricingRule } from '@/hooks/useAdmin'
import { useTheaterOptions, type Theater } from '@/hooks/useAdminTheaters'
import { useAuthStore } from '@/store/authStore'
import type { PricingRule, PricingRuleType } from '@/hooks/useAdminPricingRules'
import LockedTheaterBadge from './LockedTheaterBadge'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

const RULE_TYPE_LABELS: Record<PricingRuleType, string> = {
  DAY_OF_WEEK: 'Theo thứ trong tuần',
  HOUR_RANGE: 'Theo khung giờ',
  DATE_RANGE: 'Theo khoảng ngày',
  COMPOSITE: 'Kết hợp (AND)',
}

const DAY_OPTIONS = [
  { value: 'MONDAY', label: 'T2' },
  { value: 'TUESDAY', label: 'T3' },
  { value: 'WEDNESDAY', label: 'T4' },
  { value: 'THURSDAY', label: 'T5' },
  { value: 'FRIDAY', label: 'T6' },
  { value: 'SATURDAY', label: 'T7' },
  { value: 'SUNDAY', label: 'CN' },
]

type ScopeChoice = 'GLOBAL' | 'THEATER'

interface FormData {
  scope: ScopeChoice
  theaterId: number | ''
  code: string
  name: string
  description: string
  ruleType: PricingRuleType
  multiplierPercent: string
  dayOfWeek: string
  hourStart: string
  hourEnd: string
  dateStart: string
  dateEnd: string
  active: boolean
  priority: string
}

export interface PricingRuleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingItem: PricingRule | null
  scopedTheaterId: number | null
  branchLocked: boolean
  userTheaterId: number | null
}

/**
 * Dialog tạo/sửa PricingRule với hybrid scope (Global default vs Theater override).
 * Pattern resolution: cùng code → theater-specific WIN (override toàn bộ global).
 */
export default function PricingRuleFormDialog({
  open, onOpenChange, editingItem, scopedTheaterId, branchLocked, userTheaterId,
}: PricingRuleFormDialogProps) {
  const { data: theaters = [] } = useTheaterOptions()
  const { isBranchAdmin } = useAuthStore()
  const createMut = useCreatePricingRule()
  const updateMut = useUpdatePricingRule()

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>()
  const selectedType = watch('ruleType')
  const watchedScope = watch('scope')
  const selectedDays = (watch('dayOfWeek') ?? '').split(',').filter(Boolean)

  useEffect(() => {
    if (!open) return
    if (editingItem) {
      reset({
        scope: editingItem.theaterId == null ? 'GLOBAL' : 'THEATER',
        theaterId: editingItem.theaterId ?? '',
        code: editingItem.code,
        name: editingItem.name,
        description: editingItem.description ?? '',
        ruleType: editingItem.ruleType,
        multiplierPercent: String(editingItem.multiplierPercent),
        dayOfWeek: editingItem.dayOfWeek ?? '',
        hourStart: editingItem.hourStart != null ? String(editingItem.hourStart) : '',
        hourEnd: editingItem.hourEnd != null ? String(editingItem.hourEnd) : '',
        dateStart: editingItem.dateStart ?? '',
        dateEnd: editingItem.dateEnd ?? '',
        active: editingItem.active,
        priority: String(editingItem.priority),
      })
    } else {
      const defaultScope: ScopeChoice = branchLocked ? 'THEATER' : 'GLOBAL'
      const fallbackTheaterId = branchLocked
        ? (userTheaterId ?? '')
        : (scopedTheaterId ?? '')
      reset({
        scope: defaultScope,
        theaterId: fallbackTheaterId as number | '',
        code: '', name: '', description: '', ruleType: 'HOUR_RANGE',
        multiplierPercent: '110.00', dayOfWeek: '', hourStart: '', hourEnd: '',
        dateStart: '', dateEnd: '', active: true, priority: '100',
      })
    }
  }, [open, editingItem, branchLocked, scopedTheaterId, userTheaterId, reset])

  function toggleDay(day: string) {
    const days = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day]
    setValue('dayOfWeek', days.join(','))
  }

  function onSubmit(data: FormData) {
    if (data.scope === 'THEATER' && !data.theaterId) {
      toast.error('Vui lòng chọn chi nhánh áp dụng')
      return
    }
    const payload: Record<string, unknown> = {
      theaterId: data.scope === 'GLOBAL' ? null : Number(data.theaterId),
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      description: data.description.trim() || null,
      ruleType: data.ruleType,
      multiplierPercent: Number(data.multiplierPercent),
      dayOfWeek: data.dayOfWeek || null,
      hourStart: data.hourStart ? Number(data.hourStart) : null,
      hourEnd: data.hourEnd ? Number(data.hourEnd) : null,
      dateStart: data.dateStart || null,
      dateEnd: data.dateEnd || null,
      active: data.active,
      priority: Number(data.priority),
    }
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, data: payload },
        { onSuccess: () => onOpenChange(false) })
    } else {
      createMut.mutate(payload, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Chỉnh sửa rule' : 'Thêm rule mới'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            <div className="grid grid-cols-12 gap-4">
              {/* Scope radio chỉ hiện khi SUPER_ADMIN tạo mới — branch admin luôn THEATER, edit không cho đổi */}
              {!branchLocked && !editingItem && (
                <ScopeRadio
                  watchedScope={watchedScope}
                  register={register}
                  editingItem={editingItem}
                  branchLocked={branchLocked}
                />
              )}

              {editingItem && (
                <ScopeReadOnlyBadge
                  isGlobal={editingItem.theaterId == null}
                  theaterName={editingItem.theaterName ?? undefined}
                />
              )}

              {watchedScope === 'THEATER' && !editingItem && (
                branchLocked || scopedTheaterId != null ? (
                  <>
                    <LockedTheaterBadge
                      theaterId={branchLocked ? userTheaterId : scopedTheaterId}
                      theaters={theaters}
                      isBranchAdmin={branchLocked}
                    />
                    <input type="hidden" {...register('theaterId')} />
                  </>
                ) : (
                  <div className="col-span-12">
                    <label className="text-sm text-gray-400 mb-1.5 block">
                      Chi nhánh áp dụng <span className="text-red-400">*</span>
                    </label>
                    <select {...register('theaterId')} className={SELECT_CLS}>
                      <option value="">-- Chọn chi nhánh --</option>
                      {theaters.map((t: Theater) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.city})</option>
                      ))}
                    </select>
                  </div>
                )
              )}

              <div className="col-span-4">
                <label className="text-sm text-gray-400 mb-1.5 block">Mã <span className="text-red-400">*</span></label>
                <Input {...register('code', {
                  required: 'Mã là bắt buộc',
                  pattern: { value: /^[A-Z0-9-]+$/, message: 'A-Z, 0-9, -' },
                })} disabled={!!editingItem} placeholder="WEEKEND" className="font-mono uppercase" />
                {errors.code && <p className="text-red-400 text-xs mt-1">{String(errors.code.message)}</p>}
              </div>
              <div className="col-span-8">
                <label className="text-sm text-gray-400 mb-1.5 block">Tên <span className="text-red-400">*</span></label>
                <Input {...register('name', { required: 'Tên là bắt buộc' })} placeholder="VD: Phụ thu cuối tuần" />
                {errors.name && <p className="text-red-400 text-xs mt-1">{String(errors.name.message)}</p>}
              </div>
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Mô tả (hiển thị cho user)</label>
                <Textarea {...register('description')} rows={2} placeholder="VD: Thứ 7, Chủ nhật tăng giá 10%" />
              </div>
              <div className="col-span-4">
                <label className="text-sm text-gray-400 mb-1.5 block">Loại rule <span className="text-red-400">*</span></label>
                <select {...register('ruleType', { required: true })} className={SELECT_CLS}>
                  {Object.entries(RULE_TYPE_LABELS).map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
                </select>
              </div>
              <div className="col-span-4">
                <label className="text-sm text-gray-400 mb-1.5 block">Hệ số (%) <span className="text-red-400">*</span></label>
                <Input type="number" step="0.01" {...register('multiplierPercent', { required: true })} placeholder="110.00 = +10%" />
                <p className="text-gray-500 text-xs mt-1">100 = giữ nguyên; 110 = +10%; 80 = giảm 20%</p>
              </div>
              <div className="col-span-4">
                <label className="text-sm text-gray-400 mb-1.5 block">Độ ưu tiên</label>
                <Input type="number" {...register('priority')} placeholder="100" />
              </div>

              {(selectedType === 'DAY_OF_WEEK' || selectedType === 'COMPOSITE') && (
                <DayOfWeekPicker
                  selectedDays={selectedDays}
                  onToggle={toggleDay}
                  register={register}
                />
              )}

              {(selectedType === 'HOUR_RANGE' || selectedType === 'COMPOSITE') && (
                <HourRangeInputs register={register} />
              )}

              {(selectedType === 'DATE_RANGE' || selectedType === 'COMPOSITE') && (
                <DateRangeInputs register={register} />
              )}

              <div className="col-span-12">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('active')} className="accent-[#ffc107] w-4 h-4" />
                  <span className="text-sm text-gray-300">Bật rule (áp dụng cho booking mới)</span>
                </label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}
              className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
            <Button type="submit" className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
              disabled={createMut.isPending || updateMut.isPending}>Lưu</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
//  Sub-components
// ============================================================

interface ScopeRadioProps {
  watchedScope: ScopeChoice
  register: ReturnType<typeof useForm<FormData>>['register']
  editingItem: PricingRule | null
  branchLocked: boolean
}

function ScopeRadio({ watchedScope, register, editingItem, branchLocked }: ScopeRadioProps) {
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

interface ScopeReadOnlyBadgeProps {
  isGlobal: boolean
  theaterName?: string
}

/** Badge read-only hiển thị scope hiện tại trong edit mode — thay cho radio disabled rườm rà. */
function ScopeReadOnlyBadge({ isGlobal, theaterName }: ScopeReadOnlyBadgeProps) {
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

interface DayOfWeekPickerProps {
  selectedDays: string[]
  onToggle: (day: string) => void
  register: ReturnType<typeof useForm<FormData>>['register']
}

function DayOfWeekPicker({ selectedDays, onToggle, register }: DayOfWeekPickerProps) {
  return (
    <div className="col-span-12">
      <label className="text-sm text-gray-400 mb-1.5 block">Áp dụng cho các thứ</label>
      <div className="flex flex-wrap gap-2">
        {DAY_OPTIONS.map(d => {
          const selected = selectedDays.includes(d.value)
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => onToggle(d.value)}
              className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                selected
                  ? 'bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30'
                  : 'bg-[#2a2317] text-gray-400 border-white/10 hover:text-white'
              }`}
            >
              {d.label}
            </button>
          )
        })}
      </div>
      {/* Hidden input để form data nhận giá trị join */}
      <input type="hidden" {...register('dayOfWeek')} />
    </div>
  )
}

interface HourRangeInputsProps {
  register: ReturnType<typeof useForm<FormData>>['register']
}

function HourRangeInputs({ register }: HourRangeInputsProps) {
  return (
    <>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">Giờ bắt đầu</label>
        <Input type="number" min={0} max={23} {...register('hourStart')} placeholder="18" />
      </div>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">Giờ kết thúc</label>
        <Input type="number" min={0} max={24} {...register('hourEnd')} placeholder="22" />
      </div>
    </>
  )
}

interface DateRangeInputsProps {
  register: ReturnType<typeof useForm<FormData>>['register']
}

function DateRangeInputs({ register }: DateRangeInputsProps) {
  return (
    <>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">Ngày bắt đầu</label>
        <Input type="date" {...register('dateStart')} />
      </div>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">Ngày kết thúc</label>
        <Input type="date" {...register('dateEnd')} />
      </div>
    </>
  )
}
