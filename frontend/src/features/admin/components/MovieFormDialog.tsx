import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import MultiSelect from '@/components/common/MultiSelect'

import {
  useCreateMovie, useUpdateMovie, useMovieDetail, useAllGenresIncludingArchived,
  type AdminGenreOption,
} from '@/hooks/useAdminMovies'
import { AGE_RATING_LABELS } from '@/utils/labels'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

/**
 * Form metadata phim. KHÔNG có status / releaseDate / endDate — các field đó là derived
 * từ MovieRun, không cho admin set tay. Quản lý lịch chiếu qua MovieRunsDialog.
 */
interface MovieFormData {
  title: string
  description: string
  duration: number
  trailerUrl: string
  director: string
  cast: string
  language: string
  ageRating: string  // P / K / T13 / T16 / T18 (KHÔNG có C — xem AgeRating.java BE)
  genreIds: number[]
}

export interface MovieFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Khi edit chỉ cần truyền movieId — dialog tự fetch detail. */
  editingId: number | null
}

/**
 * Dialog tạo/sửa Movie. Tách ra component riêng (SRP).
 * Edit mode tự fetch detail (useMovieDetail) thay vì page api.get() trực tiếp.
 */
export default function MovieFormDialog({ open, onOpenChange, editingId }: MovieFormDialogProps) {
  const isEditMode = editingId != null

  const { data: movieDetail } = useMovieDetail(editingId ?? undefined)
  const { data: allGenres = [] } = useAllGenresIncludingArchived()
  const createMut = useCreateMovie()
  const updateMut = useUpdateMovie()

  const genreOptions = allGenres.map((g: AdminGenreOption) => ({
    value: g.id,
    label: g.storageState === 'ARCHIVED' ? `${g.name} (đã lưu trữ)` : g.name,
  }))

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<MovieFormData>()
  const selectedGenres: number[] = watch('genreIds') ?? []

  // Reset form khi dialog mở — edit mode đợi movieDetail load
  useEffect(() => {
    if (!open) return
    if (isEditMode) {
      if (!movieDetail) return  // chưa fetch xong
      reset({
        title: movieDetail.title,
        description: movieDetail.description ?? '',
        duration: movieDetail.duration,
        trailerUrl: movieDetail.trailerUrl ?? '',
        director: movieDetail.director ?? '',
        cast: movieDetail.cast ?? '',
        language: movieDetail.language ?? '',
        ageRating: movieDetail.ageRating ?? 'P',
        genreIds: movieDetail.genres?.map((g) => g.id) ?? [],
      })
    } else {
      reset({
        title: '', description: '', duration: 0, trailerUrl: '',
        director: '', cast: '', language: '',
        ageRating: 'P', genreIds: [],
      })
    }
  }, [open, isEditMode, movieDetail, reset])

  function onSubmit(data: MovieFormData) {
    const payload = {
      ...data,
      duration: Number(data.duration),
      genreIds: data.genreIds?.map(Number) ?? [],
    }
    if (isEditMode && editingId != null) {
      updateMut.mutate({ id: editingId, data: payload },
        { onSuccess: () => onOpenChange(false) })
    } else {
      createMut.mutate(payload, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Chỉnh sửa phim' : 'Thêm mới phim'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Tên phim <span className="text-red-400">*</span></label>
                <Input {...register('title', {
                  required: 'Tên phim là bắt buộc',
                  maxLength: { value: 200, message: 'Tối đa 200 ký tự' },
                })} />
                {errors.title && <p className="text-red-400 text-xs mt-1">{String(errors.title.message)}</p>}
              </div>
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Mô tả</label>
                <Textarea {...register('description')} rows={3} />
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Thời lượng (phút) <span className="text-red-400">*</span></label>
                <Input type="number" {...register('duration', {
                  required: 'Thời lượng là bắt buộc',
                  min: { value: 1, message: 'Thời lượng phải > 0' },
                })} />
                {errors.duration && <p className="text-red-400 text-xs mt-1">{String(errors.duration.message)}</p>}
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Ngôn ngữ</label>
                <Input {...register('language', { maxLength: { value: 50, message: 'Tối đa 50 ký tự' } })} />
                {errors.language && <p className="text-red-400 text-xs mt-1">{String(errors.language.message)}</p>}
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Đạo diễn</label>
                <Input {...register('director', { maxLength: { value: 100, message: 'Tối đa 100 ký tự' } })} />
                {errors.director && <p className="text-red-400 text-xs mt-1">{String(errors.director.message)}</p>}
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Diễn viên</label>
                <Input {...register('cast', { maxLength: { value: 500, message: 'Tối đa 500 ký tự' } })} />
                {errors.cast && <p className="text-red-400 text-xs mt-1">{String(errors.cast.message)}</p>}
              </div>

              {/* Hint: vì sao không có status/dates trong form */}
              {isEditMode && (
                <div className="col-span-12 rounded-xl border border-[#3f382d] bg-[#2a2317]/40 px-4 py-3 text-xs text-gray-400">
                  <span className="text-[#ffc107] font-medium">Trạng thái &amp; lịch chiếu:</span>{' '}
                  được tính tự động từ các <b>đợt chiếu</b> (MovieRun). Bấm icon{' '}
                  <CalendarDays size={12} className="inline mb-0.5" /> trên hàng phim để quản lý đợt chiếu.
                </div>
              )}

              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">
                  Phân loại tuổi <span className="text-red-400">*</span>
                </label>
                <select {...register('ageRating', { required: 'Bắt buộc' })} className={SELECT_CLS}>
                  {Object.entries(AGE_RATING_LABELS).map(([v, lbl]) => (
                    <option key={v} value={v}>{lbl}</option>
                  ))}
                </select>
                <p className="text-gray-500 text-xs mt-1">Theo TT 25/2024/BVHTTDL</p>
              </div>
              <div className="col-span-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Trailer YouTube URL</label>
                <Input {...register('trailerUrl')} placeholder="https://www.youtube.com/watch?v=..." />
              </div>
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Thể loại</label>
                <MultiSelect
                  options={genreOptions}
                  selected={selectedGenres}
                  onChange={(ids) => setValue('genreIds', ids)}
                  placeholder="Tìm thể loại..."
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}
              className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
            <Button type="submit" className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
              disabled={createMut.isPending || updateMut.isPending}>Lưu</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
