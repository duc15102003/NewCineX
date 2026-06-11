import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import MovieRunsList from './components/MovieRunsList'
import MovieRunForm, { type MovieRunFormData } from './components/MovieRunForm'
import {
  useMovieRuns, useCreateMovieRun, useUpdateMovieRun, useArchiveMovieRun,
} from '@/hooks/useMovieRuns'
import { fmtDate } from '@/utils/labels'
import type { MovieRun, MovieRunRequest } from '@/types/movie'
import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import { useAuthStore } from '@/store/authStore'

interface MovieRunsDialogProps {
  open: boolean
  onClose: () => void
  movieId: number | null
  movieTitle?: string
}

/**
 * Dialog quản lý đợt chiếu (MovieRun) của 1 phim.
 *
 * Modes:
 *  - 'list': hiển thị bảng các đợt chiếu, có nút thêm/sửa/lưu trữ
 *  - 'form': hiển thị form tạo/sửa 1 đợt chiếu
 *
 * Dùng pattern "single dialog, 2 modes" thay vì nested dialog
 * để tránh stack modal trên modal (UX awkward).
 */
export default function MovieRunsDialog({ open, onClose, movieId, movieTitle }: MovieRunsDialogProps) {
  const [mode, setMode] = useState<'list' | 'form'>('list')
  const [editingRun, setEditingRun] = useState<MovieRun | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<MovieRun | null>(null)

  // Theater scope: branch ADMIN bị lock; SUPER_ADMIN dùng adminTheater dropdown
  const { currentTheater: adminTheater } = useAdminTheaterStore()
  const { user, isBranchAdmin } = useAuthStore()
  const scopedTheaterId = adminTheater?.id ?? (isBranchAdmin() ? user?.theaterId ?? null : null)

  const { data: runs = [], isLoading } = useMovieRuns(movieId ?? undefined, scopedTheaterId ?? undefined)
  const createMut = useCreateMovieRun()
  const updateMut = useUpdateMovieRun()
  const archiveMut = useArchiveMovieRun()

  useEffect(() => {
    if (!open) {
      setMode('list')
      setEditingRun(null)
    }
  }, [open])

  function openCreateForm() {
    setEditingRun(null)
    setMode('form')
  }

  function openEditForm(run: MovieRun) {
    setEditingRun(run)
    setMode('form')
  }

  function handleSubmit(data: MovieRunFormData) {
    if (!movieId) return
    if (!scopedTheaterId) {
      toast.error('Hãy chọn chi nhánh ở dropdown trên cùng trước khi tạo đợt chiếu')
      return
    }
    // endDate optional (open-ended pattern). Chỉ validate khi user có nhập.
    if (data.endDate && data.endDate < data.startDate) {
      toast.error('Ngày kết thúc phải sau ngày bắt đầu')
      return
    }
    const payload: MovieRunRequest = {
      movieId,
      theaterId: scopedTheaterId,
      startDate: data.startDate,
      endDate: data.endDate || null,
      runType: data.runType,
      notes: data.notes || undefined,
    }
    if (editingRun) {
      updateMut.mutate({ id: editingRun.id, data: payload }, {
        onSuccess: () => { setMode('list'); setEditingRun(null) },
      })
    } else {
      createMut.mutate(payload, { onSuccess: () => setMode('list') })
    }
  }

  function handleArchiveClick(run: MovieRun) {
    setArchiveTarget(run)
    setConfirmOpen(true)
  }

  function confirmArchive() {
    if (!archiveTarget) return
    archiveMut.mutate(archiveTarget.id, {
      onSuccess: () => {
        setConfirmOpen(false)
        setArchiveTarget(null)
      },
    })
  }

  const title = mode === 'list'
    ? 'Đợt chiếu'
    : editingRun ? 'Chỉnh sửa đợt chiếu' : 'Thêm đợt chiếu'

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent size="xl" className="bg-[#201b11] border-white/5 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mode === 'form' && (
                <button type="button" onClick={() => setMode('list')}
                  className="text-gray-400 hover:text-[#ffc107] -ml-1" title="Quay lại">
                  <ArrowLeft size={18} />
                </button>
              )}
              <span>
                {title}
                {movieTitle && <span className="text-gray-400 font-normal text-sm ml-2">— {movieTitle}</span>}
              </span>
            </DialogTitle>
          </DialogHeader>

          {mode === 'list' && (
            <>
              <DialogBody>
                <MovieRunsList
                  runs={runs}
                  isLoading={isLoading}
                  onCreate={openCreateForm}
                  onEdit={openEditForm}
                  onArchive={handleArchiveClick}
                />
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={onClose}
                  className="border-white/10 text-gray-300 hover:bg-white/5">Đóng</Button>
              </DialogFooter>
            </>
          )}

          {mode === 'form' && (
            <MovieRunForm
              editingRun={editingRun}
              saving={createMut.isPending || updateMut.isPending}
              onSubmit={handleSubmit}
              onCancel={() => setMode('list')}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setArchiveTarget(null) }}
        title="Xác nhận lưu trữ"
        message={
          archiveTarget
            ? `Bạn có chắc muốn lưu trữ đợt chiếu ${fmtDate(archiveTarget.startDate)} → ${archiveTarget.endDate ? fmtDate(archiveTarget.endDate) : 'chưa định ngày ngưng'}?`
            : ''
        }
        confirmText="Lưu trữ"
        onConfirm={confirmArchive}
        loading={archiveMut.isPending}
      />
    </>
  )
}
