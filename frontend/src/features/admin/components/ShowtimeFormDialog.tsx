import { useEffect, useMemo } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PriceInput } from '@/components/ui/price-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'

import {
  useCreateShowtime, useUpdateShowtime, useShowtimeDetail, useAdminMovies, useAdminRooms,
} from '@/hooks/useAdmin'
import { useMovieRuns } from '@/hooks/useMovieRuns'
import { useTheaterOptions, type Theater } from '@/hooks/useAdminTheaters'
import type { AdminRoom } from '@/hooks/useAdminRooms'
import type { AdminMovie } from '@/hooks/useAdminMovies'
import { useAuthStore } from '@/store/authStore'
import { OPTIONS_DROPDOWN_PAGE_SIZE } from '@/utils/constants'
import { label, ROOM_TYPE_LABELS, MOVIE_RUN_TYPE_LABELS, fmtDate, toLocalDateTimeInput } from '@/utils/labels'

interface ShowtimeFormData {
  movieId: number
  movieRunId?: number | ''
  theaterId: number | ''
  roomId: number
  startTime: string
  basePrice: number
  vipPrice: number
  couplePrice: number
}

export interface ShowtimeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Khi edit chỉ cần truyền {id} — dialog tự fetch detail bằng useShowtimeDetail. */
  editingId: number | null
  scopedTheaterId: number | null
  theaterLocked: boolean
}

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

/**
 * Dialog tạo/sửa suất chiếu với chained dropdown: phim → đợt chiếu, chi nhánh → phòng.
 * Tách ra component riêng (SRP). Edit mode tự fetch detail (useShowtimeDetail).
 */
