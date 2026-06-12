import { useMemo, useState } from 'react'
import { Plus, X, MapPin, Phone } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import { FilterTrigger } from '@/components/common/FilterDrawer'

import TheaterFormDialog from './components/TheaterFormDialog'
import TheaterFilterDrawer from './components/TheaterFilterDrawer'

import {
  useAdminTheaters,
  useBulkArchiveTheaters, useBulkRestoreTheaters,
} from '@/hooks/useAdminTheaters'
import type { TheaterParams } from '@/hooks/useAdminTheaters'
import { useAuthStore } from '@/store/authStore'
import { label, STORAGE_STATE_LABELS } from '@/utils/labels'
import { THEATER_STATUS_COLORS, STORAGE_STATE_COLORS as STATE_COLORS } from '@/utils/colors'
import { usePageTitle } from '@/hooks/usePageTitle'

const THEATER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  MAINTENANCE: 'Bảo trì',
  CLOSED: 'Ngừng',
}

const PAGE_SIZE = 20
const SORT = 'createdAt,desc'

const EMPTY_FILTER: TheaterParams = {
  keyword: '',
  city: '',
  status: undefined,
  includeDeleted: true,
}

export default function AdminTheaterPage() {
  usePageTitle('Quản lý chi nhánh')
  const [appliedFilter, setAppliedFilter] = useState<TheaterParams>(EMPTY_FILTER)
  const [draftFilter, setDraftFilter] = useState<TheaterParams>(EMPTY_FILTER)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  // RBAC: Theater CRUD chỉ SUPER_ADMIN — BRANCH_ADMIN xem read-only.
  const isSuperAdmin = useAuthStore(s => s.isSuperAdmin())

  const { data: pageData } = useAdminTheaters({ ...appliedFilter, size: PAGE_SIZE, sort: SORT })
  const theaters = pageData?.content ?? []

  const activeCount = useMemo(() => {
    let n = 0
    if (appliedFilter.city) n++
    if (appliedFilter.status) n++
    if (appliedFilter.includeDeleted === false) n++
    return n
  }, [appliedFilter])

  const bulkArchiveMut = useBulkArchiveTheaters()
  const bulkRestoreMut = useBulkRestoreTheaters()

  function patchDraft(patch: Partial<TheaterParams>) {
    setDraftFilter(f => ({ ...f, ...patch }))
  }
  function applyDraft() {
    setAppliedFilter({ ...draftFilter })
    setDrawerOpen(false)
  }
  function resetDraft() {
    const cleared = { ...EMPTY_FILTER, keyword: appliedFilter.keyword }
    setDraftFilter(cleared)
    setAppliedFilter(cleared)
  }

  function openCreate() {
    setEditingId(null)
    setDialogOpen(true)
  }
  function openEdit(id: number) {
    setEditingId(id)
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
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    if (selectedIds.size === theaters.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(theaters.map(t => t.id)))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Tìm theo tên, mã, địa chỉ..."
              value={appliedFilter.keyword ?? ''}
              onChange={(e) => setAppliedFilter(f => ({ ...f, keyword: e.target.value }))}
            />
          </div>
          <FilterTrigger onClick={() => { setDraftFilter(appliedFilter); setDrawerOpen(true) }} activeCount={activeCount} />
          {activeCount > 0 && (
            <Button type="button" variant="ghost" onClick={resetDraft}
              className="text-gray-400 hover:text-white hover:bg-white/5 h-9 px-2"
              title="Xóa filter">
              <X size={14} />
            </Button>
          )}
        </div>
        {/* Theater CRUD chỉ SUPER_ADMIN — BRANCH_ADMIN xem read-only */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <Button onClick={openCreate} className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
              <Plus size={16} className="mr-1" /> Thêm chi nhánh
            </Button>
            <StatusDropdown
              onArchive={handleBulkArchive}
              onRestore={handleBulkRestore}
              archiveLoading={bulkArchiveMut.isPending}
              restoreLoading={bulkRestoreMut.isPending}
            />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#3f382d] overflow-clip bg-[#201b11]">
        <Table>
          <TableHeader>
            <TableRow className="border-[#3f382d] hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={theaters.length > 0 && selectedIds.size === theaters.length}
                  onChange={toggleAll} className="accent-[#ffc107]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Mã</TableHead>
              <TableHead className="text-gray-400">Tên chi nhánh</TableHead>
              <TableHead className="text-gray-400">Địa chỉ</TableHead>
              <TableHead className="text-gray-400">Liên hệ</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
              <TableHead className="text-gray-400">Lưu trữ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {theaters.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-10">Không có chi nhánh nào</TableCell>
              </TableRow>
            )}
            {theaters.map((t, idx) => {
              const isArchived = t.storageState === 'ARCHIVED'
              return (
              <TableRow key={t.id} className={`border-[#3f382d] hover:bg-white/5 ${isArchived ? 'opacity-50' : ''}`}>
                <TableCell><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} className="accent-[#ffc107]" /></TableCell>
                <TableCell className="text-gray-500 text-sm">{idx + 1}</TableCell>
                <TableCell>
                  <span className="text-xs font-mono px-2 py-1 rounded bg-[#2a2317] text-gray-300 border border-[#3f382d]">
                    {t.code}
                  </span>
                </TableCell>
                <TableCell>
                  <span onClick={() => openEdit(t.id)} className="text-[#ffc107] hover:underline cursor-pointer font-medium">
                    {t.name}
                  </span>
                  <div className="text-xs text-gray-500 mt-0.5">{t.city}</div>
                </TableCell>
                <TableCell className="text-gray-300 text-sm max-w-xs">
                  <div className="flex items-start gap-1.5">
                    <MapPin size={12} className="text-gray-500 mt-0.5 shrink-0" />
                    <span className="truncate">{t.address}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-300 text-sm">
                  {t.hotline && (
                    <div className="flex items-center gap-1.5">
                      <Phone size={12} className="text-gray-500" />
                      {t.hotline}
                    </div>
                  )}
                  {t.email && <div className="text-xs text-gray-500">{t.email}</div>}
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded-md border ${THEATER_STATUS_COLORS[t.status] ?? ''}`}>
                    {label(THEATER_STATUS_LABELS, t.status)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded-md border ${STATE_COLORS[t.storageState] ?? ''}`}>
                    {label(STORAGE_STATE_LABELS, t.storageState)}
                  </span>
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => bulkArchiveMut.mutate([...selectedIds], { onSuccess: () => { setSelectedIds(new Set()); setConfirmOpen(false) } })}
        message={`Bạn có chắc muốn lưu trữ ${selectedIds.size} chi nhánh đã chọn?`}
        loading={bulkArchiveMut.isPending}
      />

      <TheaterFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
      />

      <TheaterFilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        draftFilter={draftFilter}
        onPatchDraft={patchDraft}
        onApply={applyDraft}
        onReset={resetDraft}
      />
    </div>
  )
}
