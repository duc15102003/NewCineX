import { useEffect, useMemo, useState, useRef } from 'react'
import { Plus, X, Film } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import SortDropdown, { MOVIE_SORT_OPTIONS } from '@/components/common/SortDropdown'
import { FilterTrigger } from '@/components/common/FilterDrawer'
import MovieFilterDrawer from '@/components/admin/MovieFilterDrawer'

import MovieRunsDialog from './MovieRunsDialog'
import MovieFormDialog from './components/MovieFormDialog'
import MovieRow from './components/MovieRow'

import {
  useAdminMovies, useUploadPoster, useBulkDeleteMovies, useBulkRestoreMovies,
} from '@/hooks/useAdmin'
import { useAuthStore } from '@/store/authStore'
import { useGenres } from '@/hooks/useMovies'
import type { AdminMovieFilter } from '@/types/movie'
import { usePageTitle } from '@/hooks/usePageTitle'
import { validateImageUpload } from '@/utils/image'

const LIST_PAGE_SIZE = 10

export default function AdminMoviePage() {
  usePageTitle('Quản lý phim')
  const [page, setPage] = useState(0)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  // Debounce keyword 400ms — tránh fire API mỗi keystroke
  const debounceRef = useRef<number | null>(null)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setKeyword(keywordInput)
      setPage(0)
    }, 400)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
  }, [keywordInput])
  const [sort, setSort] = useState<string>('createdAt,desc')
  const [advancedFilter, setAdvancedFilter] = useState<AdminMovieFilter>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadId, setUploadId] = useState<number | null>(null)
  // RBAC: Movie CRUD chỉ SUPER_ADMIN — BRANCH_ADMIN xem read-only.
  const isSuperAdmin = useAuthStore(s => s.isSuperAdmin())
  // Dialog quản lý đợt chiếu (MovieRun)
  const [runsDialogOpen, setRunsDialogOpen] = useState(false)
  const [runsMovie, setRunsMovie] = useState<{ id: number; title: string } | null>(null)

  // includeDeleted default true cho admin — không tính là "đã filter"
  const activeFilterCount = useMemo(() => {
    return Object.entries(advancedFilter).filter(([k, v]) => {
      if (k === 'includeDeleted') return false
      return v !== undefined && v !== null && v !== ''
    }).length
  }, [advancedFilter])

  const { data: pageData } = useAdminMovies({
    ...advancedFilter,
    keyword: keyword || undefined,
    sort,
    page,
    size: LIST_PAGE_SIZE,
  })
  const movies = pageData?.content ?? []
  const totalPages = pageData?.totalPages ?? 0
  const { data: genres = [] } = useGenres()

  const uploadMut = useUploadPoster()
  const bulkDeleteMut = useBulkDeleteMovies()
  const bulkRestoreMut = useBulkRestoreMovies()

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
  function openEdit(movieId: number) {
    setEditingId(movieId)
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
    if (selectedIds.size === movies.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(movies.map((m) => m.id)))
    }
  }

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
    uploadMut.mutate({ id: uploadId, file })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Tìm kiếm phim..."
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
            />
          </div>
          <FilterTrigger onClick={() => setDrawerOpen(true)} activeCount={activeFilterCount} />
          {activeFilterCount > 0 && (
            <Button type="button" variant="ghost"
              onClick={() => { setAdvancedFilter({}); setPage(0) }}
              className="text-gray-400 hover:text-white hover:bg-white/5 h-9 px-2"
              title="Xóa filter">
              <X size={14} />
            </Button>
          )}
          <div className="w-48">
            <SortDropdown
              options={MOVIE_SORT_OPTIONS}
              value={sort}
              onChange={(v) => { setSort(v); setPage(0) }}
            />
          </div>
        </div>
        {/* Movie CRUD chỉ SUPER_ADMIN — BRANCH_ADMIN xem read-only, ẩn nút Create + Bulk */}
        {isSuperAdmin && (
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

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {/* Table */}
      <div className="rounded-2xl border border-[#3f382d] overflow-clip">
        <Table>
          <TableHeader>
            <TableRow className="border-[#3f382d] hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={movies.length > 0 && selectedIds.size === movies.length}
                  onChange={toggleAll} className="accent-[#ffc107]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Phim</TableHead>
              <TableHead className="text-gray-400">Đạo diễn</TableHead>
              <TableHead className="text-gray-400">Thể loại</TableHead>
              <TableHead className="text-gray-400">Thời lượng</TableHead>
              <TableHead className="text-gray-400">Độ tuổi</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
              <TableHead className="text-gray-400">Lưu trữ</TableHead>
              <TableHead className="text-gray-400">Điểm</TableHead>
              <TableHead className="text-gray-400 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movies.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Film size={32} className="text-gray-600" />
                    <p className="text-sm">{keywordInput ? `Không tìm thấy phim khớp "${keywordInput}"` : 'Chưa có phim nào'}</p>
                    {isSuperAdmin && !keywordInput && activeFilterCount === 0 && (
                      <button onClick={openCreate}
                        className="text-xs text-[#ffc107] hover:underline">
                        Thêm phim đầu tiên
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {movies.map((m, index) => (
              <MovieRow
                key={m.id}
                movie={m}
                index={page * LIST_PAGE_SIZE + index}
                selected={selectedIds.has(m.id)}
                onToggleSelect={toggleSelect}
                onEdit={openEdit}
                onUpload={handleUpload}
                onOpenRuns={(meta) => { setRunsMovie(meta); setRunsDialogOpen(true) }}
              />
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

      <MovieFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        value={advancedFilter}
        onApply={(f) => { setAdvancedFilter(f); setPage(0) }}
        genres={genres}
        isAdmin
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Xác nhận lưu trữ"
        message={`Bạn có chắc muốn lưu trữ ${selectedIds.size} mục đã chọn?`}
        onConfirm={onConfirmDelete}
        loading={bulkDeleteMut.isPending}
      />

      {/* Dialog quản lý đợt chiếu (MovieRun) */}
      <MovieRunsDialog
        open={runsDialogOpen}
        onClose={() => { setRunsDialogOpen(false); setRunsMovie(null) }}
        movieId={runsMovie?.id ?? null}
        movieTitle={runsMovie?.title}
      />

      {/* Form Dialog — tách thành component riêng (SRP) */}
      <MovieFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
      />
    </div>
  )
}

