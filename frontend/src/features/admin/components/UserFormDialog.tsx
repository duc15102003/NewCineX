import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'

import { useAdminUpdateUser, useAdminCreateUser } from '@/hooks/useAdmin'
import type { AdminUser } from '@/hooks/useAdminUsers'
import { useTheaterOptions, type Theater } from '@/hooks/useAdminTheaters'
import { useAuthStore } from '@/store/authStore'

const SELECT_CLS =
  'w-full h-10 rounded-lg border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

interface UserFormData {
  // Chỉ có trong create mode
  username: string
  email: string
  password: string
  // Edit + create
  fullName: string
  phone: string
  role: string
  enabled: boolean
  theaterId: number | ''
}

export interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = create mode; có giá trị = edit mode. */
  editingItem: AdminUser | null
}

/**
 * Dialog tạo/edit user. RBAC dynamic theo role current admin:
 * - SUPER_ADMIN: thấy đủ 4 role + tất cả chi nhánh
 * - BRANCH_ADMIN: chỉ thấy STAFF + USER, chi nhánh khoá = chi nhánh của mình
 */
export default function UserFormDialog({ open, onOpenChange, editingItem }: UserFormDialogProps) {
  const updateMut = useAdminUpdateUser()
  const createMut = useAdminCreateUser()
  const { data: theaters = [] } = useTheaterOptions()
  const currentUser = useAuthStore(s => s.user)
  const isCurrentSuperAdmin = currentUser?.role === 'SUPER_ADMIN'
  const isCurrentBranchAdmin = currentUser?.role === 'ADMIN'
  const isEdit = !!editingItem

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<UserFormData>()
  const selectedRole = useWatch({ control, name: 'role' })

  useEffect(() => {
    if (!open) return
    if (editingItem) {
      reset({
        username: editingItem.username,
        email: editingItem.email,
        password: '',
        fullName: editingItem.fullName ?? '',
        phone: editingItem.phone ?? '',
        role: editingItem.role,
        enabled: editingItem.enabled,
        theaterId: editingItem.theaterId ?? '',
      })
    } else {
      // Create mode — default role hợp lý theo current admin
      reset({
        username: '', email: '', password: '',
        fullName: '', phone: '',
        role: isCurrentBranchAdmin ? 'STAFF' : 'USER',
        enabled: true,
        theaterId: isCurrentBranchAdmin && currentUser?.theaterId ? currentUser.theaterId : '',
      })
    }
  }, [open, editingItem, reset, isCurrentBranchAdmin, currentUser?.theaterId])

  function onSubmit(data: UserFormData) {
    // Validation: ADMIN/STAFF phải có theaterId
    if ((data.role === 'ADMIN' || data.role === 'STAFF') && !data.theaterId) return

    const theaterId = (data.role === 'ADMIN' || data.role === 'STAFF')
      ? Number(data.theaterId)
      : null

    if (isEdit && editingItem) {
      updateMut.mutate({
        id: editingItem.id,
        data: {
          fullName: data.fullName,
          phone: data.phone,
          role: data.role,
          enabled: Boolean(data.enabled),
          theaterId,
        },
      }, { onSuccess: () => onOpenChange(false) })
    } else {
      createMut.mutate({
        username: data.username,
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phone: data.phone,
        role: data.role,
        theaterId,
      }, { onSuccess: () => onOpenChange(false) })
    }
  }

  const pending = updateMut.isPending || createMut.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Chỉnh sửa: ${editingItem?.username}` : 'Thêm mới tài khoản'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            <div className="grid grid-cols-12 gap-4">
              {/* Create mode: username + password. Edit: chỉ hiển thị email read-only */}
              {!isEdit ? (
                <>
                  <div className="col-span-6">
                    <label className="text-sm text-gray-400 mb-1.5 block">
                      Tên đăng nhập <span className="text-red-400">*</span>
                    </label>
                    <Input {...register('username', {
                      required: 'Bắt buộc',
                      minLength: { value: 3, message: 'Tối thiểu 3 ký tự' },
                      pattern: { value: /^[a-zA-Z0-9._-]+$/, message: 'Chỉ chữ, số, dấu chấm/gạch' },
                    })} placeholder="vd: nv_hanoi_01" />
                    {errors.username && <p className="text-red-400 text-xs mt-1">{String(errors.username.message)}</p>}
                  </div>
                  <div className="col-span-6">
                    <label className="text-sm text-gray-400 mb-1.5 block">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <Input type="email" {...register('email', {
                      required: 'Bắt buộc',
                      pattern: { value: /^[^@]+@[^@]+\.[^@]+$/, message: 'Email không hợp lệ' },
                    })} placeholder="staff@cinex.vn" />
                    {errors.email && <p className="text-red-400 text-xs mt-1">{String(errors.email.message)}</p>}
                  </div>
                  <div className="col-span-12">
                    <label className="text-sm text-gray-400 mb-1.5 block">
                      Mật khẩu khởi tạo <span className="text-red-400">*</span>
                    </label>
                    <Input type="password" {...register('password', {
                      required: 'Bắt buộc',
                      minLength: { value: 8, message: 'Tối thiểu 8 ký tự' },
                      pattern: {
                        value: /^(?=.*[A-Za-z])(?=.*\d).+$/,
                        message: 'Phải có cả chữ và số',
                      },
                    })} placeholder="Ít nhất 8 ký tự, có chữ + số" />
                    {errors.password && <p className="text-red-400 text-xs mt-1">{String(errors.password.message)}</p>}
                    <p className="text-gray-500 text-xs mt-1">Yêu cầu user đổi mật khẩu sau lần đăng nhập đầu tiên.</p>
                  </div>
                </>
              ) : (
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">Email</label>
                  <p className="text-gray-300 text-sm bg-[#2a2317] rounded-md px-3 py-2 border border-white/5 h-10 flex items-center">
                    {editingItem?.email}
                  </p>
                </div>
              )}

              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Họ tên</label>
                <Input {...register('fullName')} placeholder="Nguyễn Văn A" />
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Số điện thoại</label>
                <Input {...register('phone', {
                  pattern: { value: /^((0|\+84)\d{8,9})?$/, message: 'SĐT không hợp lệ' },
                })} placeholder="09xxxxxxxx" />
                {errors.phone && <p className="text-red-400 text-xs mt-1">{String(errors.phone.message)}</p>}
              </div>

              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Vai trò <span className="text-red-400">*</span></label>
                <select {...register('role', { required: 'Vai trò là bắt buộc' })} className={SELECT_CLS}>
                  <option value="USER">Khách hàng</option>
                  <option value="STAFF">Nhân viên quầy (POS + check-in)</option>
                  {isCurrentSuperAdmin && (
                    <>
                      <option value="ADMIN">Quản trị chi nhánh</option>
                      <option value="SUPER_ADMIN">Quản trị tổng</option>
                    </>
                  )}
                </select>
                {errors.role && <p className="text-red-400 text-xs mt-1">{String(errors.role.message)}</p>}
                {isCurrentBranchAdmin && (
                  <p className="text-gray-500 text-xs mt-1">
                    Bạn chỉ tạo được tài khoản Nhân viên hoặc Khách hàng.
                  </p>
                )}
              </div>

              {(selectedRole === 'ADMIN' || selectedRole === 'STAFF') && (
                <BranchTheaterSelect
                  register={register}
                  errors={errors}
                  selectedRole={selectedRole}
                  theaters={theaters}
                  lockedTheaterId={isCurrentBranchAdmin ? currentUser?.theaterId ?? null : null}
                />
              )}
              {selectedRole === 'STAFF' && (
                <div className="col-span-12 rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-300">
                  ℹ Nhân viên quầy chỉ có quyền: POS bán vé, POS bán đồ ăn, quét QR check-in. KHÔNG sửa được phòng/suất chiếu/quy tắc giá.
                </div>
              )}
              {selectedRole === 'SUPER_ADMIN' && (
                <div className="col-span-12 rounded-xl border border-[#ffc107]/30 bg-[#ffc107]/5 p-3 text-xs text-[#ffc107]">
                  ⚠ Quản trị tổng có quyền xem &amp; sửa MỌI chi nhánh. Chỉ cấp cho tài khoản HQ.
                </div>
              )}

              {/* Trạng thái chỉ hiện ở edit mode (create luôn enabled=true) */}
              {isEdit && <EnabledToggle register={register} />}
            </div>
          </DialogBody>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}
              className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
            <Button type="submit" className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
              disabled={pending}>
              {pending ? 'Đang lưu...' : (isEdit ? 'Lưu' : 'Tạo tài khoản')}
            </Button>
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
  register: ReturnType<typeof useForm<UserFormData>>['register']
  errors: ReturnType<typeof useForm<UserFormData>>['formState']['errors']
  selectedRole: string
  theaters: Theater[]
  /** Khi branch ADMIN tạo user — chi nhánh khoá theo theater của mình. */
  lockedTheaterId: number | null
}

/** Chi nhánh — CHỈ hiện khi role=ADMIN/STAFF. USER/SUPER_ADMIN không thuộc chi nhánh. */
function BranchTheaterSelect({ register, errors, selectedRole, theaters, lockedTheaterId }: BranchTheaterSelectProps) {
  const lockedTheater = lockedTheaterId ? theaters.find(t => t.id === lockedTheaterId) : null
  return (
    <div className="col-span-12">
      <label className="text-sm text-gray-400 mb-1.5 block">
        Chi nhánh được gán <span className="text-red-400">*</span>
        {lockedTheaterId && <span className="text-xs text-gray-500 ml-2">(khoá theo chi nhánh của bạn)</span>}
      </label>
      {lockedTheater ? (
        <>
          <div className="h-10 flex items-center px-3 rounded-md border border-white/10 bg-[#2a2317]/60 text-gray-300 text-sm">
            {lockedTheater.name} ({lockedTheater.city})
          </div>
          <input type="hidden" {...register('theaterId', { valueAsNumber: true })} value={lockedTheaterId ?? ''} />
        </>
      ) : (
        <select
          {...register('theaterId', {
            required: (selectedRole === 'ADMIN' || selectedRole === 'STAFF')
              ? 'Bắt buộc khi role là ADMIN/STAFF' : false,
            valueAsNumber: true,
          })}
          className={SELECT_CLS}
        >
          <option value="">— Chọn chi nhánh —</option>
          {theaters.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({t.city})</option>
          ))}
        </select>
      )}
      {errors.theaterId && <p className="text-red-400 text-xs mt-1">{String(errors.theaterId.message)}</p>}
      <p className="text-gray-500 text-xs mt-1">
        Tài khoản chỉ quản lý / làm việc tại chi nhánh được gán.
      </p>
    </div>
  )
}

interface EnabledToggleProps {
  register: ReturnType<typeof useForm<UserFormData>>['register']
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
