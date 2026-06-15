import { useMemo, useState, useRef } from 'react'
import { Plus, X, Coffee } from 'lucide-react'
import { toast } from 'sonner'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import { FilterTrigger } from '@/components/common/FilterDrawer'

import SnackFormDialog from './components/SnackFormDialog'
import SnackFilterDrawer, { type SnackFilterDraft } from './components/SnackFilterDrawer'
import SnackRow from './components/SnackRow'

import { useAdminSnacks, useBulkDeleteSnacks, useBulkRestoreSnacks } from '@/hooks/useAdmin'
import { useUploadSnackImage } from '@/hooks/useAdminSnacks'
import type { AdminSnack, AdminSnackParams } from '@/hooks/useAdminSnacks'
import { ADMIN_LIST_PAGE_SIZE } from '@/utils/constants'
import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import { useAuthStore } from '@/store/authStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { validateImageUpload } from '@/utils/image'

/** Danh mục snack — match BE convention (lưu chuỗi tiếng Việt).
    KHÔNG có 'Combo' vì đã tách module Combo riêng — bán Snack thuần ở đây để không trùng. */
const SNACK_CATEGORIES = ['Bắp rang', 'Nước uống', 'Khác'] as const

const EMPTY_SNACK_FILTER: SnackFilterDraft = {
  category: '', available: '', minPrice: '', maxPrice: '', includeDeleted: true,
}

export default function AdminSnackPage() {
  usePageTitle('Quản lý đồ ăn')
  const [keywordInput, setKeywordInput] = useState('')
  const keyword = useDebouncedValue(keywordInput, 400)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminSnack | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [appliedFilter, setAppliedFilter] = useState<SnackFilterDraft>(EMPTY_SNACK_FILTER)
  const [draftFilter, setDraftFilter] = useState<SnackFilterDraft>(EMPTY_SNACK_FILTER)
  const [filterOpen, setFilterOpen] = useState(false)

  // Admin theater scope
  const { currentTheater: adminTheater } = useAdminTheaterStore()
  const { user, isBranchAdmin } = useAuthStore()
  const userTheaterId = user?.theaterId ?? null
  const scopedTheaterId = adminTheater?.id ?? (isBranchAdmin() ? userTheaterId : null)
  const theaterLocked = scopedTheaterId != null

  const queryParams = useMemo<AdminSnackParams>(() => {
    const p: AdminSnackParams = { size: ADMIN_LIST_PAGE_SIZE, includeDeleted: appliedFilter.includeDeleted }
    if (keyword) p.keyword = keyword
    if (adminTheater?.id) p.theaterId = adminTheater.id
    if (appliedFilter.category) p.category = appliedFilter.category
    if (appliedFilter.available !== '') p.available = appliedFilter.available === 'true'
    if (appliedFilter.minPrice) p.minPrice = Number(appliedFilter.minPrice)
    if (appliedFilter.maxPrice) p.maxPrice = Number(appliedFilter.maxPrice)
    return p
  }, [keyword, appliedFilter, adminTheater])

  const activeFilterCount = useMemo(() => {
    let c = 0
    if (appliedFilter.category) c++
    if (appliedFilter.available !== '') c++
    if (appliedFilter.minPrice) c++
    if (appliedFilter.maxPrice) c++
    if (!appliedFilter.includeDeleted) c++
    return c
  }, [appliedFilter])

  const { data: pageData } = useAdminSnacks(queryParams)
  const snacks = pageData?.content ?? []

  function openFilter() {
    setDraftFilter(appliedFilter)
    setFilterOpen(true)
  }
  function applyFilter() {
    setAppliedFilter(draftFilter)
    setFilterOpen(false)
  }
  function resetFilter() {
    setDraftFilter(EMPTY_SNACK_FILTER)
    setAppliedFilter(EMPTY_SNACK_FILTER)
  }
  function setDraft<K extends keyof SnackFilterDraft>(key: K, val: SnackFilterDraft[K]) {
    setDraftFilter((prev) => ({ ...prev, [key]: val }))
  }

  const bulkDeleteMut = useBulkDeleteSnacks()
  const bulkRestoreMut = useBulkRestoreSnacks()
  const uploadImageMut = useUploadSnackImage()

  // Upload ảnh — action riêng tách khỏi form (theo CLAUDE.md File Upload Rules)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadId, setUploadId] = useState<number | null>(null)

  function handleUpload(id: number) {
    setUploadId(id)
    fileRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !uploadId) return
    const err = validateImageUpload(file)
    if (err) { toast.error(err); return }
    uploadImageMut.mutate({ id: uploadId, file })
  }

  function openCreate() {
    setEditingItem(null)
    setDialogOpen(true)
  }
  function openEdit(snack: AdminSnack) {
    setEditingItem(snack)
    setDialogOpen(true)
  }

  function handleBulkArchive() {
    if (selectedIds.size === 0) { toast.error('Hãy chọn ít nhất 1 mục'); return }
    setConfirmOpen(true)
  }
  function handleBulkRestore() {
    if (selectedIds.size === 0) { toast.error('Hãy chọn ít nhất 1 mục'); return }
    bulkRestoreMut.mutate([...selectedIds], { onSuccess: () => setSelectedIds(new Set()) })
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
      setSelectedIds(new Set(snacks.map((s) => s.id)))
    }
  }

  const renderSnackRow = (s: AdminSnack, index: number) => (
    <SnackRow
      key={s.id}
      snack={s}
      index={index}
      selected={selectedIds.has(s.id)}
      onToggleSelect={toggleSelect}
      onEdit={openEdit}
      onUpload={handleUpload}
    />
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Tìm theo tên đồ ăn..."
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
            />
          </div>
          <FilterTrigger onClick={openFilter} activeCount={activeFilterCount} />
          {activeFilterCount > 0 && (
            <Button type="button" variant="ghost" onClick={resetFilter}
              className="text-gray-400 hover:text-white hover:bg-white/5 h-9 px-2"
              title="Xóa filter">
              <X size={14} />
            </Button>
          )}
        </div>
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
      </div>

      <SnackFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        draftFilter={draftFilter}
        onSetDraft={setDraft}
        onApply={applyFilter}
        onReset={resetFilter}
        categories={SNACK_CATEGORIES}
      />

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {/* Table */}
      <div className="rounded-2xl border border-[#3f382d] overflow-clip">
        <Table>
          <TableHeader>
            <TableRow className="border-[#3f382d] hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={snacks.length > 0 && selectedIds.size === snacks.length}
                  onChange={toggleAll} className="accent-[#ffc107]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Tên</TableHead>
              <TableHead className="text-gray-400">Danh mục</TableHead>
              <TableHead className="text-gray-400">Giá</TableHead>
              <TableHead className="text-gray-400">Còn hàng</TableHead>
              <TableHead className="text-gray-400">Lưu trữ</TableHead>
              <TableHead className="text-gray-400 text-right">Upload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snacks.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Coffee size={32} className="text-gray-600" />
                    <p className="text-sm">{keywordInput ? `Không tìm thấy đồ ăn khớp "${keywordInput}"` : 'Chưa có đồ ăn nào'}</p>
                    {!keywordInput && activeFilterCount === 0 && (
                      <button onClick={openCreate}
                        className="text-xs text-[#ffc107] hover:underline">
                        Thêm đồ ăn đầu tiên
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {snacks.map((s, index) => renderSnackRow(s, index))}
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

      {/* Form Dialog — tách thành component riêng (SRP) */}
      <SnackFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        scopedTheaterId={scopedTheaterId}
        theaterLocked={theaterLocked}
      />
    </div>
  )
}

