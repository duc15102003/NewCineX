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
import { useRoomSeatTypes, type AdminRoom, type SeatType } from '@/hooks/useAdminRooms'
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
  /** Giá ghế thường — dùng chung cho STANDARD + HANDICAP (NĐ 28/2012). */
  basePrice: number
  vipPrice: number
  couplePrice: number
  sweetboxPrice: number
  deluxePrice: number
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

  // Watch: movieId → lazy load runs; theaterId → filter rooms + đợt chiếu;
  // roomId → fetch seat types để render input giá ĐỘNG.
  // Cascading filter chuẩn industry: chọn chi nhánh trước → dropdown đợt chiếu
  // CHỈ hiện run của chi nhánh đó (MovieRun PER-THEATER). Tránh case admin chọn
  // run rạp B trong khi phòng thuộc rạp A → BE chặn "Đợt chiếu không thuộc chi nhánh".
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
        sweetboxPrice: showtimeDetail.sweetboxPrice ?? 0,
        deluxePrice: showtimeDetail.deluxePrice ?? 0,
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
        sweetboxPrice: 0,
        deluxePrice: 0,
      })
    }
  }, [open, isEditMode, showtimeDetail, scopedTheaterId, reset])

  function onSubmit(data: ShowtimeFormData) {
    const presentTypes = new Set(roomSeatTypes?.seatTypes.map((s) => s.seatType) ?? [])
    if (!validatePriceTier(data, presentTypes)) return

    // Chỉ gửi giá cho loại ghế phòng CÓ thật. Field không có → undefined để BE
    // giữ giá trị mặc định (auto-fill theo RoomType từ SystemConfig, hoặc null cho
    // sweetbox/deluxe → fallback couple×2 / vip×1.5 khi book).
    const has = (t: SeatType) => presentTypes.size === 0 || presentTypes.has(t)
    const payload: Record<string, unknown> = {
      movieId: Number(data.movieId),
      // Để trống → BE auto-pick MovieRun phù hợp (NOW_SHOWING > SCHEDULED gần nhất)
      movieRunId: data.movieRunId ? Number(data.movieRunId) : undefined,
      roomId: Number(data.roomId),
      startTime: data.startTime,
      // basePrice luôn gửi (mọi phòng đều có ghế STANDARD)
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
  /** Danh sách loại ghế phòng có — undefined khi chưa fetch xong hoặc chưa chọn phòng. */
  seatTypes: { seatType: SeatType; count: number }[] | undefined
  hasRoomSelected: boolean
}

interface TierConfig {
  field: 'basePrice' | 'vipPrice' | 'couplePrice' | 'sweetboxPrice' | 'deluxePrice'
  /** Loại ghế phải có trong phòng để hiển thị tier này. STANDARD/HANDICAP dùng chung basePrice. */
  matchTypes: SeatType[]
  labelText: string
  placeholder: string
  /** Tier "thường" bắt buộc (mọi phòng đều có ghế STANDARD). Còn lại optional. */
  required: boolean
  /** Suffix hiển thị bên label, VD: "(bao gồm ghế khuyết tật)". */
  suffix?: (counts: Record<SeatType, number>) => string | null
}

// Mọi tier đều BẮT BUỘC: tier nào hiển thị nghĩa là phòng có loại ghế đó,
// nên admin phải set giá rõ ràng — không để BE auto-fill (giá hiển thị cho
// khách hàng cần admin chủ động kiểm soát).
const PRICE_TIERS: TierConfig[] = [
  {
    field: 'basePrice',
    matchTypes: ['STANDARD', 'HANDICAP'],
    labelText: 'Giá ghế thường (đ)',
    placeholder: 'VD: 75.000',
    required: true,
    suffix: (counts) => counts.HANDICAP > 0 ? '· bao gồm ghế khuyết tật' : null,
  },
  { field: 'vipPrice', matchTypes: ['VIP'], labelText: 'Giá VIP (đ)', placeholder: 'VD: 100.000', required: true },
  { field: 'couplePrice', matchTypes: ['COUPLE'], labelText: 'Giá ghế đôi (đ)', placeholder: 'VD: 180.000', required: true },
  { field: 'sweetboxPrice', matchTypes: ['SWEETBOX'], labelText: 'Giá Sweetbox (đ)', placeholder: 'VD: 350.000', required: true },
  { field: 'deluxePrice', matchTypes: ['DELUXE'], labelText: 'Giá Deluxe (đ)', placeholder: 'VD: 250.000', required: true },
]

/**
 * Input giá ĐỘNG theo loại ghế phòng có. Chuẩn industry (CGV/Lotte).
 * - Chưa chọn phòng → ẩn cả block giá, hiện hint.
 * - Đã chọn phòng → query BE lấy seat types → render input tương ứng.
 * - STANDARD + HANDICAP → 1 input "Giá ghế thường" (NĐ 28/2012 không thu phụ phí ghế khuyết tật).
 */
function PriceTierInputs({ control, errors, seatTypes, hasRoomSelected }: PriceTierInputsProps) {
  if (!hasRoomSelected) {
    return (
      <div className="col-span-12 rounded-xl border border-white/5 bg-[#2a2317]/40 px-4 py-3 text-xs text-gray-400">
        Chọn phòng chiếu để hiển thị các ô nhập giá theo loại ghế của phòng đó.
      </div>
    )
  }
  if (!seatTypes) {
    return (
      <div className="col-span-12 text-xs text-gray-400">Đang tải danh sách loại ghế của phòng…</div>
    )
  }

  // Build map: seatType → count để check + render badge số lượng
  const counts: Record<SeatType, number> = {
    STANDARD: 0, VIP: 0, COUPLE: 0, SWEETBOX: 0, DELUXE: 0, HANDICAP: 0,
  }
  seatTypes.forEach((s) => { counts[s.seatType] = s.count })

  // Lọc tier có ít nhất 1 loại ghế match trong phòng
  const activeTiers = PRICE_TIERS.filter((t) => t.matchTypes.some((mt) => counts[mt] > 0))

  if (activeTiers.length === 0) {
    return (
      <div className="col-span-12 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-xs text-orange-300">
        Phòng này chưa có ghế nào ACTIVE. Vào trang Phòng → tạo seat layout trước.
      </div>
    )
  }

  // Layout: tối đa 3 cột/row để cân với grid 12
  const colSpan = activeTiers.length === 1 ? 'col-span-12'
    : activeTiers.length === 2 ? 'col-span-6'
    : 'col-span-4'

  return (
    <>
      {activeTiers.map((tier) => {
        const totalCount = tier.matchTypes.reduce((sum, mt) => sum + counts[mt], 0)
        const suffix = tier.suffix?.(counts)
        // Label luôn 1 dòng (truncate) để các tier cùng chiều cao → input không lệch.
        // Info số lượng + suffix xuống helper text dưới input.
        return (
          <div key={tier.field} className={colSpan}>
            <label className="text-sm text-gray-400 mb-1.5 block truncate">
              {tier.labelText}
              {tier.required && <span className="text-red-400"> *</span>}
            </label>
            <Controller
              name={tier.field}
              control={control}
              rules={tier.required
                ? { required: 'Giá vé là bắt buộc', min: { value: 1, message: 'Giá phải > 0' } }
                : { min: { value: 0, message: 'Giá không được âm' } }}
              render={({ field }) => (
                <PriceInput value={field.value} onChange={field.onChange} placeholder={tier.placeholder} />
              )}
            />
            <p className="text-gray-500 text-xs mt-1">
              {totalCount} ghế{suffix ? ` ${suffix}` : ''}
            </p>
            {errors[tier.field] && (
              <p className="text-red-400 text-xs mt-1">{String(errors[tier.field]?.message)}</p>
            )}
          </div>
        )
      })}
    </>
  )
}

// ============================================================
//  Business validation — testable, không phụ thuộc state
// ============================================================

/**
 * Validate thứ tự giá tier — chỉ check tier phòng có thật.
 * Quy tắc: base ≤ vip ≤ couple ≤ sweetbox; base ≤ vip ≤ deluxe.
 * Sweetbox và Deluxe độc lập nhau (Sweetbox là couple cao cấp, Deluxe là single recliner).
 */
function validatePriceTier(data: ShowtimeFormData, presentTypes: Set<SeatType>): boolean {
  const base = Number(data.basePrice) || 0
  const vip = Number(data.vipPrice) || 0
  const couple = Number(data.couplePrice) || 0
  const sweetbox = Number(data.sweetboxPrice) || 0
  const deluxe = Number(data.deluxePrice) || 0

  const hasVip = presentTypes.has('VIP')
  const hasCouple = presentTypes.has('COUPLE')
  const hasSweetbox = presentTypes.has('SWEETBOX')
  const hasDeluxe = presentTypes.has('DELUXE')

  if (hasVip && vip > 0 && vip < base) {
    toast.error('Giá VIP phải lớn hơn hoặc bằng giá ghế thường')
    return false
  }
  if (hasCouple && couple > 0 && couple < base) {
    toast.error('Giá ghế đôi phải lớn hơn hoặc bằng giá ghế thường')
    return false
  }
  if (hasCouple && hasVip && couple > 0 && vip > 0 && couple < vip) {
    toast.error('Giá ghế đôi phải lớn hơn hoặc bằng giá VIP')
    return false
  }
  if (hasSweetbox && sweetbox > 0 && hasCouple && couple > 0 && sweetbox < couple) {
    toast.error('Giá Sweetbox phải lớn hơn hoặc bằng giá ghế đôi')
    return false
  }
  if (hasDeluxe && deluxe > 0 && hasVip && vip > 0 && deluxe < vip) {
    toast.error('Giá Deluxe phải lớn hơn hoặc bằng giá VIP')
    return false
  }
  if (hasDeluxe && deluxe > 0 && deluxe < base) {
    toast.error('Giá Deluxe phải lớn hơn hoặc bằng giá ghế thường')
    return false
  }
  return true
}