export default function ShowtimeFormDialog({
  open, onOpenChange, editingId, scopedTheaterId, theaterLocked,
}: ShowtimeFormDialogProps) {
  const isEditMode = editingId != null

  const { data: showtimeDetail } = useShowtimeDetail(editingId ?? undefined)
  const { data: moviesData } = useAdminMovies({ size: OPTIONS_DROPDOWN_PAGE_SIZE })
  const { data: roomsData } = useAdminRooms({ size: OPTIONS_DROPDOWN_PAGE_SIZE })
  const { data: theaters = [] } = useTheaterOptions()
  const { isBranchAdmin } = useAuthStore()

  const createMut = useCreateShowtime()
  const updateMut = useUpdateShowtime()

  // Movies dropdown: chỉ phim NOW_SHOWING + COMING_SOON
  const movies = useMemo(
    () => (moviesData?.content ?? []).filter(
      (m: AdminMovie) => m.status === 'NOW_SHOWING' || m.status === 'COMING_SOON',
    ),
    [moviesData],
  )
  const rooms = roomsData?.content ?? []

  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm<ShowtimeFormData>()

  // Watch: movieId → lazy load runs; theaterId → filter rooms + đợt chiếu.
  // Cascading filter chuẩn industry: chọn chi nhánh trước → dropdown đợt chiếu
  // CHỈ hiện run của chi nhánh đó (MovieRun PER-THEATER). Tránh case admin chọn
  // run rạp B trong khi phòng thuộc rạp A → BE chặn "Đợt chiếu không thuộc chi nhánh".
  const selectedMovieId = useWatch({ control, name: 'movieId' })
  const selectedTheaterId = useWatch({ control, name: 'theaterId' })
  const { data: movieRuns = [] } = useMovieRuns(
    selectedMovieId ? Number(selectedMovieId) : undefined,
    selectedTheaterId ? Number(selectedTheaterId) : undefined,
  )
  const filteredRooms = useMemo<AdminRoom[]>(() => {
    if (!selectedTheaterId) return []
    return rooms.filter((r) => r.theaterId === Number(selectedTheaterId))
  }, [rooms, selectedTheaterId])

  // Reset form khi dialog mở — edit mode đợi showtimeDetail load xong
  useEffect(() => {
    if (!open) return
    if (isEditMode) {
      if (!showtimeDetail) return  // chưa fetch xong
      reset({
        movieId: showtimeDetail.movieId,
        movieRunId: showtimeDetail.movieRunId ?? '',
        theaterId: showtimeDetail.theaterId,
        roomId: showtimeDetail.roomId,
        startTime: toLocalDateTimeInput(showtimeDetail.startTime),
        basePrice: showtimeDetail.basePrice,
        vipPrice: showtimeDetail.vipPrice ?? 0,
        couplePrice: showtimeDetail.couplePrice ?? 0,
      })
    } else {
      // Create mode: pre-fill theaterId từ scoped context
      reset({
        movieId: 0,
        movieRunId: '',
        theaterId: (scopedTheaterId ?? '') as number | '',
        roomId: 0,
        startTime: '',
        basePrice: 0,
        vipPrice: 0,
        couplePrice: 0,
      })
    }
  }, [open, isEditMode, showtimeDetail, scopedTheaterId, reset])

  function onSubmit(data: ShowtimeFormData) {
    if (!validatePriceTier(data)) return

    const payload = {
      movieId: Number(data.movieId),
      // Để trống → BE auto-pick MovieRun phù hợp (NOW_SHOWING > SCHEDULED gần nhất)
      movieRunId: data.movieRunId ? Number(data.movieRunId) : undefined,
      roomId: Number(data.roomId),
      startTime: data.startTime,
      basePrice: Number(data.basePrice) || 0,
      vipPrice: Number(data.vipPrice) || 0,
      couplePrice: Number(data.couplePrice) || 0,
    }
    if (isEditMode && editingId != null) {
      updateMut.mutate({ id: editingId, data: payload }, { onSuccess: () => onOpenChange(false) })
    } else {
      createMut.mutate(payload, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="bg-[#201b11] border-white/5 text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Chỉnh sửa suất chiếu' : 'Thêm mới suất chiếu'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Phim <span className="text-red-400">*</span></label>
                <select {...register('movieId', {
                  required: 'Vui lòng chọn phim',
                  onChange: () => setValue('movieRunId', ''),
                })} className={SELECT_CLS}>
                  <option value="">-- Chọn phim --</option>
                  {movies.map((m: AdminMovie) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
                {errors.movieId && <p className="text-red-400 text-xs mt-1">{String(errors.movieId.message)}</p>}
              </div>

              <TheaterRoomChain
                register={register}
                errors={errors}
                theaterLocked={theaterLocked}
                isBranchAdminUser={isBranchAdmin()}
                theaters={theaters}
                filteredRooms={filteredRooms}
                selectedTheaterId={selectedTheaterId}
                onTheaterChange={() => {
                  setValue('roomId', '' as unknown as number)
                  // Đổi chi nhánh → reset đợt chiếu vì MovieRun đã chọn có thể không thuộc CN mới.
                  setValue('movieRunId', '')
                }}
              />

              <MovieRunSelect
                show={!!selectedMovieId}
                runs={movieRuns}
                register={register}
              />

              <div className="col-span-12">
                <label className="text-sm text-gray-400 mb-1.5 block">Giờ bắt đầu <span className="text-red-400">*</span></label>
                <Input type="datetime-local" {...register('startTime', { required: 'Giờ bắt đầu là bắt buộc' })} />
                {errors.startTime && <p className="text-red-400 text-xs mt-1">{String(errors.startTime.message)}</p>}
              </div>

              <PriceTierInputs control={control} errors={errors} />
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

// ============================================================
//  Sub-components — chia nhỏ JSX cha
// ============================================================

interface TheaterRoomChainProps {
  register: ReturnType<typeof useForm<ShowtimeFormData>>['register']
  errors: ReturnType<typeof useForm<ShowtimeFormData>>['formState']['errors']
  theaterLocked: boolean
  isBranchAdminUser: boolean
  theaters: Theater[]
  filteredRooms: AdminRoom[]
  selectedTheaterId: number | '' | undefined
  onTheaterChange: () => void
}

/**
 * Chained dropdown chi nhánh → phòng. Đổi chi nhánh tự reset roomId.
 * Locked: ẩn dropdown chi nhánh (chỉ hiện badge), phòng full width.
 */
function TheaterRoomChain({
  register, errors, theaterLocked, isBranchAdminUser, theaters, filteredRooms,
  selectedTheaterId, onTheaterChange,
}: TheaterRoomChainProps) {
  if (theaterLocked) {
    const theater = theaters.find(t => t.id === selectedTheaterId)
    const display = theater ? `${theater.name} — ${theater.city}` : `Chi nhánh #${selectedTheaterId}`
    return (
      <>
        <div className="col-span-6">
          <label className="text-sm text-gray-400 mb-1.5 block">
            Chi nhánh <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center gap-2 p-2.5 rounded-md border border-white/10 bg-[#2a2317]/40 h-10">
            <span className="text-white text-sm font-medium truncate">{display}</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">
            {isBranchAdminUser
              ? 'Chi nhánh được gán theo tài khoản.'
              : 'Đổi ở dropdown trên cùng nếu cần.'}
          </p>
          <input type="hidden" {...register('theaterId', { onChange: onTheaterChange })} />
        </div>
        <div className="col-span-6">
          <label className="text-sm text-gray-400 mb-1.5 block">Phòng chiếu <span className="text-red-400">*</span></label>
          <select {...register('roomId', { required: 'Vui lòng chọn phòng' })}
            className={SELECT_CLS}>
            <option value="">-- Chọn phòng --</option>
            {filteredRooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name} ({label(ROOM_TYPE_LABELS, r.type)})</option>
            ))}
          </select>
          {errors.roomId && <p className="text-red-400 text-xs mt-1">{String(errors.roomId.message)}</p>}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">
          Chi nhánh <span className="text-red-400">*</span>
        </label>
        <select {...register('theaterId', {
          required: 'Vui lòng chọn chi nhánh',
          onChange: onTheaterChange,
        })}
          className={SELECT_CLS}>
          <option value="">-- Chọn chi nhánh --</option>
          {theaters.map((t) => (
            <option key={t.id} value={t.id}>{t.name} — {t.city}</option>
          ))}
        </select>
        {errors.theaterId && <p className="text-red-400 text-xs mt-1">{String(errors.theaterId.message)}</p>}
      </div>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">Phòng chiếu <span className="text-red-400">*</span></label>
        <select {...register('roomId', { required: 'Vui lòng chọn phòng' })}
          disabled={!selectedTheaterId}
          className={`${SELECT_CLS} disabled:opacity-60 disabled:cursor-not-allowed`}>
          <option value="">{!selectedTheaterId ? '-- Chọn chi nhánh trước --' : '-- Chọn phòng --'}</option>
          {filteredRooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name} ({label(ROOM_TYPE_LABELS, r.type)})</option>
          ))}
        </select>
        {errors.roomId && <p className="text-red-400 text-xs mt-1">{String(errors.roomId.message)}</p>}
      </div>
    </>
  )
}

interface MovieRun {
  id: number
  runType: string
  status: string
  startDate: string
  endDate: string | null
}

interface MovieRunSelectProps {
  show: boolean
  runs: MovieRun[]
  register: ReturnType<typeof useForm<ShowtimeFormData>>['register']
}

/** Dropdown đợt chiếu — chỉ hiện khi đã chọn phim. Để trống → BE auto-pick. */
function MovieRunSelect({ show, runs, register }: MovieRunSelectProps) {
  if (!show) return null
  if (runs.length === 0) {
    return (
      <div className="col-span-12 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-xs text-orange-300">
        Phim này chưa có đợt chiếu nào tại chi nhánh hiện tại. Vào trang Phim,
        bấm icon{' '}
        <span className="inline-block px-1.5 py-0.5 rounded bg-[#2a2317] text-[#ffc107]">📅</span>{' '}
        để tạo đợt chiếu trước.
      </div>
    )
  }
  return (
    <div className="col-span-12">
      <label className="text-sm text-gray-400 mb-1.5 block">
        Đợt chiếu
        <span className="text-gray-500 text-xs ml-2">(để trống → tự chọn đợt phù hợp)</span>
      </label>
      <select {...register('movieRunId')} className={SELECT_CLS}>
        <option value="">Tự chọn (ưu tiên đang chiếu)</option>
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {label(MOVIE_RUN_TYPE_LABELS, r.runType)} · {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
            {' '}[{r.status === 'NOW_SHOWING' ? 'đang chiếu' : r.status === 'SCHEDULED' ? 'sắp chiếu' : 'đã kết thúc'}]
          </option>
        ))}
      </select>
    </div>
  )
}

