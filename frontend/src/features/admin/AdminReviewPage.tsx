import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'

import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Loading from '@/components/common/Loading'
import EmptyState from '@/components/common/EmptyState'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { FilterTrigger } from '@/components/common/FilterDrawer'
import StatusDropdown from '@/components/common/StatusDropdown'

import ReviewFilterDrawer from './components/ReviewFilterDrawer'
import ReviewRow from './components/ReviewRow'

import { useMovies } from '@/hooks/useMovies'
import {
  useAdminReviewsPage,
  useAdminBulkDeleteReviews,
  useAdminBulkRestoreReviews,
  useAdminDeleteReviewMutation,
  useAdminRestoreReviewMutation,
  type AdminReviewFilter,
} from '@/hooks/useAdminReviews'

const PAGE_SIZE = 20
const MOVIES_DROPDOWN_SIZE = 200  // load nhiều cho filter dropdown — không phải list page admin
const EMPTY_FILTER: AdminReviewFilter = { includeDeleted: true }

export default function AdminReviewPage() {
  const [page, setPage] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [appliedFilter, setAppliedFilter] = useState<AdminReviewFilter>(EMPTY_FILTER)
  const [draftFilter, setDraftFilter] = useState<AdminReviewFilter>(EMPTY_FILTER)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [confirmBulkArchive, setConfirmBulkArchive] = useState(false)
  const [confirmBulkRestore, setConfirmBulkRestore] = useState(false)
  // confirmSingle = { id, action } — null nếu không có confirm pending
  const [confirmSingle, setConfirmSingle] = useState<{ id: number; action: 'archive' | 'restore' } | null>(null)

  const { data: moviesData } = useMovies({ size: MOVIES_DROPDOWN_SIZE })
  const movies = moviesData?.content ?? []

  const filter: AdminReviewFilter = {
    ...appliedFilter,
    keyword: keyword || undefined,
    page,
    size: PAGE_SIZE,
  }
  const { data, isLoading } = useAdminReviewsPage(filter)
  const reviews = data?.content ?? []
  const totalPages = data?.totalPages ?? 0

  const bulkDeleteMut = useAdminBulkDeleteReviews()
  const bulkRestoreMut = useAdminBulkRestoreReviews()
  const deleteMut = useAdminDeleteReviewMutation()
  const restoreMut = useAdminRestoreReviewMutation()

  // includeDeleted default true — không tính là "đã filter"
  const activeCount = useMemo(() => {
    let n = 0
    if (appliedFilter.movieId !== undefined) n++
    if (appliedFilter.userId !== undefined) n++
    if (appliedFilter.minRating !== undefined) n++
    if (appliedFilter.maxRating !== undefined) n++
    if (appliedFilter.hasComment !== undefined) n++
    if (appliedFilter.createdFrom) n++
    if (appliedFilter.createdTo) n++
    if (appliedFilter.includeDeleted === false) n++
    return n
  }, [appliedFilter])

  function patchDraft(patch: Partial<AdminReviewFilter>) {
    setDraftFilter((prev) => ({ ...prev, ...patch }))
  }
  function applyDraft() {
    setAppliedFilter({ ...draftFilter })
    setPage(0)
    setDrawerOpen(false)
  }
  function resetDraft() {
    setDraftFilter(EMPTY_FILTER)
    setAppliedFilter(EMPTY_FILTER)
    setPage(0)
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    if (selectedIds.size === reviews.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(reviews.map((r) => r.id)))
    }
  }

  function handleBulkArchive() {
    if (selectedIds.size === 0) { toast.error('Hãy chọn ít nhất 1 đánh giá'); return }
    setConfirmBulkArchive(true)
  }
  function handleBulkRestore() {
    if (selectedIds.size === 0) { toast.error('Hãy chọn ít nhất 1 đánh giá'); return }
    setConfirmBulkRestore(true)
  }
  function confirmBulkDelete() {
    bulkDeleteMut.mutate([...selectedIds], {
      onSuccess: () => { setSelectedIds(new Set()); setConfirmBulkArchive(false) },
    })
  }
  function confirmBulkRestoreAction() {
    bulkRestoreMut.mutate([...selectedIds], {
      onSuccess: () => { setSelectedIds(new Set()); setConfirmBulkRestore(false) },
    })
  }
  function confirmSingleAction() {
    if (!confirmSingle) return
    const mut = confirmSingle.action === 'archive' ? deleteMut : restoreMut
    mut.mutate(confirmSingle.id, {
      onSuccess: () => setConfirmSingle(null),
    })
  }

  if (isLoading && !data) return <Loading />

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Tìm theo user, phim, nội dung..."
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(0) }}
            />
          </div>
          <FilterTrigger
            onClick={() => { setDraftFilter(appliedFilter); setDrawerOpen(true) }}
            activeCount={activeCount}
          />
          {activeCount > 0 && (
            <Button type="button" variant="ghost" onClick={resetDraft}
              className="text-gray-400 hover:text-white hover:bg-white/5 h-9 px-2"
              title="Xóa filter">
              <X size={14} />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusDropdown
            onArchive={handleBulkArchive}
            onRestore={handleBulkRestore}
            archiveLoading={bulkDeleteMut.isPending}
            restoreLoading={bulkRestoreMut.isPending}
          />
        </div>
      </div>

      {/* Table */}
      {reviews.length === 0 ? (
        <EmptyState message="Không có đánh giá nào" />
      ) : (
        <div className="rounded-2xl border border-white/5 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={reviews.length > 0 && selectedIds.size === reviews.length}
                    onChange={toggleAll}
                    className="accent-[#ffc107]"
                  />
                </TableHead>
                <TableHead className="text-gray-400 w-12">#</TableHead>
                <TableHead className="text-gray-400">Người dùng</TableHead>
                <TableHead className="text-gray-400">Phim</TableHead>
                <TableHead className="text-gray-400">Rating</TableHead>
                <TableHead className="text-gray-400">Bình luận</TableHead>
                <TableHead className="text-gray-400">Trạng thái</TableHead>
                <TableHead className="text-gray-400">Tạo lúc</TableHead>
                <TableHead className="text-gray-400 text-right pr-4">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((r, index) => (
                <ReviewRow
                  key={r.id}
                  review={r}
                  index={page * PAGE_SIZE + index}
                  selected={selectedIds.has(r.id)}
                  onToggleSelect={() => toggleSelect(r.id)}
                  onRequestDelete={() => setConfirmSingle({ id: r.id, action: 'archive' })}
                  onRequestRestore={() => setConfirmSingle({ id: r.id, action: 'restore' })}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}
            className="border-white/10 text-gray-300 hover:bg-white/5">Trước</Button>
          <span className="text-gray-400 text-sm px-2 py-1">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
            className="border-white/10 text-gray-300 hover:bg-white/5">Sau</Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmBulkArchive}
        onClose={() => setConfirmBulkArchive(false)}
        onConfirm={confirmBulkDelete}
        title="Xác nhận xóa đánh giá"
        message={`Bạn có chắc muốn xóa ${selectedIds.size} đánh giá đã chọn?`}
        loading={bulkDeleteMut.isPending}
      />

      <ConfirmDialog
        open={confirmBulkRestore}
        onClose={() => setConfirmBulkRestore(false)}
        onConfirm={confirmBulkRestoreAction}
        title="Xác nhận khôi phục đánh giá"
        message={`Khôi phục ${selectedIds.size} đánh giá đã chọn?`}
        loading={bulkRestoreMut.isPending}
      />

      <ConfirmDialog
        open={confirmSingle !== null}
        onClose={() => setConfirmSingle(null)}
        onConfirm={confirmSingleAction}
        title={confirmSingle?.action === 'restore' ? 'Xác nhận khôi phục đánh giá' : 'Xác nhận xóa đánh giá'}
        message={confirmSingle?.action === 'restore'
          ? 'Khôi phục đánh giá này?'
          : 'Bạn có chắc muốn xóa đánh giá này?'}
        loading={confirmSingle?.action === 'restore' ? restoreMut.isPending : deleteMut.isPending}
      />

      <ReviewFilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        draftFilter={draftFilter}
        onPatchDraft={patchDraft}
        onApply={applyDraft}
        onReset={resetDraft}
        movies={movies}
      />
    </div>
  )
}

