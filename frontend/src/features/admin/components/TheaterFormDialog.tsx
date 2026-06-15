import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'

import {
  useCreateTheater, useUpdateTheater, useTheaterDetail,
  type TheaterStatus,
} from '@/hooks/useAdminTheaters'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

/** Label TheaterStatus — không bỏ vào labels.ts vì specific cho feature, không reuse. */
const THEATER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  MAINTENANCE: 'Bảo trì',
  CLOSED: 'Ngừng',
}

interface TheaterFormData {
  code: string
  name: string
  address: string
  city: string
  hotline: string
  email: string
  latitude: string
  longitude: string
  status: TheaterStatus
}

export interface TheaterFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Khi edit chỉ cần truyền theaterId — dialog tự fetch detail. */
  editingId: number | null
}

/**
 * Dialog tạo/sửa Theater. Tách ra component riêng (SRP).
 * Edit mode tự fetch detail (useTheaterDetail) thay vì page api.get() trực tiếp.
 */
export default function TheaterFormDialog({ open, onOpenChange, editingId }: TheaterFormDialogProps) {
  const isEditMode = editingId != null

  const { data: theaterDetail } = useTheaterDetail(editingId ?? undefined)
  const createMut = useCreateTheater()
  const updateMut = useUpdateTheater()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TheaterFormData>()

  useEffect(() => {
    if (!open) return
    if (isEditMode) {
      if (!theaterDetail) return
      reset({
        code: theaterDetail.code,
        name: theaterDetail.name,
        address: theaterDetail.address,
        city: theaterDetail.city,
        hotline: theaterDetail.hotline ?? '',
        email: theaterDetail.email ?? '',
        latitude: theaterDetail.latitude != null ? String(theaterDetail.latitude) : '',
        longitude: theaterDetail.longitude != null ? String(theaterDetail.longitude) : '',
        status: theaterDetail.status,
      })
    } else {
      reset({
        code: '', name: '', address: '', city: '',
        hotline: '', email: '', latitude: '', longitude: '',
        status: 'ACTIVE',
      })
    }
  }, [open, isEditMode, theaterDetail, reset])

  function onSubmit(data: TheaterFormData) {
    const payload: Record<string, unknown> = {
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      address: data.address.trim(),
      city: data.city.trim(),
      hotline: data.hotline.trim() || null,
      email: data.email.trim() || null,
      latitude: data.latitude ? Number(data.latitude) : null,
      longitude: data.longitude ? Number(data.longitude) : null,
      status: data.status,
    }
    if (isEditMode && editingId != null) {
      updateMut.mutate({ id: editingId, data: payload },
        { onSuccess: () => onOpenChange(false) })
    } else {
      createMut.mutate(payload, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Chỉnh sửa chi nhánh' : 'Thêm mới chi nhánh'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            {!isEditMode && (
              <div className="mb-4 rounded-md border border-blue-500/30 bg-blue-500/[0.06] px-3 py-2 text-xs text-blue-200 leading-relaxed">
                <span className="font-semibold">Lưu ý:</span> Mã chi nhánh tạo lần đầu sẽ <span className="font-semibold">không thể thay đổi</span> — vì nó được dùng làm khoá tham chiếu trong vé / báo cáo / lịch chiếu. Đặt mã ngắn gọn và có thể nhận diện chi nhánh dễ dàng.
              </div>
            )}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <label className="text-sm text-gray-400 mb-1.5 block">Mã chi nhánh <span className="text-red-400">*</span></label>
                <Input
                  {...register('code', {
                    required: 'Mã là bắt buộc',
                    pattern: { value: /^[A-Z0-9-]+$/, message: 'Chỉ chữ hoa, số, gạch ngang' },
                  })}
                  placeholder="CNX-HN-LOTTE"
                  disabled={isEditMode}
                  className="font-mono uppercase"
                />
                {errors.code && <p className="text-red-400 text-xs mt-1">{String(errors.code.message)}</p>}
                {isEditMode && <p className="text-gray-500 text-xs mt-1">Mã chi nhánh không sửa được sau khi tạo</p>}
              </div>
              <div className="col-span-8">
                <label className="text-sm text-gray-400 mb-1.5 block">Tên chi nhánh <span className="text-red-400">*</span></label>
                <Input {...register('name', { required: 'Tên là bắt buộc' })} placeholder="VD: CineX Hà Nội — Lotte Mall" />
                {errors.name && <p className="text-red-400 text-xs mt-1">{String(errors.name.message)}</p>}
              </div>
              <div className="col-span-8">
                <label className="text-sm text-gray-400 mb-1.5 block">Địa chỉ <span className="text-red-400">*</span></label>
                <Input {...register('address', { required: 'Địa chỉ là bắt buộc' })} placeholder="Số nhà, đường, quận, thành phố" />
                {errors.address && <p className="text-red-400 text-xs mt-1">{String(errors.address.message)}</p>}
              </div>
              <div className="col-span-4">
                <label className="text-sm text-gray-400 mb-1.5 block">Thành phố <span className="text-red-400">*</span></label>
                <Input {...register('city', { required: 'Thành phố là bắt buộc' })} placeholder="Hà Nội" />
                {errors.city && <p className="text-red-400 text-xs mt-1">{String(errors.city.message)}</p>}
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Hotline</label>
                <Input {...register('hotline')} placeholder="1900-CINEX" />
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Email</label>
                <Input type="email" {...register('email')} placeholder="branch@cinex.vn" />
              </div>
              <div className="col-span-4">
                <label className="text-sm text-gray-400 mb-1.5 block flex items-center gap-1">
                  Vĩ độ <span className="text-gray-600 text-xs font-normal">(định vị bản đồ)</span>
                </label>
                <Input type="number" step="0.000001" {...register('latitude')} placeholder="VD: 21.028511" />
                <p className="text-gray-600 text-[11px] mt-1">Copy từ Google Maps → click chuột phải vào vị trí rạp → số đầu</p>
              </div>
              <div className="col-span-4">
                <label className="text-sm text-gray-400 mb-1.5 block flex items-center gap-1">
                  Kinh độ <span className="text-gray-600 text-xs font-normal">(định vị bản đồ)</span>
                </label>
                <Input type="number" step="0.000001" {...register('longitude')} placeholder="VD: 105.804817" />
                <p className="text-gray-600 text-[11px] mt-1">Số sau trong cặp toạ độ Google Maps</p>
              </div>
              <div className="col-span-4">
                <label className="text-sm text-gray-400 mb-1.5 block">Trạng thái <span className="text-red-400">*</span></label>
                <select {...register('status', { required: true })} className={SELECT_CLS}>
                  {Object.entries(THEATER_STATUS_LABELS).map(([value, lbl]) => (
                    <option key={value} value={value}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-12 text-xs text-gray-500">
                • Toạ độ (lat/long) optional — phục vụ feature "rạp gần nhất" trong tương lai.
                Lấy từ Google Maps: phải chuột vào điểm → copy lat/long.
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
