import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'

import { useCreatePricingRule, useUpdatePricingRule } from '@/hooks/useAdmin'
import { useTheaterOptions, type Theater } from '@/hooks/useAdminTheaters'
import type { PricingRule } from '@/hooks/useAdminPricingRules'
import LockedTheaterBadge from './LockedTheaterBadge'

import { ScopeRadio, ScopeReadOnlyBadge } from './pricing/ScopeSelector'
import { DayOfWeekPicker, HourRangeInputs, DateRangeInputs } from './pricing/RuleConditionInputs'
import { type FormData, type ScopeChoice, RULE_TYPE_LABELS, SELECT_CLS } from './pricing/types'

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
 *
 * Sub-components: ./pricing/ScopeSelector + ./pricing/RuleConditionInputs.
 */
export default function PricingRuleFormDialog({
  open, onOpenChange, editingItem, scopedTheaterId, branchLocked, userTheaterId,
}: PricingRuleFormDialogProps) {
  const { data: theaters = [] } = useTheaterOptions()
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
      updateMut.mutate({ id: editingItem.id, data: payload }, { onSuccess: () => onOpenChange(false) })
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
                <DayOfWeekPicker selectedDays={selectedDays} onToggle={toggleDay} register={register} />
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
