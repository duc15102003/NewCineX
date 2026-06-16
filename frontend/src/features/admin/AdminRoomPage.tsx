import { useMemo, useState } from 'react'
import { Plus, X, DoorOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import { FilterTrigger } from '@/components/common/FilterDrawer'

import RoomFormDialog from './components/RoomFormDialog'
import RoomFilterDrawer, { type RoomFilterDraft } from './components/RoomFilterDrawer'
import RoomRow from './components/RoomRow'

import { useAdminRooms, useBulkDeleteRooms, useBulkRestoreRooms } from '@/hooks/useAdmin'
import type { AdminRoom, AdminRoomParams } from '@/hooks/useAdminRooms'
import { ADMIN_LIST_PAGE_SIZE } from '@/utils/constants'
import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import { useAuthStore } from '@/store/authStore'
import { usePageTitle } from '@/hooks/usePageTitle'

const EMPTY_ROOM_FILTER: RoomFilterDraft = {
  type: '', status: '', minSeats: '', maxSeats: '', includeDeleted: true,
}

export default function AdminRoomPage() {
  usePageTitle('Quản lý phòng chiếu')
  const [keywordInput, setKeywordInput] = useState('')
  const keyword = useDebouncedValue(keywordInput, 400)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminRoom | null>(null)

  const [appliedFilter, setAppliedFilter] = useState<RoomFilterDraft>(EMPTY_ROOM_FILTER)
  const [draftFilter, setDraftFilter] = useState<RoomFilterDraft>(EMPTY_ROOM_FILTER)
  const [filterOpen, setFilterOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { currentTheater: adminTheater } = useAdminTheaterStore()
  const { user, isBranchAdmin } = useAuthStore()
  const userTheaterId = user?.theaterId ?? null
  const scopedTheaterId = adminTheater?.id ?? (isBranchAdmin() ? userTheaterId : null)
  const theaterLocked = scopedTheaterId != null

  const queryParams = useMemo<AdminRoomParams>(() => {
    const p: AdminRoomParams = { size: ADMIN_LIST_PAGE_SIZE, includeDeleted: appliedFilter.includeDeleted }
    if (keyword) p.keyword = keyword
    if (adminTheater?.id) p.theaterId = adminTheater.id
    if (appliedFilter.type) p.type = appliedFilter.type
    if (appliedFilter.status) p.status = appliedFilter.status
    if (appliedFilter.minSeats) p.minSeats = Number(appliedFilter.minSeats)
    if (appliedFilter.maxSeats) p.maxSeats = Number(appliedFilter.maxSeats)
    return p
  }, [keyword, adminTheater, appliedFilter])

  // includeDeleted=true là default, không tính active filter
  const activeFilterCount = useMemo(() => {
    let c = 0
    if (appliedFilter.type) c++
    if (appliedFilter.status) c++
    if (appliedFilter.minSeats) c++
    if (appliedFilter.maxSeats) c++
    if (!appliedFilter.includeDeleted) c++
    return c
  }, [appliedFilter])

  const { data: pageData } = useAdminRooms(queryParams)
  const rooms = pageData?.content ?? []

  const bulkDeleteMut = useBulkDeleteRooms()
  const bulkRestoreMut = useBulkRestoreRooms()

  function openFilter() {
    setDraftFilter(appliedFilter)
    setFilterOpen(true)
  }
  function applyFilter() {
    setAppliedFilter(draftFilter)
    setFilterOpen(false)
  }
  function resetFilter() {
    setDraftFilter(EMPTY_ROOM_FILTER)
    setAppliedFilter(EMPTY_ROOM_FILTER)
  }
  function setDraft<K extends keyof RoomFilterDraft>(key: K, val: RoomFilterDraft[K]) {
    setDraftFilter((prev) => ({ ...prev, [key]: val }))
  }

  function handleBulkArchive() {
    if (selectedIds.size === 0) { toast.error('Hãy chọn ít nhất 1 mục'); return }
    setConfirmOpen(true)
  }
  function handleBulkRestore() {
    if (selectedIds.size === 0) { toast.error('Hãy chọn ít nhất 1 mục'); return }
    bulkRestoreMut.mutate([...selectedIds], { onSuccess: () => setSelectedIds(new Set()) })
  }
  function onConfirmDelete() {
    bulkDeleteMut.mutate([...selectedIds], { onSuccess: () => setConfirmOpen(false) })
  }

  function openCreate() {
    setEditingItem(null)
    setDialogOpen(true)
  }
  function openEdit(room: AdminRoom) {
    setEditingItem(room)
    setDialogOpen(true)
  }
  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    if (selectedIds.size === rooms.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rooms.map((r) => r.id)))
    }
  }

  const renderRoomRow = (r: AdminRoom, index: number, indent = false) => (
    <RoomRow
      key={r.id}
      room={r}
      index={index}
      indent={indent}
      selected={selectedIds.has(r.id)}
      onToggleSelect={toggleSelect}
      onEdit={openEdit}
    />
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Tìm theo tên phòng..."
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

      <RoomFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        draftFilter={draftFilter}
        onSetDraft={setDraft}
        onApply={applyFilter}
        onReset={resetFilter}
      />

      {/* Table */}
      <div className="rounded-2xl border border-[#3f382d] overflow-clip">
        <Table>
          <TableHeader>
            <TableRow className="border-[#3f382d] hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={rooms.length > 0 && selectedIds.size === rooms.length}
                  onChange={toggleAll} className="accent-[#ffc107]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Tên phòng</TableHead>
              <TableHead className="text-gray-400">Loại</TableHead>
              <TableHead className="text-gray-400">Tổng ghế</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
              <TableHead className="text-gray-400">Lưu trữ</TableHead>
              <TableHead className="text-gray-400 text-right">Tạo ghế</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <DoorOpen size={32} className="text-gray-600" />
                    <p className="text-sm">{keywordInput ? `Không tìm thấy phòng khớp "${keywordInput}"` : 'Chưa có phòng chiếu'}</p>
                    {!keywordInput && activeFilterCount === 0 && (
                      <button onClick={openCreate}
                        className="text-xs text-[#ffc107] hover:underline">
                        Thêm phòng đầu tiên
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {rooms.map((r, idx) => renderRoomRow(r, idx))}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs — đã tách thành component riêng (SRP) */}
      <RoomFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        scopedTheaterId={scopedTheaterId}
        theaterLocked={theaterLocked}
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onConfirmDelete}
        message={`Bạn có chắc muốn lưu trữ ${selectedIds.size} mục đã chọn?`}
        loading={bulkDeleteMut.isPending}
      />
    </div>
  )
}
