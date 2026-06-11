import React, { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import { FilterTrigger } from '@/components/common/FilterDrawer'
import TheaterGroupHeaderRow from '@/components/admin/TheaterGroupHeaderRow'

import ShowtimeFormDialog from './components/ShowtimeFormDialog'
import ShowtimeFilterDrawer, { type ShowtimeFilterDraft } from './components/ShowtimeFilterDrawer'
import ShowtimeRow from './components/ShowtimeRow'

import {
  useAdminShowtimes, useAdminMovies, useAdminRooms,
  useBulkDeleteShowtimes, useBulkRestoreShowtimes,
} from '@/hooks/useAdmin'
import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import { useAuthStore } from '@/store/authStore'
import { groupByTheater } from '@/utils/groupByTheater'
import type { AdminShowtime, AdminShowtimeParams } from '@/hooks/useAdminShowtimes'
import type { AdminMovie } from '@/hooks/useAdminMovies'
import { OPTIONS_DROPDOWN_PAGE_SIZE } from '@/utils/constants'

const EMPTY_FILTER: ShowtimeFilterDraft = {
  movieId: '', roomId: '', status: '', roomType: '',
  startDate: '', startTimeFrom: '', startTimeTo: '',
  minPrice: '', maxPrice: '',
  includeDeleted: '',
}

const LIST_PAGE_SIZE = 10

export default function AdminShowtimePage() {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [appliedFilter, setAppliedFilter] = useState<ShowtimeFilterDraft>(EMPTY_FILTER)
  const [draftFilter, setDraftFilter] = useState<ShowtimeFilterDraft>(EMPTY_FILTER)
  const [filterOpen, setFilterOpen] = useState(false)

  // Theater scope
  const { currentTheater: adminTheater } = useAdminTheaterStore()
  const user = useAuthStore((s) => s.user)
  const isBranchAdmin = useAuthStore((s) => s.isBranchAdmin)
  const userTheaterId = user?.theaterId ?? null
  const scopedTheaterId = adminTheater?.id ?? (isBranchAdmin() ? userTheaterId : null)
  const theaterLocked = scopedTheaterId != null

  const queryParams = useMemo<AdminShowtimeParams>(() => {
    const p: AdminShowtimeParams = { page, size: LIST_PAGE_SIZE }
    if (keyword) p.keyword = keyword
    if (adminTheater?.id) p.theaterId = adminTheater.id
    if (appliedFilter.movieId) p.movieId = Number(appliedFilter.movieId)
    if (appliedFilter.roomId) p.roomId = Number(appliedFilter.roomId)
    if (appliedFilter.status) p.status = appliedFilter.status
    if (appliedFilter.roomType) p.roomType = appliedFilter.roomType
    if (appliedFilter.startDate) p.startDate = appliedFilter.startDate
    if (appliedFilter.startTimeFrom) p.startTimeFrom = appliedFilter.startTimeFrom
    if (appliedFilter.startTimeTo) p.startTimeTo = appliedFilter.startTimeTo
    if (appliedFilter.minPrice) p.minPrice = Number(appliedFilter.minPrice)
    if (appliedFilter.maxPrice) p.maxPrice = Number(appliedFilter.maxPrice)
    if (appliedFilter.includeDeleted === 'true') p.includeDeleted = true
    return p
  }, [keyword, page, appliedFilter, adminTheater])

  const activeFilterCount = useMemo(
    () => Object.values(appliedFilter).filter((v) => v !== '').length,
    [appliedFilter],
  )

  const { data: pageData } = useAdminShowtimes(queryParams)
  const showtimes = pageData?.content ?? []
  const totalPages = pageData?.totalPages ?? 0

  // Movies + rooms cho filter dropdown (cần riêng — form dialog có instance riêng nhưng RQ dedupe)
  const { data: moviesData } = useAdminMovies({ size: OPTIONS_DROPDOWN_PAGE_SIZE })
  const movies = useMemo(
    () => (moviesData?.content ?? []).filter(
      (m: AdminMovie) => m.status === 'NOW_SHOWING' || m.status === 'COMING_SOON',
    ),
    [moviesData],
  )
  const { data: roomsData } = useAdminRooms({ size: OPTIONS_DROPDOWN_PAGE_SIZE })
  const rooms = roomsData?.content ?? []

  // Grouped view khi SUPER_ADMIN xem "Tất cả chi nhánh"
  const showGrouped = !adminTheater
  const groupedShowtimes = useMemo(
    () => (showGrouped ? groupByTheater(showtimes) : null),
    [showtimes, showGrouped],
  )
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const toggleGroup = (theaterId: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      next.has(theaterId) ? next.delete(theaterId) : next.add(theaterId)
      return next
    })
  }

  const bulkDeleteMut = useBulkDeleteShowtimes()
  const bulkRestoreMut = useBulkRestoreShowtimes()

  function openFilter() {
    setDraftFilter(appliedFilter)
    setFilterOpen(true)
  }
  function applyFilter() {
    setAppliedFilter(draftFilter)
    setPage(0)
    setFilterOpen(false)
  }
  function resetFilter() {
    setDraftFilter(EMPTY_FILTER)
    setAppliedFilter(EMPTY_FILTER)
    setPage(0)
  }
  function setDraft<K extends keyof ShowtimeFilterDraft>(key: K, val: string) {
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
    setEditingId(null)
    setDialogOpen(true)
  }
  function openEdit(showtimeId: number) {
    setEditingId(showtimeId)
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
    if (selectedIds.size === showtimes.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(showtimes.map((s) => s.id)))
    }
  }

  const renderShowtimeRow = (s: AdminShowtime, idx: number) => (
    <ShowtimeRow
      key={s.id}
      showtime={s}
      index={idx}
      selected={selectedIds.has(s.id)}
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
              placeholder="Tìm theo tên phim..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
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

      <ShowtimeFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        draftFilter={draftFilter}
        onSetDraft={setDraft}
        onApply={applyFilter}
        onReset={resetFilter}
        movies={movies}
        rooms={rooms}
      />

      {/* Table */}
      <div className="rounded-2xl border border-white/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={showtimes.length > 0 && selectedIds.size === showtimes.length}
                  onChange={toggleAll} className="accent-[#ffc107]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Phim / Giờ chiếu</TableHead>
              <TableHead className="text-gray-400">Phòng</TableHead>
              <TableHead className="text-gray-400">Giá</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
              <TableHead className="text-gray-400">Lưu trữ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showtimes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-10">Chưa có suất chiếu</TableCell>
              </TableRow>
            )}

            {showGrouped && groupedShowtimes && groupedShowtimes.map((group) => {
              const isCollapsed = collapsedGroups.has(group.theaterId)
              return (
                <React.Fragment key={`group-${group.theaterId}`}>
                  <TheaterGroupHeaderRow
                    collapsed={isCollapsed}
                    onToggle={() => toggleGroup(group.theaterId)}
                    theaterName={group.theaterName}
                    theaterCity={group.theaterCity}
                    itemCount={group.items.length}
                    itemLabel="suất chiếu"
                    colSpan={6}
                  />
                  {!isCollapsed && group.items.map((s, index) => renderShowtimeRow(s, index))}
                </React.Fragment>
              )
            })}

            {!showGrouped && showtimes.map((s, index) => renderShowtimeRow(s, page * LIST_PAGE_SIZE + index))}
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

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Xác nhận lưu trữ"
        message={`Bạn có chắc muốn lưu trữ ${selectedIds.size} mục đã chọn?`}
        onConfirm={onConfirmDelete}
        loading={bulkDeleteMut.isPending}
      />

      {/* Form Dialog — đã tách thành component riêng (SRP) */}
      <ShowtimeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        scopedTheaterId={scopedTheaterId}
        theaterLocked={theaterLocked}
      />
    </div>
  )
}
