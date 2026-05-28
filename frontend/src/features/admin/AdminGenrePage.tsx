import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import { label, STORAGE_STATE_LABELS } from '@/utils/labels'
import { STORAGE_STATE_COLORS as STATE_COLORS } from '@/utils/colors'
import { useAdminGenres, useCreateGenre, useUpdateGenre, useBulkDeleteGenres, useBulkRestoreGenres } from '@/hooks/useAdmin'

interface GenreFormData {
  name: string
  description: string
}

export default function AdminGenrePage() {
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: pageData } = useAdminGenres({ keyword: keyword || undefined, size: 50 })
  const genres = pageData?.content ?? []

  const createMut = useCreateGenre()
  const updateMut = useUpdateGenre()
  const bulkDeleteMut = useBulkDeleteGenres()
  const bulkRestoreMut = useBulkRestoreGenres()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GenreFormData>()

  function openCreate() {
    setEditingItem(null)
    reset({ name: '', description: '' })
    setDialogOpen(true)
  }

  async function openEdit(genreId: number) {
    try {
      const res = await api.get(`/api/genres/${genreId}`)
      const g = res.data.data
      setEditingItem(g)
      reset({ name: g.name, description: g.description ?? '' })
      setDialogOpen(true)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Không thể tải dữ liệu'))
    }
  }

  function onSubmit(data: GenreFormData) {
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, data }, { onSuccess: () => setDialogOpen(false) })
    } else {
      createMut.mutate(data, { onSuccess: () => setDialogOpen(false) })
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
    if (selectedIds.size === genres.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(genres.map((g: any) => g.id)))
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Tìm kiếm thể loại..."
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

      {/* Table */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={genres.length > 0 && selectedIds.size === genres.length}
                  onChange={toggleAll} className="accent-[#eab308]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Tên thể loại</TableHead>
              <TableHead className="text-gray-400">Mô tả</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {genres.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-10">Không có dữ liệu</TableCell>
              </TableRow>
            )}
            {genres.map((g: any, index: number) => (
              <TableRow key={g.id} className="border-white/5 hover:bg-white/5 group">
                <TableCell className="whitespace-nowrap">
                  <input type="checkbox" checked={selectedIds.has(g.id)}
                    onChange={() => toggleSelect(g.id)} className="accent-[#eab308]" />
                </TableCell>
                <TableCell className="text-gray-500 text-sm whitespace-nowrap">{index + 1}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span onClick={() => openEdit(g.id)}
                    className="text-[#eab308] hover:underline cursor-pointer font-medium">
                    {g.name}
                  </span>
                </TableCell>
                <TableCell className="text-gray-400 text-sm whitespace-nowrap">{g.description || '—'}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={`text-xs px-2 py-1 rounded border ${STATE_COLORS[g.storageState] ?? ''}`}>
                    {label(STORAGE_STATE_LABELS, g.storageState)}
                  </span>
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
        message={`Bạn có chắc muốn lưu trữ ${selectedIds.size} thể loại đã chọn?`}
        loading={bulkDeleteMut.isPending}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md" className="bg-[#0a1929] border-white/5 text-white">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Chỉnh sửa thể loại' : 'Thêm thể loại mới'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogBody>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">Tên thể loại <span className="text-red-400">*</span></label>
                  <Input {...register('name', { required: 'Tên thể loại là bắt buộc', maxLength: { value: 50, message: 'Tối đa 50 ký tự' } })} />
                  {errors.name && <p className="text-red-400 text-xs mt-1">{String(errors.name.message)}</p>}
                </div>
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">Mô tả</label>
                  <Textarea {...register('description', { maxLength: { value: 500, message: 'Tối đa 500 ký tự' } })} rows={3} className="resize-none" />
                  {errors.description && <p className="text-red-400 text-xs mt-1">{String(errors.description.message)}</p>}
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
