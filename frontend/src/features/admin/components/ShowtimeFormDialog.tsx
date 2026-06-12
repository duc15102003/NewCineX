import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'

import {
  useCreateShowtime, useUpdateShowtime, useShowtimeDetail, useAdminMovies, useAdminRooms,
} from '@/hooks/useAdmin'
import { useMovieRuns } from '@/hooks/useMovieRuns'
import { useTheaterOptions } from '@/hooks/useAdminTheaters'
import { useRoomSeatTypes, type AdminRoom, type SeatType } from '@/hooks/useAdminRooms'
import type { AdminMovie } from '@/hooks/useAdminMovies'
import { useAuthStore } from '@/store/authStore'
import { OPTIONS_DROPDOWN_PAGE_SIZE } from '@/utils/constants'
import { toLocalDateTimeInput } from '@/utils/labels'

import TheaterRoomChain from './showtime/TheaterRoomChain'
import MovieRunSelect from './showtime/MovieRunSelect'
import PriceTierInputs, { validatePriceTier } from './showtime/PriceTierInputs'
import { type ShowtimeFormData, SELECT_CLS } from './showtime/types'

export interface ShowtimeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Khi edit chỉ cần truyền {id} — dialog tự fetch detail bằng useShowtimeDetail. */
  editingId: number | null
  scopedTheaterId: number | null
  theaterLocked: boolean
}

/**
 * Dialog tạo/sửa suất chiếu với chained dropdown: phim → đợt chiếu, chi nhánh → phòng.
 * Sub-components ở thư mục `./showtime/` — TheaterRoomChain, MovieRunSelect, PriceTierInputs.
 * Edit mode tự fetch detail (useShowtimeDetail).
 */
export default function ShowtimeFormDialog({
  open, onOpenChange, editingId, scopedTheaterId, theaterLocked,
}: ShowtimeFormDialogProps) {
  const isEditMode = editingId != null

  const { data: showtimeDetail } = useShowtimeDetail(editingId ?? undefined)
  // Khi theater bị lock (BRANCH_ADMIN hoặc super admin đã pick 1 CN) → CHỈ
  // load phòng/phim của CN đó (tránh leak CN khác + tiết kiệm bandwidth).
  // Khi "Tất cả chi nhánh" → load all, form có cascading filter client-side.
  const { data: moviesData } = useAdminMovies({
    size: OPTIONS_DROPDOWN_PAGE_SIZE,
    theaterId: scopedTheaterId ?? undefined,
  })
  const { data: roomsData } = useAdminRooms({
    size: OPTIONS_DROPDOWN_PAGE_SIZE,
    theaterId: scopedTheaterId ?? undefined,
  })
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

  // Watch: movieId → lazy load runs; theaterId → filter rooms + đợt chiếu;
  // roomId → fetch seat types để render input giá ĐỘNG.
  // Cascading filter chuẩn industry: chọn chi nhánh trước → dropdown đợt chiếu
  // CHỈ hiện run của chi nhánh đó (MovieRun PER-THEATER).
  const selectedMovieId = useWatch({ control, name: 'movieId' })
  const selectedTheaterId = useWatch({ control, name: 'theaterId' })
  const selectedRoomId = useWatch({ control, name: 'roomId' })
  const { data: movieRuns = [] } = useMovieRuns(
    selectedMovieId ? Number(selectedMovieId) : undefined,
    selectedTheaterId ? Number(selectedTheaterId) : undefined,
  )
  const { data: roomSeatTypes } = useRoomSeatTypes(selectedRoomId ? Number(selectedRoomId) : undefined)
  const filteredRooms = useMemo<AdminRoom[]>(() => {
    if (!selectedTheaterId) return []
    return rooms.filter((r) => r.theaterId === Number(selectedTheaterId))
  }, [rooms, selectedTheaterId])

  // Reset form khi dialog mở — edit mode đợi showtimeDetail load xong
  useEffect(() => {
    if (!open) return
    if (isEditMode) {
      if (!showtimeDetail) return
      reset({
        movieId: showtimeDetail.movieId,
        movieRunId: showtimeDetail.movieRunId ?? '',
        theaterId: showtimeDetail.theaterId,
        roomId: showtimeDetail.roomId,
        startTime: toLocalDateTimeInput(showtimeDetail.startTime),
        basePrice: showtimeDetail.basePrice,
        vipPrice: showtimeDetail.vipPrice ?? 0,
        couplePrice: showtimeDetail.couplePrice ?? 0,
        sweetboxPrice: showtimeDetail.sweetboxPrice ?? 0,
        deluxePrice: showtimeDetail.deluxePrice ?? 0,
      })
    } else {
      reset({
        movieId: 0,
        movieRunId: '',
        theaterId: (scopedTheaterId ?? '') as number | '',
        roomId: 0,
        startTime: '',
        basePrice: 0,
        vipPrice: 0,
        couplePrice: 0,
        sweetboxPrice: 0,
        deluxePrice: 0,
      })
    }
  }, [open, isEditMode, showtimeDetail, scopedTheaterId, reset])

  function onSubmit(data: ShowtimeFormData) {
    const presentTypes = new Set(roomSeatTypes?.seatTypes.map((s) => s.seatType) ?? [])
    if (!validatePriceTier(data, presentTypes)) return

    // Chỉ gửi giá cho loại ghế phòng CÓ thật. Field không có → undefined để BE
    // giữ giá trị mặc định (auto-fill theo RoomType từ SystemConfig).
    const has = (t: SeatType) => presentTypes.size === 0 || presentTypes.has(t)
    const payload: Record<string, unknown> = {
      movieId: Number(data.movieId),
      movieRunId: data.movieRunId ? Number(data.movieRunId) : undefined,
      roomId: Number(data.roomId),
      startTime: data.startTime,
      basePrice: Number(data.basePrice) || 0,
    }
    if (has('VIP')) payload.vipPrice = Number(data.vipPrice) || 0
    if (has('COUPLE')) payload.couplePrice = Number(data.couplePrice) || 0
    if (has('SWEETBOX') && Number(data.sweetboxPrice) > 0) payload.sweetboxPrice = Number(data.sweetboxPrice)
    if (has('DELUXE') && Number(data.deluxePrice) > 0) payload.deluxePrice = Number(data.deluxePrice)

    if (isEditMode && editingId != null) {
      updateMut.mutate({ id: editingId, data: payload }, { onSuccess: () => onOpenChange(false) })
    } else {
      createMut.mutate(payload, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl">
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

              <PriceTierInputs
                control={control}
                errors={errors}
                seatTypes={roomSeatTypes?.seatTypes}
                hasRoomSelected={!!selectedRoomId}
              />
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
