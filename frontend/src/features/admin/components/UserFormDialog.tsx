import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'

import { useAdminUpdateUser } from '@/hooks/useAdmin'
import type { AdminUser } from '@/hooks/useAdminUsers'
import { useTheaterOptions, type Theater } from '@/hooks/useAdminTheaters'

const SELECT_CLS =
  'w-full h-10 rounded-lg border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

interface UserEditFormData {
  fullName: string
  phone: string
  role: string
  enabled: boolean
  theaterId: number | ''
}

export interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** User để edit. Page tự pass full data từ list (không cần refetch detail). */
  editingItem: AdminUser | null
}

/**
 * Dialog edit user metadata (fullName, phone, role, enabled, theaterId).
 * Branch ADMIN role bắt buộc có theaterId; USER/SUPER_ADMIN thì theaterId = null.
 */
export default function UserFormDialog({ open, onOpenChange, editingItem }: UserFormDialogProps) {
  const updateMut = useAdminUpdateUser()
  const { data: theaters = [] } = useTheaterOptions()

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<UserEditFormData>()
  const selectedRole = useWatch({ control, name: 'role' })

  useEffect(() => {
    if (!open || !editingItem) return
    reset({
      fullName: editingItem.fullName ?? '',
      phone: editingItem.phone ?? '',
      role: editingItem.role,
      enabled: editingItem.enabled,
      theaterId: editingItem.theaterId ?? '',
    })
  }, [open, editingItem, reset])

  function onSubmit(data: UserEditFormData) {
    if (!editingItem) return
    // Validation client-side: ADMIN phải chọn chi nhánh; USER/SUPER_ADMIN phải để trống.
    // BE cũng enforce — đây chỉ là UX gate trước khi submit.
    if (data.role === 'ADMIN' && !data.theaterId) return

    updateMut.mutate({
      id: editingItem.id,
      data: {
        ...data,
        enabled: Boolean(data.enabled),
        // Convert '' → null cho USER/SUPER_ADMIN; convert string → number cho ADMIN
        theaterId: data.role === 'ADMIN' ? Number(data.theaterId) : null,
      },
    }, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa: {editingItem?.username}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Email</label>
                <p className="text-gray-300 text-sm bg-[#2a2317] rounded-md px-3 py-2 border border-white/5 h-10 flex items-center">
                  {editingItem?.email}
                </p>
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Họ tên</label>
                <Input {...register('fullName')} />
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Số điện thoại</label>
                <Input {...register('phone')} />
              </div>
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Vai trò <span className="text-red-400">*</span></label>
                <select {...register('role', { required: 'Vai trò là bắt buộc' })} className={SELECT_CLS}>
                  <option value="USER">Người dùng</option>
                  <option value="ADMIN">Quản trị viên chi nhánh</option>
                  <option value="SUPER_ADMIN">Quản trị tổng</option>
                </select>
                {errors.role && <p className="text-red-400 text-xs mt-1">{String(errors.role.message)}</p>}
              </div>

              {selectedRole === 'ADMIN' && (
                <BranchTheaterSelect register={register} errors={errors} selectedRole={selectedRole} theaters={theaters} />
              )}
              {selectedRole === 'SUPER_ADMIN' && (
                <div className="col-span-12 rounded-xl border border-[#ffc107]/30 bg-[#ffc107]/5 p-3 text-xs text-[#ffc107]">
                  ⚠ SUPER_ADMIN có quyền xem &amp; sửa MỌI chi nhánh. Chỉ cấp cho tài khoản HQ.
                </div>
              )}

              <EnabledToggle register={register} />
            </div>
          </DialogBody>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}
              className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
            <Button type="submit" className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
              disabled={updateMut.isPending}>Lưu</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
//  Sub-components
// ============================================================

interface BranchTheaterSelectProps {
  register: ReturnType<typeof useForm<UserEditFormData>>['register']
  errors: ReturnType<typeof useForm<UserEditFormData>>['formState']['errors']
  selectedRole: string
  theaters: Theater[]
}

/** Chi nhánh — CHỈ hiện khi role=ADMIN. USER/SUPER_ADMIN không thuộc chi nhánh. */
function BranchTheaterSelect({ register, errors, selectedRole, theaters }: BranchTheaterSelectProps) {
  return (
    <div className="col-span-12">
      <label className="text-sm text-gray-400 mb-1.5 block">
        Chi nhánh được gán <span className="text-red-400">*</span>
      </label>
      <select
        {...register('theaterId', {
          required: selectedRole === 'ADMIN' ? 'Bắt buộc khi role là ADMIN' : false,
          valueAsNumber: true,
        })}
        className={SELECT_CLS}
      >
        <option value="">— Chọn chi nhánh —</option>
        {theaters.map((t) => (
          <option key={t.id} value={t.id}>{t.name} ({t.city})</option>
        ))}
      </select>
      {errors.theaterId && <p className="text-red-400 text-xs mt-1">{String(errors.theaterId.message)}</p>}
      <p className="text-gray-500 text-xs mt-1">
        Admin chỉ quản lý phim/phòng/booking của chi nhánh này.
      </p>
    </div>
  )
}

interface EnabledToggleProps {
  register: ReturnType<typeof useForm<UserEditFormData>>['register']
}

function EnabledToggle({ register }: EnabledToggleProps) {
  return (
    <div className="col-span-12">
      <div className="flex items-center justify-between bg-[#2a2317] rounded-md px-3 py-3 border border-white/10">
        <div>
          <p className="text-sm text-white font-medium">Trạng thái tài khoản</p>
          <p className="text-xs text-gray-400 mt-0.5">Tài khoản bị khóa sẽ không thể đăng nhập</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" {...register('enabled')} className="sr-only peer" />
          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-[#ffc107]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ffc107]"></div>
        </label>
      </div>
    </div>
  )
}
