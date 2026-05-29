import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { PriceInput } from '@/components/ui/price-input'
import { useAdminShowtimes, useCreateShowtime, useUpdateShowtime, useAdminMovies, useAdminRooms, useBulkDeleteShowtimes, useBulkRestoreShowtimes } from '@/hooks/useAdmin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, DoorOpen } from 'lucide-react'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import { label, SHOWTIME_STATUS_LABELS, ROOM_TYPE_LABELS, fmtDateTime } from '@/utils/labels'
import { SHOWTIME_STATUS_COLORS as STATUS_COLORS } from '@/utils/colors'

interface ShowtimeFormData {
  movieId: number
  roomId: number
  startTime: string
  basePrice: number
  vipPrice: number
  couplePrice: number
}

function toLocalDateTimeInput(dt: string) {
  if (!dt) return ''
  return new Date(dt).toISOString().slice(0, 16)
}

export default function AdminShowtimePage() {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: pageData } = useAdminShowtimes({ keyword: keyword || undefined, page, size: 10 })
  const showtimes = pageData?.content ?? []
  const totalPages = pageData?.totalPages ?? 0

  const { data: moviesData } = useAdminMovies({ size: 100 })
  const movies = moviesData?.content ?? []

  const { data: roomsData } = useAdminRooms({ size: 100 })
  const rooms = roomsData?.content ?? []

  const createMut = useCreateShowtime()
  const updateMut = useUpdateShowtime()
  const bulkDeleteMut = useBulkDeleteShowtimes()
  const bulkRestoreMut = useBulkRestoreShowtimes()

  function handleBulkArchive() {
    if (selectedIds.size === 0) {
      toast.error('Hãy chọn ít nhất 1 mục')
      return
    }
    setConfirmOpen(true)
  }

  function handleBulkRestore() {
    if (selectedIds.size === 0) {
      toast.error('Hãy chọn ít nhất 1 mục')
      return
    }
    bulkRestoreMut.mutate([...selectedIds], {
      onSuccess: () => { setSelectedIds(new Set()) }
    })
  }

  function onConfirmDelete() {
    bulkDeleteMut.mutate([...selectedIds], { onSuccess: () => setConfirmOpen(false) })
  }

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ShowtimeFormData>()

  function openCreate() {
    setEditingItem(null)
    reset({})
    setDialogOpen(true)
  }

  async function openEdit(showtimeId: number) {
    try {
      const res = await api.get(`/api/showtimes/${showtimeId}`)
      const s = res.data.data
      setEditingItem(s)
      reset({
        movieId: s.movieId ?? s.movie?.id,
        roomId: s.roomId ?? s.room?.id,
        startTime: toLocalDateTimeInput(s.startTime),
        basePrice: s.basePrice,
        vipPrice: s.vipPrice,
        couplePrice: s.couplePrice,
      })
      setDialogOpen(true)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Không thể tải dữ liệu'))
    }
  }

  function onSubmit(data: ShowtimeFormData) {
    const base = Number(data.basePrice) || 0
    const vip = Number(data.vipPrice) || 0
    const couple = Number(data.couplePrice) || 0

    // Validate thứ tự giá: thường <= VIP <= đôi
    if (vip > 0 && vip < base) {
      toast.error('Giá VIP phải lớn hơn hoặc bằng giá thường')
      return
    }
    if (couple > 0 && couple < vip) {
      toast.error('Giá ghế đôi phải lớn hơn hoặc bằng giá VIP')
      return
    }
    if (couple > 0 && couple < base) {
      toast.error('Giá ghế đôi phải lớn hơn hoặc bằng giá thường')
      return
    }

    const payload = {
      movieId: Number(data.movieId),
      roomId: Number(data.roomId),
      startTime: data.startTime,
      basePrice: base,
      vipPrice: vip,
      couplePrice: couple,
    }
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, data: payload }, { onSuccess: () => setDialogOpen(false) })
    } else {
      createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) })
    }
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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Tìm theo tên phim..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold">
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

      {/* Table */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={showtimes.length > 0 && selectedIds.size === showtimes.length}
                  onChange={toggleAll} className="accent-[#eab308]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Phim / Giờ chiếu</TableHead>
              <TableHead className="text-gray-400">Phòng</TableHead>
              <TableHead className="text-gray-400">Giá (thường / VIP / đôi)</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showtimes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-10">Chưa có suất chiếu</TableCell>
              </TableRow>
            )}
            {showtimes.map((s, index) => (
              <TableRow key={s.id} className="border-white/5 hover:bg-white/5 group">
                <TableCell className="whitespace-nowrap">
                  <input type="checkbox" checked={selectedIds.has(s.id)}
                    onChange={() => toggleSelect(s.id)} className="accent-[#eab308]" />
                </TableCell>
                <TableCell className="text-gray-500 text-sm whitespace-nowrap">{page * 10 + index + 1}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span onClick={() => openEdit(s.id)}
                    className="text-[#eab308] hover:underline cursor-pointer font-medium block">
                    {s.movieTitle ?? s.movie?.title ?? '—'}
                  </span>
                  <span className="text-gray-500 text-xs">{fmtDateTime(s.startTime)}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {(s.roomName || s.room?.name) ? (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-200">
                      <DoorOpen size={12} className="text-[#eab308]" />
                      {s.roomName ?? s.room?.name}
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex flex-col gap-0.5 text-xs">
                    <span className="text-gray-300">
                      Thường: <span className="text-white font-medium">{s.basePrice?.toLocaleString('vi-VN')}đ</span>
                    </span>
                    {s.vipPrice && (
                      <span className="text-gray-300">
                        VIP: <span className="text-[#eab308] font-medium">{s.vipPrice.toLocaleString('vi-VN')}đ</span>
                      </span>
                    )}
                    {s.couplePrice && (
                      <span className="text-gray-300">
                        Đôi: <span className="text-purple-400 font-medium">{s.couplePrice.toLocaleString('vi-VN')}đ</span>
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[s.status] ?? ''}`}>
                    {label(SHOWTIME_STATUS_LABELS, s.status)}
                  </span>
                </TableCell>
              </TableRow>
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

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Xác nhận lưu trữ"
        message={`Bạn có chắc muốn lưu trữ ${selectedIds.size} mục đã chọn?`}
        onConfirm={onConfirmDelete}
        loading={bulkDeleteMut.isPending}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg" className="bg-[#0a1929] border-white/5 text-white">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Chỉnh sửa suất chiếu' : 'Thêm mới suất chiếu'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogBody>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Phim <span className="text-red-400">*</span></label>
                  <select {...register('movieId', { required: 'Vui lòng chọn phim' })}
                    className="w-full h-10 rounded-lg border border-white/10 bg-[#0d2137] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#eab308]">
                    <option value="">-- Chọn phim --</option>
                    {movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                  {errors.movieId && <p className="text-red-400 text-xs mt-1">{String(errors.movieId.message)}</p>}
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Phòng chiếu <span className="text-red-400">*</span></label>
                  <select {...register('roomId', { required: 'Vui lòng chọn phòng' })}
                    className="w-full h-10 rounded-lg border border-white/10 bg-[#0d2137] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#eab308]">
                    <option value="">-- Chọn phòng --</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({label(ROOM_TYPE_LABELS, r.type)})</option>)}
                  </select>
                  {errors.roomId && <p className="text-red-400 text-xs mt-1">{String(errors.roomId.message)}</p>}
                </div>
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">Giờ bắt đầu <span className="text-red-400">*</span></label>
                  <Input type="datetime-local" {...register('startTime', { required: 'Giờ bắt đầu là bắt buộc' })} />
                  {errors.startTime && <p className="text-red-400 text-xs mt-1">{String(errors.startTime.message)}</p>}
                </div>
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
              </div>
            </DialogBody>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}
                className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
              <Button type="submit" className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold"
                disabled={createMut.isPending || updateMut.isPending}>Lưu</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
