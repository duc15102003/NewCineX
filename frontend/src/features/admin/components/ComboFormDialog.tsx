import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PriceInput } from '@/components/ui/price-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'

import { useCreateCombo, useUpdateCombo, useSnacksOptions } from '@/hooks/useAdminCombos'
import { useTheaterOptions, type Theater } from '@/hooks/useAdminTheaters'
import { useAuthStore } from '@/store/authStore'
import type { Combo } from '@/hooks/useAdminCombos'
import LockedTheaterBadge from './LockedTheaterBadge'
import { fmtVnd } from '@/utils/labels'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

const SELECT_SM_CLS =
  'w-full h-9 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-2 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

interface FormData {
  theaterId: number | ''
  code: string
  name: string
  description: string
  imageUrl: string
  price: number
  active: boolean
  items: Array<{ snackId: number | ''; quantity: number }>
}

export interface ComboFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingItem: Combo | null
  scopedTheaterId: number | null
  theaterLocked: boolean
}

/**
 * Dialog tạo/sửa Combo với chained dropdown:
 * theater → snack list (chỉ snack cùng theater được phép bundle).
 *
 * Khi đổi theater (create flow), items bị reset vì snack list khác hoàn toàn.
 */
export default function ComboFormDialog({
  open, onOpenChange, editingItem, scopedTheaterId, theaterLocked,
}: ComboFormDialogProps) {
  const { data: theaters = [] } = useTheaterOptions()
  const { isBranchAdmin } = useAuthStore()
  const createMut = useCreateCombo()
  const updateMut = useUpdateCombo()

  const { register, control, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<FormData>({ defaultValues: { theaterId: '', items: [{ snackId: '', quantity: 1 }] } })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  // Snacks dropdown phụ thuộc theaterId trong form (chained)
  const watchedTheaterId = watch('theaterId')
  const formTheaterId = watchedTheaterId === '' ? null : Number(watchedTheaterId)
  const { data: snacks = [] } = useSnacksOptions(formTheaterId)

  // Reset form khi mở dialog
  useEffect(() => {
    if (!open) return
    if (editingItem) {
      reset({
        theaterId: editingItem.theaterId ?? '',
        code: editingItem.code,
        name: editingItem.name,
        description: editingItem.description ?? '',
        imageUrl: editingItem.imageUrl ?? '',
        price: editingItem.price,
        active: editingItem.active,
        items: editingItem.items.map(i => ({ snackId: i.snackId, quantity: i.quantity })),
      })
    } else {
      reset({
        theaterId: (scopedTheaterId ?? '') as number | '',
        code: '', name: '', description: '', imageUrl: '', price: 0, active: true,
        items: [{ snackId: '', quantity: 1 }],
      })
    }
  }, [open, editingItem, scopedTheaterId, reset])

  // Khi đổi theater (create flow), reset items vì snack list khác.
  // Track lastTheaterId để chỉ reset khi user thực sự đổi (không reset lần đầu mở dialog).
  const [lastTheaterId, setLastTheaterId] = useState<number | null>(null)
  useEffect(() => {
    if (editingItem) return  // edit flow: theater locked, không reset
    if (formTheaterId !== lastTheaterId) {
      setValue('items', [{ snackId: '', quantity: 1 }])
      setLastTheaterId(formTheaterId)
    }
  }, [formTheaterId, editingItem, lastTheaterId, setValue])

  function onSubmit(data: FormData) {
    if (!validateBusinessRules(data)) return

    const payload: Record<string, unknown> = {
      theaterId: Number(data.theaterId),
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      description: data.description.trim() || null,
      imageUrl: data.imageUrl.trim() || null,
      price: Number(data.price),
      active: data.active,
      items: data.items.map(i => ({ snackId: Number(i.snackId), quantity: Number(i.quantity) })),
    }
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, data: payload },
        { onSuccess: () => onOpenChange(false) })
    } else {
      createMut.mutate(payload, { onSuccess: () => onOpenChange(false) })
    }
  }

  // Calculate regular price + savings preview
  const watchedItems = watch('items')
  const watchedPrice = watch('price')
  const regularPrice = watchedItems.reduce((sum, item) => {
    const snack = snacks.find(s => s.id === Number(item.snackId))
    return sum + (snack?.price ?? 0) * Number(item.quantity ?? 0)
  }, 0)
  const savings = regularPrice - Number(watchedPrice ?? 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Chỉnh sửa combo' : 'Thêm combo mới'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            <div className="grid grid-cols-12 gap-4">
              {(editingItem || theaterLocked) ? (
                <>
                  <LockedTheaterBadge
                    theaterId={editingItem ? editingItem.theaterId : scopedTheaterId}
                    theaters={theaters}
                    isBranchAdmin={isBranchAdmin()}
                    isEdit={!!editingItem}
                  />
                  <input type="hidden" {...register('theaterId', { valueAsNumber: true })} />
                </>
              ) : (
                <TheaterSelect
                  register={register}
                  errors={errors}
                  theaters={theaters}
                />
              )}

              <div className="col-span-4">
                <label className="text-sm text-gray-400 mb-1.5 block">Mã <span className="text-red-400">*</span></label>
                <Input {...register('code', {
                  required: 'Mã là bắt buộc',
                  pattern: { value: /^[A-Z0-9-]+$/, message: 'A-Z, 0-9, -' },
                })} disabled={!!editingItem} placeholder="COMBO-FAMILY" className="font-mono uppercase" />
                {errors.code && <p className="text-red-400 text-xs mt-1">{String(errors.code.message)}</p>}
              </div>
              <div className="col-span-8">
                <label className="text-sm text-gray-400 mb-1.5 block">Tên combo <span className="text-red-400">*</span></label>
                <Input {...register('name', { required: 'Tên là bắt buộc' })} placeholder="Combo Gia đình" />
                {errors.name && <p className="text-red-400 text-xs mt-1">{String(errors.name.message)}</p>}
              </div>
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Mô tả</label>
                <Textarea {...register('description')} rows={2} placeholder="VD: 2 bắp + 4 nước, tiết kiệm 30k" />
              </div>
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Giá combo (đ) <span className="text-red-400">*</span></label>
                <PriceInput value={watchedPrice} onChange={(v) => setValue('price', Number(v) || 0)} placeholder="VD: 250.000" />
                <p className="text-gray-500 text-xs mt-1">
                  Tải ảnh combo qua nút <span className="text-[#ffc107]">Upload</span> trên bảng combo sau khi tạo xong — KHÔNG nhập URL.
                </p>
              </div>
              <input type="hidden" {...register('imageUrl')} />

              <SnackItemsSection
                fields={fields}
                snacks={snacks}
                watchedItems={watchedItems}
                formTheaterId={formTheaterId}
                register={register}
                onAppend={() => append({ snackId: '', quantity: 1 })}
                onRemove={remove}
              />

              <PricePreview
                regularPrice={regularPrice}
                savings={savings}
                watchedPrice={watchedPrice}
              />

              <div className="col-span-12">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('active')} className="accent-[#ffc107] w-4 h-4" />
                  <span className="text-sm text-gray-300">Bật combo (hiển thị cho user)</span>
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

