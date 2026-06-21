import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PriceInput } from '@/components/ui/price-input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'

import { useCreateSnack, useUpdateSnack } from '@/hooks/useAdmin'
import { useTheaterOptions, type Theater } from '@/hooks/useAdminTheaters'
import { useAuthStore } from '@/store/authStore'
import type { AdminSnack } from '@/hooks/useAdminSnacks'
import LockedTheaterBadge from './LockedTheaterBadge'
import { FEATURES } from '@/config/featureFlags'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

/** Danh mục snack — match BE convention (lưu chuỗi tiếng Việt).
    KHÔNG có 'Combo' vì đã tách module Combo riêng — bán Snack thuần ở đây để không trùng. */
const SNACK_CATEGORIES = ['Bắp rang', 'Nước uống', 'Khác'] as const
type SnackCategory = typeof SNACK_CATEGORIES[number]

interface SnackFormData {
  theaterId: number | ''
  name: string
  description: string
  price: number
  category: SnackCategory | ''
  imageUrl: string
  available: boolean
}

export interface SnackFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingItem: AdminSnack | null
  scopedTheaterId: number | null
  /** True = theater field bị lock (branch admin hoặc SUPER_ADMIN đang đứng tại 1 rạp). */
  theaterLocked: boolean
}

/**
 * Dialog tạo/sửa snack với scope chi nhánh.
 * Tách ra component riêng (SRP). Mutations sống trong dialog — React Query
 * tự invalidate cache, page list refresh không cần callback thủ công.
 */
export default function SnackFormDialog({
  open, onOpenChange, editingItem, scopedTheaterId, theaterLocked,
}: SnackFormDialogProps) {
  const { data: theaters = [] } = useTheaterOptions()
  const { isBranchAdmin } = useAuthStore()
  const createMut = useCreateSnack()
  const updateMut = useUpdateSnack()

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<SnackFormData>()

  // Reset form mỗi khi dialog mở — phụ thuộc open + editingItem để chuyển mode
  useEffect(() => {
    if (!open) return
    if (editingItem) {
      reset({
        theaterId: editingItem.theaterId ?? '',
        name: editingItem.name,
        description: editingItem.description ?? '',
        price: editingItem.price,
        category: (editingItem.category ?? '') as SnackCategory | '',
        imageUrl: editingItem.imageUrl ?? '',
        available: editingItem.available,
      })
    } else {
      reset({
        theaterId: (scopedTheaterId ?? '') as number | '',
        name: '', description: '', price: 0,
        category: 'Bắp rang', imageUrl: '', available: true,
      })
    }
  }, [open, editingItem, scopedTheaterId, reset])

  function onSubmit(data: SnackFormData) {
    const payload = {
      theaterId: Number(data.theaterId),
      name: data.name,
      description: data.description,
      price: Number(data.price),
      category: data.category,
      imageUrl: data.imageUrl,
      available: Boolean(data.available),
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
      <DialogContent size="md" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Chỉnh sửa đồ ăn' : 'Thêm mới đồ ăn'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            <div className="grid grid-cols-12 gap-4">
              {(editingItem || theaterLocked) ? (
                <>
                  {/* Single-tenant (cinex-team): ẨN badge để không lộ multi-tenant.
                      Hidden input vẫn submit theaterId từ form defaultValues. */}
                  {FEATURES.multiTheater && (
                    <LockedTheaterBadge
                      theaterId={editingItem ? editingItem.theaterId : scopedTheaterId}
                      theaters={theaters}
                      isBranchAdmin={isBranchAdmin()}
                      isEdit={!!editingItem}
                    />
                  )}
                  <input type="hidden" {...register('theaterId', { valueAsNumber: true })} />
                </>
              ) : (
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">
                    Chi nhánh <span className="text-red-400">*</span>
                  </label>
                  <select {...register('theaterId', { required: 'Vui lòng chọn chi nhánh' })}
                    className={SELECT_CLS}>
                    <option value="">-- Chọn chi nhánh --</option>
                    {theaters.map((t: Theater) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.city})</option>
                    ))}
                  </select>
                  {errors.theaterId && <p className="text-red-400 text-xs mt-1">{String(errors.theaterId.message)}</p>}
                </div>
              )}
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Tên <span className="text-red-400">*</span></label>
                <Input {...register('name', { required: 'Tên là bắt buộc', maxLength: { value: 100, message: 'Tối đa 100 ký tự' } })} />
                {errors.name && <p className="text-red-400 text-xs mt-1">{String(errors.name.message)}</p>}
              </div>
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Mô tả</label>
                <Textarea {...register('description')} rows={3} />
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Giá <span className="text-red-400">*</span></label>
                <Controller
                  name="price"
                  control={control}
                  rules={{ required: 'Giá là bắt buộc', min: { value: 1, message: 'Giá phải > 0' } }}
                  render={({ field }) => (
                    <PriceInput value={field.value} onChange={field.onChange} placeholder="VD: 45.000" />
                  )}
                />
                {errors.price && <p className="text-red-400 text-xs mt-1">{String(errors.price.message)}</p>}
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Danh mục</label>
                <select {...register('category')} className={SELECT_CLS}>
                  {SNACK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-12">
                <Controller name="available" control={control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value !== false}
                      onChange={field.onChange}
                      label="Còn hàng — đang bán cho khách"
                      description="Tắt để tạm dừng bán mặt hàng này (vd hết hàng, đang nhập mới)." />
                  )} />
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
