import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  useAdminMovies, useCreateMovie, useUpdateMovie, useUploadPoster, useBulkDeleteMovies, useBulkRestoreMovies,
} from '@/hooks/useAdmin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/api/axios'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import MultiSelect from '@/components/common/MultiSelect'
import { label, MOVIE_STATUS_LABELS } from '@/utils/labels'
import { MOVIE_STATUS_COLORS as STATUS_COLORS } from '@/utils/colors'
import { useGenres } from '@/hooks/useMovies'

interface MovieFormData {
  title: string
  description: string
  duration: number
  releaseDate: string
  endDate: string
  trailerUrl: string
  director: string
  cast: string
  language: string
  status: string
  genreIds: number[]
}

export default function AdminMoviePage() {
  const [page, setPage] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadId, setUploadId] = useState<number | null>(null)

  const { data: pageData } = useAdminMovies({ keyword: keyword || undefined, page, size: 10 })
  const movies = pageData?.content ?? []
  const totalPages = pageData?.totalPages ?? 0
  const { data: genres = [] } = useGenres()
  // Admin cần thấy cả genre ARCHIVED để bỏ chọn khi edit phim
  const { data: allGenres = [] } = useQuery({
    queryKey: ['genres', 'all'],
    queryFn: async () => {
      const res = await api.get('/api/genres', { params: { size: 50, includeDeleted: true } })
      return res.data.data.content
    },
  })
  const genreOptions = allGenres.map((g: any) => ({
    value: g.id,
    label: g.storageState === 'ARCHIVED' ? `${g.name} (đã lưu trữ)` : g.name,
  }))

  const createMut = useCreateMovie()
  const updateMut = useUpdateMovie()
  const uploadMut = useUploadPoster()
  const bulkDeleteMut = useBulkDeleteMovies()
  const bulkRestoreMut = useBulkRestoreMovies()

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

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<MovieFormData>()
  const selectedGenres: number[] = watch('genreIds') ?? []

  function openCreate() {
    setEditingItem(null)
    reset({ genreIds: [], status: 'COMING_SOON' })
    setDialogOpen(true)
  }

  async function openEdit(movieId: number) {
    try {
      const res = await api.get(`/api/movies/${movieId}`)
      const m = res.data.data
      setEditingItem(m)
      reset({
        title: m.title, description: m.description, duration: m.duration,
        releaseDate: m.releaseDate?.slice(0, 10), endDate: m.endDate?.slice(0, 10),
        trailerUrl: m.trailerUrl ?? '', director: m.director, cast: m.cast, language: m.language, status: m.status,
        genreIds: m.genres?.map((g: { id: number }) => g.id) ?? [],
      })
      setDialogOpen(true)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Không thể tải dữ liệu'))
    }
  }

  function onSubmit(data: MovieFormData) {
    if (data.releaseDate && data.endDate && data.endDate < data.releaseDate) {
      toast.error('Ngày kết thúc phải sau ngày phát hành')
      return
    }
    const payload = { ...data, duration: Number(data.duration), genreIds: data.genreIds?.map(Number) ?? [] }
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
    if (file && uploadId) {
      uploadMut.mutate({ id: uploadId, file })
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Tìm kiếm phim..."
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

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {/* Table */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={movies.length > 0 && selectedIds.size === movies.length}
                  onChange={toggleAll} className="accent-[#eab308]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Phim</TableHead>
              <TableHead className="text-gray-400">Thể loại</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
              <TableHead className="text-gray-400">Điểm</TableHead>
              <TableHead className="text-gray-400 text-right">Upload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movies.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-10">Không có dữ liệu</TableCell>
              </TableRow>
            )}
            {movies.map((m, index) => (
              <TableRow key={m.id} className="border-white/5 hover:bg-white/5 group">
                <TableCell className="whitespace-nowrap">
                  <input type="checkbox" checked={selectedIds.has(m.id)}
                    onChange={() => toggleSelect(m.id)} className="accent-[#eab308]" />
                </TableCell>
                <TableCell className="text-gray-500 text-sm whitespace-nowrap">{page * 10 + index + 1}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => openEdit(m.id)}>
                    {m.posterUrl ? (
                      <img src={m.posterUrl} alt={m.title} className="w-9 h-13 object-cover rounded-md shrink-0" />
                    ) : (
                      <div className="w-9 h-13 bg-[#0d2137] rounded-md flex items-center justify-center shrink-0">
                        <ImagePlus size={12} className="text-gray-600" />
                      </div>
                    )}
                    <span className="text-[#eab308] hover:underline font-medium">
                      {m.title}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {m.genres?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {m.genres.map((g: any) => (
                        <span key={g.id ?? g} className={`text-xs px-2 py-1 rounded-md border ${
                          g.storageState === 'ARCHIVED'
                            ? 'bg-white/5 text-gray-500 border-white/10 line-through'
                            : 'bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20'
                        }`}>
                          {g.name ?? g}
                        </span>
                      ))}
                    </div>
                  ) : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[m.status] ?? ''}`}>
                    {label(MOVIE_STATUS_LABELS, m.status)}
                  </span>
                </TableCell>
                <TableCell className="text-[#eab308] whitespace-nowrap">{m.rating ?? '—'}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => handleUpload(m.id)}
                    className="text-gray-400 hover:text-[#eab308] h-8 w-8 p-0">
                    <ImagePlus size={14} />
                  </Button>
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
        <DialogContent size="xl" className="bg-[#0a1929] border-white/5 text-white">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Chỉnh sửa phim' : 'Thêm mới phim'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogBody>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">Tên phim <span className="text-red-400">*</span></label>
                  <Input {...register('title', { required: 'Tên phim là bắt buộc', maxLength: { value: 200, message: 'Tối đa 200 ký tự' } })} />
                  {errors.title && <p className="text-red-400 text-xs mt-1">{String(errors.title.message)}</p>}
                </div>
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">Mô tả</label>
                  <Textarea {...register('description')} rows={3} />
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Thời lượng (phút) <span className="text-red-400">*</span></label>
                  <Input type="number" {...register('duration', { required: 'Thời lượng là bắt buộc', min: { value: 1, message: 'Thời lượng phải > 0' } })} />
                  {errors.duration && <p className="text-red-400 text-xs mt-1">{String(errors.duration.message)}</p>}
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Ngôn ngữ</label>
                  <Input {...register('language', { maxLength: { value: 50, message: 'Tối đa 50 ký tự' } })} />
                  {errors.language && <p className="text-red-400 text-xs mt-1">{String(errors.language.message)}</p>}
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Ngày phát hành</label>
                  <Input type="date" {...register('releaseDate')} />
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Ngày kết thúc</label>
                  <Input type="date" {...register('endDate')} />
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Đạo diễn</label>
                  <Input {...register('director', { maxLength: { value: 100, message: 'Tối đa 100 ký tự' } })} />
                  {errors.director && <p className="text-red-400 text-xs mt-1">{String(errors.director.message)}</p>}
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Trạng thái <span className="text-red-400">*</span></label>
                  <select {...register('status', { required: 'Trạng thái là bắt buộc' })}
                    className="w-full h-10 rounded-lg border border-white/10 bg-[#0d2137] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#eab308]">
                    {Object.entries(MOVIE_STATUS_LABELS).map(([value, lbl]) => (
                      <option key={value} value={value}>{lbl}</option>
                    ))}
                  </select>
                  {errors.status && <p className="text-red-400 text-xs mt-1">{String(errors.status.message)}</p>}
                </div>
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">Diễn viên</label>
                  <Input {...register('cast', { maxLength: { value: 500, message: 'Tối đa 500 ký tự' } })} />
                  {errors.cast && <p className="text-red-400 text-xs mt-1">{String(errors.cast.message)}</p>}
                </div>
                <div className="col-span-12">
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