interface TheaterSelectProps {
  register: ReturnType<typeof useForm<FormData>>['register']
  errors: ReturnType<typeof useForm<FormData>>['formState']['errors']
  theaters: Theater[]
}

/** Dropdown chọn chi nhánh — chỉ render khi user chưa lock theater (SUPER_ADMIN ở "Tất cả chi nhánh"). */
function TheaterSelect({ register, errors, theaters }: TheaterSelectProps) {
  return (
    <div className="col-span-12">
      <label className="text-sm text-gray-400 mb-1.5 block">
        Chi nhánh <span className="text-red-400">*</span>
      </label>
      <select {...register('theaterId', { required: 'Vui lòng chọn chi nhánh' })}
        className={SELECT_CLS}>
        <option value="">-- Chọn chi nhánh --</option>
        {theaters.map((t) => (
          <option key={t.id} value={t.id}>{t.name} ({t.city})</option>
        ))}
      </select>
      {errors.theaterId && <p className="text-red-400 text-xs mt-1">{String(errors.theaterId.message)}</p>}
      <p className="text-gray-500 text-xs mt-1">Chọn chi nhánh trước — snack list sẽ lọc theo chi nhánh được chọn.</p>
    </div>
  )
}

interface SnackOption {
  id: number
  name: string
  price: number
}

