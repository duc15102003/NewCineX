import { useState, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { PriceInput } from '@/components/ui/price-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, ImagePlus, Popcorn, CupSoda, Package, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import { label, STORAGE_STATE_LABELS } from '@/utils/labels'
import { STORAGE_STATE_COLORS as STATE_COLORS } from '@/utils/colors'
import { useQueryClient } from '@tanstack/react-query'
import { useAdminSnacks, useCreateSnack, useUpdateSnack, useBulkDeleteSnacks, useBulkRestoreSnacks } from '@/hooks/useAdmin'

interface SnackFormData {
  name: string
  description: string
  price: number
  category: string
  imageUrl: string
  available: boolean
}

export default function AdminSnackPage() {
  const qc = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: pageData } = useAdminSnacks({ keyword: keyword || undefined, size: 50 })
  const snacks = pageData?.content ?? []

  const createMut = useCreateSnack()
  const updateMut = useUpdateSnack()
  const bulkDeleteMut = useBulkDeleteSnacks()
  const bulkRestoreMut = useBulkRestoreSnacks()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadId, setUploadId] = useState<number | null>(null)

  function handleUpload(id: number) {
    setUploadId(id)
    fileRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && uploadId) {
      const formData = new FormData()
      formData.append('file', file)
      api.post(`/api/snacks/${uploadId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(() => {
        toast.success('Upload ảnh thành công')
        qc.invalidateQueries({ queryKey: ['admin', 'snacks'] })
      }).catch(() => toast.error('Upload ảnh thất bại'))
      e.target.value = ''
    }
  }

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<SnackFormData>()

  function openCreate() {
    setEditingItem(null)
    reset({ name: '', description: '', price: 0, category: 'Bắp rang', imageUrl: '', available: true })
    setDialogOpen(true)
  }

  async function openEdit(snackId: number) {
    try {
      const res = await api.get(`/api/snacks/${snackId}`)
      const s = res.data.data
      setEditingItem(s)
      reset({
        name: s.name,
        description: s.description ?? '',
        price: s.price,
        category: s.category ?? '',
        imageUrl: s.imageUrl ?? '',
        available: s.available,
      })
      setDialogOpen(true)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Không thể tải dữ liệu'))
    }
  }

  function onSubmit(data: SnackFormData) {
    const payload = { ...data, price: Number(data.price), available: Boolean(data.available) }
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, data: payload }, { onSuccess: () => setDialogOpen(false) })
    } else {
      createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) })
    }
  }

  function handleBulkArchive() {
    if (selectedIds.size === 0) {
      toast.error('Hãy chọn ít nhất 1 mục')
      return
    }
    setConfirmOpen(true)
  }

  function handleBulkRestore() {
    if (selectedIds.size === 0) {
      toast.error('Hãy chọn ít nhất 1 mục')
      return
    }
    bulkRestoreMut.mutate([...selectedIds], {
      onSuccess: () => { setSelectedIds(new Set()) }
    })
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === snacks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(snacks.map((s: any) => s.id)))
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Tìm kiếm đồ ăn..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold">
            <Plus size={16} className="mr-1" /> Thêm mới
          </Button>
          <StatusDropdown
            onArchive={handleBulkArchive}
            onRestore={handleBulkRestore}
            archiveLoading={bulkDeleteMut.isPending}
            restoreLoading={bulkRestoreMut.isPending}
          />
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {/* Table */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={snacks.length > 0 && selectedIds.size === snacks.length}
                  onChange={toggleAll} className="accent-[#eab308]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Tên</TableHead>
              <TableHead className="text-gray-400">Danh mục</TableHead>
              <TableHead className="text-gray-400">Giá</TableHead>
              <TableHead className="text-gray-400">Còn hàng</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
              <TableHead className="text-gray-400 text-right">Upload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snacks.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-10">Không có dữ liệu</TableCell>
              </TableRow>
            )}
            {snacks.map((s: any, index: number) => (
              <TableRow key={s.id} className="border-white/5 hover:bg-white/5 group">
                <TableCell className="whitespace-nowrap">
                  <input type="checkbox" checked={selectedIds.has(s.id)}
                    onChange={() => toggleSelect(s.id)} className="accent-[#eab308]" />
                </TableCell>
                <TableCell className="text-gray-500 text-sm whitespace-nowrap">{index + 1}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => openEdit(s.id)}>
                    {s.imageUrl ? (
                      <img src={s.imageUrl} alt={s.name} className="w-9 h-9 object-cover rounded-lg shrink-0" />
                    ) : (
                      <div className="w-9 h-9 bg-[#0d2137] rounded-lg flex items-center justify-center shrink-0">
                        <ImagePlus size={12} className="text-gray-600" />
                      </div>
                    )}
                    <span className="text-[#eab308] hover:underline font-medium">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {s.category ? (() => {
                    const cfg: Record<string, { icon: typeof Popcorn; color: string }> = {
                      'Bắp rang': { icon: Popcorn, color: 'bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20' },
                      'Nước uống': { icon: CupSoda, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                      'Combo': { icon: Package, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
                      'Khác': { icon: MoreHorizontal, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
                    }
                    const c = cfg[s.category] ?? cfg['Khác']
                    const Icon = c.icon
                    return (
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${c.color}`}>
                        <Icon size={12} /> {s.category}
                      </span>
                    )
                  })() : '—'}
                </TableCell>
                <TableCell className="text-gray-300 text-sm whitespace-nowrap">
                  {s.price != null ? s.price.toLocaleString('vi-VN') + 'đ' : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {s.available
                    ? <span className="text-xs px-2 py-1 rounded border bg-green-500/20 text-green-400 border-green-500/30">Có</span>
                    : <span className="text-xs px-2 py-1 rounded border bg-red-500/20 text-red-400 border-red-500/30">Hết</span>
                  }
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={`text-xs px-2 py-1 rounded border ${STATE_COLORS[s.storageState] ?? ''}`}>
                    {label(STORAGE_STATE_LABELS, s.storageState)}
                  </span>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => handleUpload(s.id)}
                    className="text-gray-400 hover:text-[#eab308] h-8 w-8 p-0">
                    <ImagePlus size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => bulkDeleteMut.mutate([...selectedIds], { onSuccess: () => { setSelectedIds(new Set()); setConfirmOpen(false) } })}
        message={`Bạn có chắc muốn lưu trữ ${selectedIds.size} đồ ăn đã chọn?`}
        loading={bulkDeleteMut.isPending}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md" className="bg-[#0a1929] border-white/5 text-white">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Chỉnh sửa đồ ăn' : 'Thêm đồ ăn mới'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogBody>
              <div className="grid grid-cols-12 gap-4">
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
                  <select {...register('category')}
                    className="w-full h-10 rounded-lg border border-white/10 bg-[#0d2137] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#eab308]">
                    <option value="Bắp rang">Bắp rang</option>
                    <option value="Nước uống">Nước uống</option>
                    <option value="Combo">Combo</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
                <div className="col-span-12">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="available" {...register('available')} className="accent-[#eab308] w-4 h-4" defaultChecked />
                    <label htmlFor="available" className="text-sm text-gray-400">Còn hàng</label>
                  </div>
                </div>
              </div>
            </DialogBody>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}
                className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
              <Button type="submit" className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold"
                disabled={createMut.isPending || updateMut.isPending}>Lưu</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
