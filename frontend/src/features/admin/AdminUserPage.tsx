import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAdminUsers, useAdminUpdateUser } from '@/hooks/useAdmin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { label, ROLE_LABELS } from '@/utils/labels'
import { ROLE_COLORS } from '@/utils/colors'

interface UserEditFormData {
  fullName: string
  phone: string
  role: string
  enabled: boolean
}

export default function AdminUserPage() {
  const [page, setPage] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)

  const { data: pageData } = useAdminUsers({ keyword: keyword || undefined, page, size: 15 })
  const users = pageData?.content ?? []
  const totalPages = pageData?.totalPages ?? 0

  const updateMut = useAdminUpdateUser()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserEditFormData>()

  function openEdit(u: any) {
    setEditingItem(u)
    reset({
      fullName: u.fullName ?? '',
      phone: u.phone ?? '',
      role: u.role,
      enabled: u.enabled,
    })
    setDialogOpen(true)
  }

  function onSubmit(data: UserEditFormData) {
    if (!editingItem) return
    updateMut.mutate({
      id: editingItem.id,
      data: { ...data, enabled: Boolean(data.enabled) },
    }, {
      onSuccess: () => setDialogOpen(false),
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Tìm theo username/email..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
                      />
        </div>
        <div />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Username</TableHead>
              <TableHead className="text-gray-400">Email</TableHead>
              <TableHead className="text-gray-400">Họ tên</TableHead>
              <TableHead className="text-gray-400">SĐT</TableHead>
              <TableHead className="text-gray-400">Vai trò</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-10">Không có dữ liệu</TableCell>
              </TableRow>
            )}
            {users.map((u, index) => (
              <TableRow key={u.id} className="border-white/5 hover:bg-white/5 group">
                <TableCell className="text-gray-500 text-sm whitespace-nowrap">{page * 15 + index + 1}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span onClick={() => openEdit(u)}
                    className="text-[#eab308] hover:underline cursor-pointer font-medium">
                    {u.username}
                  </span>
                </TableCell>
                <TableCell className="text-gray-300 whitespace-nowrap">{u.email}</TableCell>
                <TableCell className="text-gray-300 whitespace-nowrap">{u.fullName || '—'}</TableCell>
                <TableCell className="text-gray-300 whitespace-nowrap">{u.phone || '—'}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={`text-xs px-2 py-1 rounded border ${ROLE_COLORS[u.role] ?? 'text-gray-400 border-gray-600'}`}>
                    {label(ROLE_LABELS, u.role)}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={`text-xs px-2 py-1 rounded border ${u.enabled
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                    {u.enabled ? 'Hoạt động' : 'Bị khóa'}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}
            className="border-white/10 text-gray-300 hover:bg-white/5">Trước</Button>
          <span className="text-gray-400 text-sm px-2 py-1">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
            className="border-white/10 text-gray-300 hover:bg-white/5">Sau</Button>
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md" className="bg-[#0a1929] border-white/5 text-white">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa: {editingItem?.username}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogBody>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">Email</label>
                  <p className="text-gray-300 text-sm bg-[#0d2137] rounded-md px-3 py-2 border border-white/5 h-10 flex items-center">{editingItem?.email}</p>
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
                  <select {...register('role', { required: 'Vai trò là bắt buộc' })}
                    className="w-full h-10 rounded-lg border border-white/10 bg-[#0d2137] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#eab308]">
                    <option value="USER">Người dùng</option>
                    <option value="ADMIN">Quản trị viên</option>
                  </select>
                  {errors.role && <p className="text-red-400 text-xs mt-1">{String(errors.role.message)}</p>}
                </div>
                <div className="col-span-12">
                  <div className="flex items-center justify-between bg-[#0d2137] rounded-md px-3 py-3 border border-white/10">
                    <div>
                      <p className="text-sm text-white font-medium">Trạng thái tài khoản</p>
                      <p className="text-xs text-gray-400 mt-0.5">Tài khoản bị khóa sẽ không thể đăng nhập</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" {...register('enabled')} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-[#eab308]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#eab308]"></div>
                    </label>
                  </div>
                </div>
              </div>
            </DialogBody>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}
                className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
              <Button type="submit" className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold"
                disabled={updateMut.isPending}>Lưu</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
