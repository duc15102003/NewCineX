import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Globe2, Building2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PriceInput } from '@/components/ui/price-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'

import { useCreateVoucher, useUpdateVoucher } from '@/hooks/useAdmin'
import { useTheaterOptions, type Theater } from '@/hooks/useAdminTheaters'
import type { AdminVoucher } from '@/hooks/useAdminVouchers'
import LockedTheaterBadge from './LockedTheaterBadge'
import { FEATURES } from '@/config/featureFlags'

const SELECT_CLS =
  'w-full h-10 rounded-lg border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

/** Preset khoảng thời gian voucher — admin set "hôm nay → N ngày" nhanh. */
const VOUCHER_RANGE_PRESETS = [
  { label: '7 ngày', days: 7 },
  { label: '14 ngày', days: 14 },
  { label: '30 ngày', days: 30 },
  { label: '60 ngày', days: 60 },
  { label: '90 ngày', days: 90 },
] as const

/** Format Date → "YYYY-MM-DDTHH:mm" cho input datetime-local (local TZ, không UTC). */
function toLocalDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type ScopeChoice = 'GLOBAL' | 'THEATER'

interface VoucherFormData {
  scope: ScopeChoice
  theaterId: number | ''
  code: string
  description: string
  discountType: string
  discountValue: number
  minOrderAmount: number
  maxDiscount: number
  usageLimit: number
  startDate: string
  endDate: string
}

export interface VoucherFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = create mode, có giá trị = edit mode */
  editingItem: AdminVoucher | null
  /** Theater scope từ adminTheaterStore hoặc userTheaterId (branch admin). null = SUPER_ADMIN xem "Tất cả". */
  scopedTheaterId: number | null
  /** Branch admin: form lock scope = THEATER, không cho đổi sang GLOBAL */
  branchLocked: boolean
}

/**
 * Dialog tạo/sửa Voucher với hybrid scope (Global vs Theater).
 *
 * <p>Tách ra component riêng (SRP): Page chỉ lo list + filter, Dialog lo form + submit.
 * Mutations (create/update) sống trong Dialog — sau khi save thành công React Query
 * tự invalidate cache nên Page list refresh không cần callback thủ công.
 */
