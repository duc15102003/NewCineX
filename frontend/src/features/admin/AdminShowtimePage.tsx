import { useMemo, useState } from 'react'
import { Plus, Sparkles, X, List as ListIcon, Calendar as CalendarIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import TableSkeleton from '@/components/common/TableSkeleton'
import { FilterTrigger } from '@/components/common/FilterDrawer'
import { FEATURES } from '@/config/featureFlags'

import ShowtimeFormDialog from './components/ShowtimeFormDialog'
import AutoScheduleDialog from './components/AutoScheduleDialog'
import ShowtimeFilterDrawer, { type ShowtimeFilterDraft } from './components/ShowtimeFilterDrawer'
import ShowtimeRow from './components/ShowtimeRow'
import ShowtimeCalendarView from './components/ShowtimeCalendarView'

import {
  useAdminShowtimes, useAdminMovies, useAdminRooms,
  useBulkDeleteShowtimes, useBulkRestoreShowtimes,
  useBulkPublishShowtimes,
  useTheaterOptions,
} from '@/hooks/useAdmin'
import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import { useAuthStore } from '@/store/authStore'
import type { AdminShowtime, AdminShowtimeParams } from '@/hooks/useAdminShowtimes'
import type { AdminMovie } from '@/hooks/useAdminMovies'
import { OPTIONS_DROPDOWN_PAGE_SIZE } from '@/utils/constants'
import { usePageTitle } from '@/hooks/usePageTitle'

const EMPTY_FILTER: ShowtimeFilterDraft = {
  theaterId: '',
  movieId: '', roomId: '', status: '', roomType: '',
  startDate: '', startTimeFrom: '', startTimeTo: '',
  minPrice: '', maxPrice: '',
  includeDeleted: '',
}

const LIST_PAGE_SIZE = 10

export default function AdminShowtimePage() {
  usePageTitle('Quản lý suất chiếu')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [autoScheduleOpen, setAutoScheduleOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  // Preset cho click-to-create từ calendar view
  const [presetRoomId, setPresetRoomId] = useState<number | null>(null)
  const [presetStartTime, setPresetStartTime] = useState<string | null>(null)

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
    // Theater switcher (cấp trên) ưu tiên hơn filter drawer. Khi xem "Tất cả
    // chi nhánh" và user pick chi nhánh trong filter → mới áp dụng filter.theaterId.
    if (adminTheater?.id) p.theaterId = adminTheater.id
    else if (appliedFilter.theaterId) p.theaterId = Number(appliedFilter.theaterId)
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

  // Filter áp dụng cho calendar — KHÔNG bao gồm field date (calendar có
  // navigator ngày riêng, sẽ override). Giữ keyword + movieId/roomId/status/
  // roomType/price/includeDeleted để filter áp dụng nhất quán cả 2 view.
  const calendarExtraQuery = useMemo<AdminShowtimeParams>(() => {
    const p: AdminShowtimeParams = {}
    if (keyword) p.keyword = keyword
    if (!adminTheater?.id && appliedFilter.theaterId) p.theaterId = Number(appliedFilter.theaterId)
    if (appliedFilter.movieId) p.movieId = Number(appliedFilter.movieId)
    if (appliedFilter.roomId) p.roomId = Number(appliedFilter.roomId)
    if (appliedFilter.status) p.status = appliedFilter.status
    if (appliedFilter.roomType) p.roomType = appliedFilter.roomType
    if (appliedFilter.minPrice) p.minPrice = Number(appliedFilter.minPrice)
    if (appliedFilter.maxPrice) p.maxPrice = Number(appliedFilter.maxPrice)
    if (appliedFilter.includeDeleted === 'true') p.includeDeleted = true
    return p
  }, [keyword, appliedFilter, adminTheater])

  // Số filter "thực sự" áp dụng cho calendar — bỏ qua startTimeFrom/To vì
  // calendar luôn hiển thị full ngày. startDate VẪN được tính vì nó act as
  // "go to date" cho calendar.
  const calendarActiveFilterCount = useMemo(() => {
    const { startTimeFrom, startTimeTo, ...rest } = appliedFilter
    void startTimeFrom; void startTimeTo
    return Object.values(rest).filter((v) => v !== '').length
  }, [appliedFilter])

  // Force theater pick (industry standard): admin LUÔN xem 1 CN cụ thể qua
  // selector ở topbar. Không cần render cột "Chi nhánh" trong table nữa.
  const { data: pageData, isLoading } = useAdminShowtimes(queryParams)
  const showtimes = pageData?.content ?? []
  const totalPages = pageData?.totalPages ?? 0
  const tableCols = 7

  // Movies + rooms cho filter dropdown. PHẢI scope theo chi nhánh đang chọn —
  // nếu admin đứng ở Hà Nội mà dropdown show phòng/phim của các CN khác → user
  // confused. Dùng scopedTheaterId thay vì adminTheater.id để BRANCH_ADMIN
  // (đã lock theater) cũng được scope. (Form dialog có instance riêng nhưng
  // RQ dedupe nên không double fetch.)
  const { data: moviesData } = useAdminMovies({
    size: OPTIONS_DROPDOWN_PAGE_SIZE,
    theaterId: scopedTheaterId ?? undefined,
  })
  const movies = useMemo(
    () => (moviesData?.content ?? []).filter(
      (m: AdminMovie) => m.status === 'NOW_SHOWING' || m.status === 'COMING_SOON',
    ),
    [moviesData],
  )
  const { data: roomsData } = useAdminRooms({
    size: OPTIONS_DROPDOWN_PAGE_SIZE,
    theaterId: scopedTheaterId ?? undefined,
  })
  const rooms = roomsData?.content ?? []
  const { data: theaters = [] } = useTheaterOptions()

  const bulkDeleteMut = useBulkDeleteShowtimes()
  const bulkRestoreMut = useBulkRestoreShowtimes()
  const bulkPublishMut = useBulkPublishShowtimes()

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
  function handleBulkPublish() {
    if (selectedIds.size === 0) { toast.error('Hãy chọn ít nhất 1 mục'); return }
    bulkPublishMut.mutate([...selectedIds], { onSuccess: () => setSelectedIds(new Set()) })
  }
  function onConfirmDelete() {
    bulkDeleteMut.mutate([...selectedIds], { onSuccess: () => setConfirmOpen(false) })
  }

  function openCreate() {
    setEditingId(null)
    setPresetRoomId(null)
    setPresetStartTime(null)
    setDialogOpen(true)
  }
  function openEdit(showtimeId: number) {
    setEditingId(showtimeId)
    setPresetRoomId(null)
    setPresetStartTime(null)
    setDialogOpen(true)
  }
  function openCreateFromCalendar(roomId: number, startTime: string) {
    setEditingId(null)
    setPresetRoomId(roomId)
    setPresetStartTime(startTime)
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
      showTheater={false}
      onToggleSelect={toggleSelect}
      onEdit={openEdit}
    />
  )

  return (
    <div className="space-y-4">
      {/* View switcher — tách riêng khỏi action toolbar để toolbar bớt nhồi */}
      <div className="flex items-center justify-between border-b border-[#3f382d] pb-3 -mt-2">
        <div className="inline-flex rounded-lg border border-white/10 bg-[#2a2317] p-0.5">
          <button type="button" onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 h-8 text-xs rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-[#ffc107] text-black font-semibold' : 'text-gray-300 hover:text-white'
            }`}>
            <ListIcon size={13} /> Danh sách
          </button>
          <button type="button" onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1.5 px-3 h-8 text-xs rounded-md transition-colors ${
              viewMode === 'calendar' ? 'bg-[#ffc107] text-black font-semibold' : 'text-gray-300 hover:text-white'
            }`}>
            <CalendarIcon size={13} /> Lịch
          </button>
        </div>
      </div>

      {/* Toolbar: search/filter (trái) + action (phải) */}
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
          {FEATURES.autoSchedule && (
            <Button onClick={() => setAutoScheduleOpen(true)}
              variant="outline"
              className="border-[#ffc107]/40 text-[#ffc107] hover:bg-[#ffc107]/10 hover:text-[#ffc107] rounded-lg"
              title="Tạo nhiều suất chiếu cho 1 phim × N phòng × M ngày — 1 click">
              <Sparkles size={16} className="mr-1" /> Tạo hàng loạt
            </Button>
          )}
          <Button onClick={openCreate} className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
            <Plus size={16} className="mr-1" /> Thêm mới
          </Button>
          <StatusDropdown
            onArchive={handleBulkArchive}
            onRestore={handleBulkRestore}
            onPublish={handleBulkPublish}
            archiveLoading={bulkDeleteMut.isPending}
            restoreLoading={bulkRestoreMut.isPending}
            publishLoading={bulkPublishMut.isPending}
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
        theaters={theaters}
        showTheaterFilter={!theaterLocked}
        calendarMode={viewMode === 'calendar'}
      />

      {/* Calendar view (alternative to list) */}
      {viewMode === 'calendar' && (
        <ShowtimeCalendarView
          scopedTheaterId={scopedTheaterId}
          onCreateAt={openCreateFromCalendar}
          onEdit={openEdit}
          extraQuery={calendarExtraQuery}
          activeFilterCount={calendarActiveFilterCount}
          filterStartDate={appliedFilter.startDate}
        />
      )}

      {/* Table */}
      {viewMode === 'list' && (
      <div className="rounded-2xl border border-[#3f382d] overflow-clip">
        <Table>
          <TableHeader>
            <TableRow className="border-[#3f382d] hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={showtimes.length > 0 && selectedIds.size === showtimes.length}
                  onChange={toggleAll} className="accent-[#ffc107]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Phim / Giờ chiếu</TableHead>
              {/* Cột "Chi nhánh" bỏ — admin LUÔN xem 1 CN cụ thể (force pick ở topbar) */}
              <TableHead className="text-gray-400">Phòng</TableHead>
              <TableHead className="text-gray-400">Giá</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
              <TableHead className="text-gray-400">Lưu trữ</TableHead>
            </TableRow>
          </TableHeader>
          {isLoading && !pageData ? (
            <TableSkeleton rows={LIST_PAGE_SIZE} columns={tableCols} />
          ) : (
            <TableBody>
              {showtimes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={tableCols} className="text-center text-gray-500 py-10">Chưa có suất chiếu</TableCell>
                </TableRow>
              )}
              {showtimes.map((s, index) => renderShowtimeRow(s, page * LIST_PAGE_SIZE + index))}
            </TableBody>
          )}
        </Table>
      </div>
      )}

      {viewMode === 'list' && totalPages > 1 && (
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
        presetRoomId={presetRoomId}
        presetStartTime={presetStartTime}
      />

      {/* Auto-schedule Dialog — chỉ render khi feature flag bật. */}
      {FEATURES.autoSchedule && (
        <AutoScheduleDialog
          open={autoScheduleOpen}
          onOpenChange={setAutoScheduleOpen}
          scopedTheaterId={scopedTheaterId}
          theaterLocked={theaterLocked}
        />
      )}
    </div>
  )
}