interface SnackItemsSectionProps {
  fields: { id: string }[]
  snacks: SnackOption[]
  watchedItems: Array<{ snackId: number | ''; quantity: number }>
  formTheaterId: number | null
  register: ReturnType<typeof useForm<FormData>>['register']
  onAppend: () => void
  onRemove: (index: number) => void
}

function SnackItemsSection({
  fields, snacks, watchedItems, formTheaterId, register, onAppend, onRemove,
}: SnackItemsSectionProps) {
  if (formTheaterId == null) {
    return (
      <div className="col-span-12">
        <label className="text-sm text-gray-400 mb-2 block">
          Snacks trong combo <span className="text-red-400">*</span>
        </label>
        <div className="rounded-xl border border-dashed border-[#3f382d] bg-[#2a2317]/40 p-6 text-center text-sm text-gray-500">
          Hãy chọn chi nhánh trước để thấy danh sách snack có thể bundle.
        </div>
      </div>
    )
  }

  return (
    <div className="col-span-12">
      <label className="text-sm text-gray-400 mb-2 block">
        Snacks trong combo <span className="text-red-400">*</span>
      </label>
      <div className="space-y-2 rounded-xl border border-[#3f382d] bg-[#2a2317]/40 p-3">
        {fields.map((field, index) => {
          const selectedSnack = snacks.find(s => s.id === Number(watchedItems[index]?.snackId))
          const lineTotal = (selectedSnack?.price ?? 0) * Number(watchedItems[index]?.quantity ?? 0)
          return (
            <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-6">
                <select
                  {...register(`items.${index}.snackId`, { required: true, valueAsNumber: true })}
                  className={SELECT_SM_CLS}
                >
                  <option value="">-- Chọn snack --</option>
                  {snacks.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({fmtVnd(s.price)})</option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <Input type="number" min={1}
                  {...register(`items.${index}.quantity`, { required: true, valueAsNumber: true, min: 1 })}
                  placeholder="SL" className="h-9" />
              </div>
              <div className="col-span-2 text-xs text-gray-400 text-right">
                {lineTotal > 0 && fmtVnd(lineTotal)}
              </div>
              <div className="col-span-1 text-right">
                <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(index)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-8 w-8 p-0 disabled:text-gray-600"
                  disabled={fields.length === 1}
                  title="Xóa snack">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          )
        })}
        <Button type="button" size="sm" variant="outline" onClick={onAppend}
          className="border-white/10 text-gray-300 hover:bg-white/5 mt-2">
          <Plus size={14} className="mr-1" /> Thêm snack
        </Button>
      </div>
    </div>
  )
}

interface PricePreviewProps {
  regularPrice: number
  savings: number
  watchedPrice: number
}

/** Preview: tổng giá lẻ vs giá combo → hiển thị tiết kiệm hoặc cảnh báo combo đắt hơn. */
function PricePreview({ regularPrice, savings, watchedPrice }: PricePreviewProps) {
  return (
    <div className="col-span-12">
      <div className="mt-3 rounded-xl bg-[#2a2317]/40 border border-[#3f382d] p-3 flex justify-between text-sm">
        <span className="text-gray-400">Tổng giá nếu mua lẻ:</span>
        <div className="text-right">
          <div className="text-gray-300">{fmtVnd(regularPrice)}</div>
          {savings > 0 && watchedPrice > 0 && (
            <div className="text-green-400 text-xs">Combo tiết kiệm {fmtVnd(savings)}</div>
          )}
          {savings < 0 && watchedPrice > 0 && (
            <div className="text-red-400 text-xs">⚠ Combo đắt hơn mua lẻ {fmtVnd(-savings)}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  Business validation
// ============================================================

/** Validate business rules — return false + toast nếu vi phạm. */
function validateBusinessRules(data: FormData): boolean {
  if (data.theaterId === '' || data.theaterId == null) {
    toast.error('Vui lòng chọn chi nhánh trước')
    return false
  }
  if (data.items.length === 0) {
    toast.error('Combo phải có ít nhất 1 snack')
    return false
  }
  if (data.items.some(i => i.snackId === '')) {
    toast.error('Hãy chọn snack cho mỗi dòng')
    return false
  }
  return true
}
