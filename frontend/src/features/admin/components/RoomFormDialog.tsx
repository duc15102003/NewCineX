import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'

import { useCreateRoom, useUpdateRoom } from '@/hooks/useAdmin'
import { useTheaterOptions, type Theater } from '@/hooks/useAdminTheaters'
import { useAuthStore } from '@/store/authStore'
import type { AdminRoom } from '@/hooks/useAdminRooms'
import { ROOM_TYPE_LABELS, ROOM_STATUS_LABELS } from '@/utils/labels'
import { FEATURES } from '@/config/featureFlags'
import LockedTheaterBadge from './LockedTheaterBadge'

interface RoomFormData {
  theaterId: number | ''
  name: string
  type: string
  totalSeats: number
  status: string
}

export interface RoomFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = create mode, có giá trị = edit mode */
  editingItem: AdminRoom | null
  /** Theater scope từ adminTheaterStore hoặc userTheaterId (branch admin). null = SUPER_ADMIN "Tất cả". */
  scopedTheaterId: number | null
  /** True = theater field bị lock (branch admin hoặc SUPER_ADMIN đang đứng tại 1 rạp). */
  theaterLocked: boolean
}

/**
 * Dialog tạo/sửa phòng chiếu. Tách ra component riêng (SRP):
 * Page chỉ lo list + filter, Dialog lo form + submit.
 */
export default function RoomFormDialog({
  open, onOpenChange, editingItem, scopedTheaterId, theaterLocked,
}: RoomFormDialogProps) {
  const { data: theaters = [] } = useTheaterOptions()
  const createMut = useCreateRoom()
  const updateMut = useUpdateRoom()
  const { isBranchAdmin } = useAuthStore()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RoomFormData>()

  useEffect(() => {
    if (!open) return
    if (editingItem) {
      reset({
        theaterId: editingItem.theaterId ?? '',
        name: editingItem.name,
        type: editingItem.type,
        totalSeats: editingItem.totalSeats,
        status: editingItem.status,
      })
    } else {
      reset({
        theaterId: (scopedTheaterId ?? '') as number | '',
        name: '',
        type: 'TWO_D',
        totalSeats: 0,
        status: 'ACTIVE',
      })
    }
  }, [open, editingItem, scopedTheaterId, reset])

  function onSubmit(data: RoomFormData) {
    const payload = {
      ...data,
      theaterId: Number(data.theaterId),
      totalSeats: editingItem ? editingItem.totalSeats : 0,
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
          <DialogTitle>{editingItem ? 'Chỉnh sửa phòng chiếu' : 'Thêm mới phòng chiếu'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            {editingItem && (
              <div className="mb-4 rounded-md border border-blue-500/30 bg-blue-500/[0.06] px-3 py-2 text-xs text-blue-200 leading-relaxed">
                Phòng này hiện có <span className="font-semibold">{editingItem.totalSeats}</span> ghế.{' '}
                Form này chỉ đổi <span className="font-semibold">thông tin chung</span> (tên, loại, trạng thái).
                Để thêm/sửa/xoá ghế, đóng form và bấm nút{' '}
                <span className="font-semibold text-[#ffc107]">"Sơ đồ ghế"</span> trên hàng phòng.
              </div>
            )}
            <div className="grid grid-cols-12 gap-4">
              {!FEATURES.multiTheater ? (
                // Single-theater mode: ẨN toàn bộ UI chi nhánh, vẫn submit
                // theaterId qua hidden input (lấy từ scopedTheaterId).
                <input type="hidden" {...register('theaterId', { valueAsNumber: true })} />
              ) : (editingItem || theaterLocked) ? (
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
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">
                    Chi nhánh <span className="text-red-400">*</span>
                  </label>
                  <select
                    {...register('theaterId', { required: 'Vui lòng chọn chi nhánh', valueAsNumber: true })}
                    className="w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]"
                  >
                    <option value="">-- Chọn chi nhánh --</option>
                    {theaters.map((t: Theater) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.city})</option>
                    ))}
                  </select>
                  {errors.theaterId && <p className="text-red-400 text-xs mt-1">{String(errors.theaterId.message)}</p>}
                </div>
              )}
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Tên phòng <span className="text-red-400">*</span></label>
                <Input {...register('name', { required: 'Tên phòng là bắt buộc', maxLength: { value: 50, message: 'Tối đa 50 ký tự' } })} />
                {errors.name && <p className="text-red-400 text-xs mt-1">{String(errors.name.message)}</p>}
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Loại phòng <span className="text-red-400">*</span></label>
                <select {...register('type')}
                  className="w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]">
                  {Object.entries(ROOM_TYPE_LABELS).map(([value, lbl]) => (
                    <option key={value} value={value}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Trạng thái</label>
                <select {...register('status')}
                  className="w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]">
                  {Object.entries(ROOM_STATUS_LABELS).map(([value, lbl]) => (
                    <option key={value} value={value}>{lbl}</option>
                  ))}
                </select>
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