interface PriceTierInputsProps {
  control: ReturnType<typeof useForm<ShowtimeFormData>>['control']
  errors: ReturnType<typeof useForm<ShowtimeFormData>>['formState']['errors']
}

/** 3 input giá: thường / VIP / đôi. Tách ra để JSX cha gọn. */
function PriceTierInputs({ control, errors }: PriceTierInputsProps) {
  return (
    <>
      <div className="col-span-4">
        <label className="text-sm text-gray-400 mb-1.5 block">Giá thường (đ) <span className="text-red-400">*</span></label>
        <Controller
          name="basePrice"
          control={control}
          rules={{ required: 'Giá vé là bắt buộc', min: { value: 1, message: 'Giá phải > 0' } }}
          render={({ field }) => (
            <PriceInput value={field.value} onChange={field.onChange} placeholder="VD: 75.000" />
          )}
        />
        {errors.basePrice && <p className="text-red-400 text-xs mt-1">{String(errors.basePrice.message)}</p>}
      </div>
      <div className="col-span-4">
        <label className="text-sm text-gray-400 mb-1.5 block">Giá VIP (đ)</label>
        <Controller
          name="vipPrice"
          control={control}
          rules={{ min: { value: 0, message: 'Giá không được âm' } }}
          render={({ field }) => (
            <PriceInput value={field.value} onChange={field.onChange} placeholder="VD: 100.000" />
          )}
        />
        {errors.vipPrice && <p className="text-red-400 text-xs mt-1">{String(errors.vipPrice.message)}</p>}
      </div>
      <div className="col-span-4">
        <label className="text-sm text-gray-400 mb-1.5 block">Giá đôi (đ)</label>
        <Controller
          name="couplePrice"
          control={control}
          rules={{ min: { value: 0, message: 'Giá không được âm' } }}
          render={({ field }) => (
            <PriceInput value={field.value} onChange={field.onChange} placeholder="VD: 150.000" />
          )}
        />
        {errors.couplePrice && <p className="text-red-400 text-xs mt-1">{String(errors.couplePrice.message)}</p>}
      </div>
    </>
  )
}

// ============================================================
//  Business validation — testable, không phụ thuộc state
// ============================================================

/** Validate thứ tự giá: base ≤ vip ≤ couple. Return false + toast nếu vi phạm. */
function validatePriceTier(data: ShowtimeFormData): boolean {
  const base = Number(data.basePrice) || 0
  const vip = Number(data.vipPrice) || 0
  const couple = Number(data.couplePrice) || 0

  if (vip > 0 && vip < base) {
    toast.error('Giá VIP phải lớn hơn hoặc bằng giá thường')
    return false
  }
  if (couple > 0 && couple < vip) {
    toast.error('Giá ghế đôi phải lớn hơn hoặc bằng giá VIP')
    return false
  }
  if (couple > 0 && couple < base) {
    toast.error('Giá ghế đôi phải lớn hơn hoặc bằng giá thường')
    return false
  }
  return true
}