export default function VoucherFormDialog({
  open, onOpenChange, editingItem, scopedTheaterId, branchLocked,
}: VoucherFormDialogProps) {
  const { data: theaters = [] } = useTheaterOptions()
  const createMut = useCreateVoucher()
  const updateMut = useUpdateVoucher()

  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<VoucherFormData>()
  const discountType = watch('discountType')
  const watchedScope = watch('scope')

  // Reset form khi dialog mở — phụ thuộc cả `open` và `editingItem` để chuyển đúng mode
  useEffect(() => {
    if (!open) return
    if (editingItem) {
      reset({
        scope: editingItem.theaterId == null ? 'GLOBAL' : 'THEATER',
        theaterId: editingItem.theaterId ?? '',
        code: editingItem.code,
        description: editingItem.description ?? '',
        discountType: editingItem.discountType ?? 'PERCENTAGE',
        discountValue: editingItem.discountValue ?? 0,
        minOrderAmount: editingItem.minOrderAmount ?? 0,
        maxDiscount: editingItem.maxDiscount ?? 0,
        usageLimit: editingItem.usageLimit ?? 0,
        startDate: editingItem.startDate ? editingItem.startDate.slice(0, 16) : '',
        endDate: editingItem.endDate ? editingItem.endDate.slice(0, 16) : '',
      })
    } else {
      // Create mode: branch admin → THEATER mặc định, SUPER_ADMIN → GLOBAL mặc định
      const defaultScope: ScopeChoice = branchLocked ? 'THEATER' : 'GLOBAL'
      reset({
        scope: defaultScope,
        theaterId: (scopedTheaterId ?? '') as number | '',
        code: '', description: '', discountType: 'PERCENTAGE',
        discountValue: 0, minOrderAmount: 0, maxDiscount: 0,
        usageLimit: 0, startDate: '', endDate: '',
      })
    }
  }, [open, editingItem, branchLocked, scopedTheaterId, reset])

  function onSubmit(data: VoucherFormData) {
    if (!validateBusinessRules(data)) return

    const payload = {
      theaterId: data.scope === 'GLOBAL' ? null : Number(data.theaterId),
      code: data.code,
      description: data.description,
      discountType: data.discountType,
      discountValue: Number(data.discountValue),
      minOrderAmount: Number(data.minOrderAmount),
      maxDiscount: Number(data.maxDiscount),
      usageLimit: Number(data.usageLimit),
      startDate: data.startDate,
      endDate: data.endDate,
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
          <DialogTitle>{editingItem ? 'Chỉnh sửa voucher' : 'Thêm mới voucher'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            <div className="grid grid-cols-12 gap-4">
              {/* Scope radio chỉ hiện khi SUPER_ADMIN tạo mới — branch admin luôn THEATER, edit không cho đổi scope */}
              {!branchLocked && !editingItem && (
                <ScopeRadio
                  watchedScope={watchedScope}
                  register={register}
                  editingItem={editingItem}
                  branchLocked={branchLocked}
                />
              )}

              {/* Edit mode: hiển thị scope hiện tại dưới dạng badge read-only thay vì radio disabled */}
              {editingItem && (
                <ScopeReadOnlyBadge
                  isGlobal={editingItem.theaterId == null}
                  theaterName={editingItem.theaterName ?? undefined}
                />
              )}

              {watchedScope === 'THEATER' && !editingItem && (
                branchLocked || scopedTheaterId != null ? (
                  <>
                    {/* Single-tenant (cinex-team): ẨN badge để không lộ multi-tenant.
                        Hidden input vẫn submit theaterId từ form defaultValues. */}
                    {FEATURES.multiTheater && (
                      <LockedTheaterBadge
                        theaterId={scopedTheaterId}
                        theaters={theaters}
                        isBranchAdmin={branchLocked}
                      />
                    )}
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

              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Mã voucher <span className="text-red-400">*</span></label>
                {/* Constraint phải KHỚP với HoldSeatsRequest.voucherCode regex
                    `^[A-Z0-9-]{3,20}$` — nếu để rộng, admin tạo được voucher mà
                    user click áp dụng + giữ ghế sẽ bị BE reject với message:
                    "Mã voucher chỉ gồm chữ in hoa, số và dấu gạch ngang, 3-20 ký tự". */}
                <Input {...register('code', {
                  required: 'Mã voucher là bắt buộc',
                  pattern: {
                    value: /^[A-Z0-9-]{3,20}$/,
                    message: 'Chỉ chữ hoa, số, dấu gạch ngang; độ dài 3-20 ký tự',
                  },
                  onChange: (e) => { e.target.value = e.target.value.toUpperCase() },
                })}
                  disabled={!!editingItem} className="font-mono uppercase"
                  placeholder="VD: WELCOME10, SUMMER-2026" />
                {errors.code && <p className="text-red-400 text-xs mt-1">{String(errors.code.message)}</p>}
                {!editingItem && <p className="text-gray-500 text-xs mt-1">Chỉ A-Z, 0-9 và dấu gạch ngang (-), 3-20 ký tự</p>}
                {editingItem && <p className="text-gray-500 text-xs mt-1">Không thể đổi mã — tạo voucher mới nếu cần</p>}
              </div>
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Mô tả</label>
                <Textarea {...register('description')} rows={3} />
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Loại giảm giá <span className="text-red-400">*</span></label>
                <select {...register('discountType')} className={SELECT_CLS}>
                  <option value="PERCENTAGE">Phần trăm (%)</option>
                  <option value="FIXED_AMOUNT">Số tiền cố định</option>
                </select>
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Giá trị giảm <span className="text-red-400">*</span></label>
                {discountType === 'PERCENTAGE' ? (
                  <div className="relative">
                    <Input
                      type="number"
                      {...register('discountValue', {
                        required: 'Giá trị giảm là bắt buộc',
                        min: { value: 1, message: 'Giá trị phải >= 1' },
                        max: { value: 100, message: 'Tối đa 100%' },
                      })}
                      placeholder="VD: 20"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
                  </div>
                ) : (
                  <Controller
                    name="discountValue"
                    control={control}
                    rules={{ required: 'Giá trị giảm là bắt buộc', min: { value: 1, message: 'Giá trị phải > 0' } }}
                    render={({ field }) => (
                      <PriceInput value={field.value} onChange={field.onChange} placeholder="VD: 50.000" />
                    )}
                  />
                )}
                {errors.discountValue && <p className="text-red-400 text-xs mt-1">{String(errors.discountValue.message)}</p>}
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Đơn tối thiểu</label>
                <Controller
                  name="minOrderAmount"
                  control={control}
                  rules={{ min: 0 }}
                  render={({ field }) => (
                    <PriceInput value={field.value} onChange={field.onChange} placeholder="VD: 100.000" />
                  )}
                />
              </div>
              {/* "Giảm tối đa" chỉ có nghĩa khi loại = Phần trăm (cap số tiền giảm
                  để tránh đơn lớn được giảm quá nhiều). Loại Số tiền cố định
                  thì giá trị giảm CHÍNH LÀ giá trị giảm — không có max. */}
              {discountType === 'PERCENTAGE' && (
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">
                    Giảm tối đa <span className="text-gray-600 text-xs font-normal">(cap số tiền)</span>
                  </label>
                  <Controller
                    name="maxDiscount"
                    control={control}
                    rules={{ min: 0 }}
                    render={({ field }) => (
                      <PriceInput value={field.value} onChange={field.onChange} placeholder="VD: 200.000" />
                    )}
                  />
                  <p className="text-[11px] text-gray-600 mt-1">VD: giảm 20% nhưng tối đa 200k → đơn 2 triệu vẫn chỉ giảm 200k.</p>
                </div>
              )}
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Giới hạn lượt dùng (0 = không giới hạn)</label>
                <Input type="number" {...register('usageLimit', { min: 0 })} />
              </div>
              {/* Preset khoảng thời gian — admin thường set "hôm nay → 30/60/90 ngày",
                  cung cấp chip thay vì gõ tay từng datetime-local. */}
              <div className="col-span-12">
                <Label className="text-xs text-gray-400 mb-1.5 block">Chọn nhanh khoảng thời gian</Label>
                <div className="flex flex-wrap gap-1.5">
                  {VOUCHER_RANGE_PRESETS.map(p => (
                    <button key={p.label} type="button"
                      onClick={() => {
                        const now = new Date()
                        const end = new Date(now); end.setDate(end.getDate() + p.days)
                        setValue('startDate', toLocalDateTime(now))
                        setValue('endDate', toLocalDateTime(end))
                      }}
                      className="px-2.5 py-1 rounded-md text-xs font-medium border bg-[#2a2317] text-gray-300 border-white/10 hover:bg-[#ffc107]/10 hover:text-[#ffc107] hover:border-[#ffc107]/40 transition-colors">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Ngày bắt đầu <span className="text-red-400">*</span></label>
                <Input type="datetime-local" {...register('startDate', { required: 'Ngày bắt đầu là bắt buộc' })} className="[color-scheme:dark]" style={{ colorScheme: 'dark' }} />
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Ngày kết thúc <span className="text-red-400">*</span></label>
                <Input type="datetime-local" {...register('endDate', { required: 'Ngày kết thúc là bắt buộc' })} className="[color-scheme:dark]" style={{ colorScheme: 'dark' }} />
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
  register: ReturnType<typeof useForm<VoucherFormData>>['register']
  editingItem: AdminVoucher | null
  branchLocked: boolean
}

/**
 * Radio scope GLOBAL vs THEATER. Disabled cho branch admin và khi edit.
 * Tách sub-component để JSX cha dễ đọc hơn (~50 dòng → 10).
 */
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
          title="Toàn hệ thống"
          subtitle="Áp dụng mọi chi nhánh"
          active={watchedScope === 'GLOBAL'}
          disabled={branchLocked || editLocked}
          register={register}
        />
        <ScopeOption
          value="THEATER"
          icon={<Building2 size={16} className="text-blue-400" />}
          title="Chi nhánh cụ thể"
          subtitle="Chỉ áp dụng tại 1 rạp"
          active={watchedScope === 'THEATER'}
          disabled={editLocked}
          register={register}
        />
      </div>
      {branchLocked && (
        <p className="text-gray-500 text-xs mt-1">
          Admin chi nhánh chỉ tạo được voucher cho rạp của mình.
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
  register: ReturnType<typeof useForm<VoucherFormData>>['register']
}

function ScopeOption({ value, icon, title, subtitle, active, disabled, register }: ScopeOptionProps) {
  const borderCls = active ? 'border-[#ffc107] bg-[#ffc107]/5' : 'border-white/10 bg-[#2a2317]'
  const disabledCls = disabled ? 'opacity-50 cursor-not-allowed' : ''
  return (
    <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border transition ${borderCls} ${disabledCls}`}>
      <input
        type="radio"
        value={value}
        {...register('scope')}
        disabled={disabled}
        className="accent-[#ffc107]"
      />
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
      <p className="text-gray-500 text-xs mt-1">Không thể đổi phạm vi — tạo voucher mới nếu cần.</p>
    </div>
  )
}

// ============================================================
//  Business validation
// ============================================================

/** Validate business rules client-side (BE cũng validate). Return false + toast nếu lỗi. */
function validateBusinessRules(data: VoucherFormData): boolean {
  if (data.discountType === 'PERCENTAGE' && Number(data.discountValue) > 100) {
    toast.error('Phần trăm giảm giá không được vượt quá 100%')
    return false
  }
  if (data.discountType === 'FIXED_AMOUNT' && data.minOrderAmount
      && Number(data.discountValue) > Number(data.minOrderAmount)) {
    toast.error('Giá trị giảm không được lớn hơn đơn tối thiểu')
    return false
  }
  if (data.maxDiscount && data.minOrderAmount
      && Number(data.maxDiscount) > Number(data.minOrderAmount)) {
    toast.error('Giảm tối đa không được lớn hơn đơn tối thiểu')
    return false
  }
  if (data.startDate && data.endDate && data.endDate <= data.startDate) {
    toast.error('Ngày kết thúc phải sau ngày bắt đầu')
    return false
  }
  if (data.scope === 'THEATER' && !data.theaterId) {
    toast.error('Vui lòng chọn chi nhánh áp dụng')
    return false
  }
  return true
}
