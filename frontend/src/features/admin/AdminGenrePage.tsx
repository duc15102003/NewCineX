import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, X, Tags } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import FilterDrawer, { FilterTrigger, FilterField } from '@/components/common/FilterDrawer'
import { label, STORAGE_STATE_LABELS } from '@/utils/labels'
import { STORAGE_STATE_COLORS as STATE_COLORS } from '@/utils/colors'
import { useAdminGenres, useCreateGenre, useUpdateGenre, useBulkDeleteGenres, useBulkRestoreGenres } from '@/hooks/useAdmin'
import { useAuthStore } from '@/store/authStore'
import { useGenreDetail } from '@/hooks/useAdminGenres'
import type { AdminGenre, AdminGenreFilter } from '@/hooks/useAdminGenres'
import { ADMIN_LIST_PAGE_SIZE } from '@/utils/constants'
import { usePageTitle } from '@/hooks/usePageTitle'

interface GenreFormData {
  name: string
  description: string
}

const EMPTY_FILTER: AdminGenreFilter = {
  keyword: '',
  hasMovies: undefined,
  includeDeleted: true,  // admin mặc định thấy cả ARCHIVED
}

export default function AdminGenrePage() {
  usePageTitle('Quản lý thể loại phim')
  const [appliedFilter, setAppliedFilter] = useState<AdminGenreFilter>(EMPTY_FILTER)
  const [draftFilter, setDraftFilter] = useState<AdminGenreFilter>(EMPTY_FILTER)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Keyword input local state — debounce 400ms trước khi gọi API để khỏi
  // fire request mỗi keystroke. Empty state cho biết user còn gõ vs đã search.
  const [keywordInput, setKeywordInput] = useState(appliedFilter.keyword ?? '')
  const debounceRef = useRef<number | null>(null)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setAppliedFilter(f => ({ ...f, keyword: keywordInput }))
    }, 400)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
  }, [keywordInput])

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminGenre | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  // RBAC: Genre CRUD chỉ SUPER_ADMIN — BRANCH_ADMIN xem read-only.
  const isAdmin = useAuthStore(s => s.isAdmin())

  // Auto-load detail khi mở Edit — React Query cache theo id, đỡ phải tự catch error
  const { data: editingDetail } = useGenreDetail(editingId)

  const { data: pageData } = useAdminGenres({ ...appliedFilter, size: ADMIN_LIST_PAGE_SIZE })
  const genres = pageData?.content ?? []

  // Đếm filter đang bật (không tính keyword vì nó visible)
  const activeCount = useMemo(() => {
    let n = 0
    if (appliedFilter.hasMovies !== undefined) n++
    if (appliedFilter.includeDeleted === false) n++  // chỉ bật badge khi tắt mặc định
    return n
  }, [appliedFilter])

  const createMut = useCreateGenre()
  const updateMut = useUpdateGenre()
  const bulkDeleteMut = useBulkDeleteGenres()
  const bulkRestoreMut = useBulkRestoreGenres()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GenreFormData>()

  function openCreate() {
    setEditingItem(null)
    setEditingId(null)
    reset({ name: '', description: '' })
    setDialogOpen(true)
  }

  function openEdit(genreId: number) {
    setEditingId(genreId)
    setDialogOpen(true)
  }

  // Khi useGenreDetail trả dữ liệu → bind vào form
  useEffect(() => {
    if (editingDetail) {
      setEditingItem(editingDetail)
      reset({ name: editingDetail.name, description: editingDetail.description ?? '' })
    }
  }, [editingDetail, reset])

  function onSubmit(data: GenreFormData) {
    const payload = data as unknown as Record<string, unknown>
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
    if (selectedIds.size === genres.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(genres.map((g) => g.id)))
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {/* LEFT: Search + Filter + Reset */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Tìm theo tên thể loại..."
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
            />
          </div>
          <FilterTrigger onClick={() => { setDraftFilter(appliedFilter); setDrawerOpen(true) }} activeCount={activeCount} />
          {activeCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setDraftFilter({ ...EMPTY_FILTER, keyword: appliedFilter.keyword }); setAppliedFilter({ ...EMPTY_FILTER, keyword: appliedFilter.keyword }) }}
              className="text-gray-400 hover:text-white hover:bg-white/5 h-9 px-2"
              title="Xóa filter"
            >
              <X size={14} />
            </Button>
          )}
        </div>
        {/* RIGHT: Add + Bulk actions — chỉ SUPER_ADMIN (Genre là content chung) */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button onClick={openCreate} className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
              <Plus size={16} className="mr-1" /> Thêm mới
            </Button>
            <StatusDropdown
              onArchive={handleBulkArchive}
              onRestore={handleBulkRestore}
              archiveLoading={bulkDeleteMut.isPending}
              restoreLoading={bulkRestoreMut.isPending}
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#3f382d] overflow-clip">
        <Table>
          <TableHeader>
            <TableRow className="border-[#3f382d] hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={genres.length > 0 && selectedIds.size === genres.length}
                  onChange={toggleAll} className="accent-[#ffc107]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Tên thể loại</TableHead>
              <TableHead className="text-gray-400">Mô tả</TableHead>
              <TableHead className="text-gray-400">Lưu trữ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {genres.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Tags size={32} className="text-gray-600" />
                    <p className="text-sm">{keywordInput ? `Không tìm thấy thể loại nào khớp "${keywordInput}"` : 'Chưa có thể loại nào'}</p>
                    {isAdmin && !keywordInput && (
                      <button onClick={openCreate}
                        className="text-xs text-[#ffc107] hover:underline">
                        Thêm thể loại đầu tiên
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {genres.map((g, index) => (
              <TableRow key={g.id} className="border-[#3f382d] hover:bg-white/5 group">
                <TableCell className="whitespace-nowrap">
                  <input type="checkbox" checked={selectedIds.has(g.id)}
                    onChange={() => toggleSelect(g.id)} className="accent-[#ffc107]" />
                </TableCell>
                <TableCell className="text-gray-500 text-sm whitespace-nowrap">{index + 1}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span onClick={() => openEdit(g.id)}
                    className="text-[#ffc107] hover:underline cursor-pointer font-medium">
                    {g.name}
                  </span>
                </TableCell>
                <TableCell className="text-gray-400 text-sm whitespace-nowrap">{g.description}</TableCell>
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
        <DialogContent size="md" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Chỉnh sửa thể loại' : 'Thêm mới thể loại'}</DialogTitle>
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
              <Button type="submit" className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
                disabled={createMut.isPending || updateMut.isPending}>Lưu</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filter Drawer */}
      <FilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Lọc thể loại"
        onApply={() => { setAppliedFilter({ ...draftFilter }); setDrawerOpen(false) }}
        onReset={() => { setDraftFilter({ ...EMPTY_FILTER, keyword: appliedFilter.keyword }); setAppliedFilter({ ...EMPTY_FILTER, keyword: appliedFilter.keyword }) }}
      >
        <FilterField label="Phạm vi sử dụng">
          <select
            value={draftFilter.hasMovies === undefined ? '' : String(draftFilter.hasMovies)}
            onChange={(e) => {
              const v = e.target.value
              setDraftFilter(f => ({ ...f, hasMovies: v === '' ? undefined : v === 'true' }))
            }}
            className="w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]"
          >
            <option value="">Tất cả</option>
            <option value="true">Chỉ thể loại đang được dùng</option>
            <option value="false">Chỉ thể loại chưa được dùng</option>
          </select>
        </FilterField>

        <FilterField label="Bao gồm bản đã lưu trữ" hint="Lưu trữ = ẩn khỏi danh sách thường, có thể khôi phục lại bất cứ lúc nào.">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draftFilter.includeDeleted ?? true}
              onChange={(e) => setDraftFilter(f => ({ ...f, includeDeleted: e.target.checked }))}
              className="accent-[#ffc107] w-4 h-4"
            />
            <span className="text-sm text-gray-300">Hiển thị thể loại đã lưu trữ</span>
          </label>
        </FilterField>
      </FilterDrawer>
    </div>
  )
}
