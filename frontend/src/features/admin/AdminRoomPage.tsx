import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAdminRooms, useCreateRoom, useUpdateRoom, useBulkDeleteRooms, useBulkRestoreRooms, useGenerateSeats } from '@/hooks/useAdmin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Settings, LayoutGrid } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import api, { getErrorMessage } from '@/api/axios'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import { label, ROOM_TYPE_LABELS, ROOM_STATUS_LABELS } from '@/utils/labels'
import { ROOM_STATUS_COLORS as STATUS_COLORS, ROOM_TYPE_COLORS as TYPE_COLORS } from '@/utils/colors'

interface RoomFormData {
  name: string
  type: string
  totalSeats: number
  status: string
}

interface GenerateSeatsState {
  totalRows: number
  totalCols: number
  vipRows: string[]
  coupleRow: string | null
}

export default function AdminRoomPage() {
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [generateRoomId, setGenerateRoomId] = useState<number | null>(null)

  const { data: pageData } = useAdminRooms({ keyword: keyword || undefined, size: 50 })
  const rooms = pageData?.content ?? []

  const [confirmOpen, setConfirmOpen] = useState(false)
  const createMut = useCreateRoom()
  const updateMut = useUpdateRoom()
  const generateMut = useGenerateSeats()
  const bulkDeleteMut = useBulkDeleteRooms()
  const bulkRestoreMut = useBulkRestoreRooms()

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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RoomFormData>()
  const [genState, setGenState] = useState<GenerateSeatsState>({ totalRows: 0, totalCols: 0, vipRows: [], coupleRow: null })

  function openCreate() {
    setEditingItem(null)
    reset({ type: 'TWO_D', status: 'ACTIVE' })
    setDialogOpen(true)
  }

  async function openEdit(roomId: number) {
    try {
      const res = await api.get(`/api/rooms/${roomId}`)
      const room = res.data.data
      setEditingItem(room)
      reset({ name: room.name, type: room.type, totalSeats: room.totalSeats, status: room.status })
      setDialogOpen(true)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Không thể tải dữ liệu'))
    }
  }

  function onSubmit(data: RoomFormData) {
    const payload = { ...data, totalSeats: editingItem ? editingItem.totalSeats : 0 }
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
    if (selectedIds.size === rooms.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rooms.map((r) => r.id)))
    }
  }

  function openGenerate(id: number) {
    setGenerateRoomId(id)
    setGenState({ totalRows: 0, totalCols: 0, vipRows: [], coupleRow: null })
  }

  // Danh sách hàng A, B, C... dựa trên totalRows
  const availableRows = Array.from({ length: genState.totalRows }, (_, i) => String.fromCharCode(65 + i))
  function setGenRows(val: number) {
    const rows = Math.max(0, Math.min(val, 26))
    const maxRow = String.fromCharCode(65 + rows - 1)
    setGenState(prev => ({
      ...prev,
      totalRows: rows,
      // Xóa VIP/couple rows nằm ngoài range mới
      vipRows: prev.vipRows.filter(r => r <= maxRow),
      coupleRow: prev.coupleRow && prev.coupleRow <= maxRow ? prev.coupleRow : null,
    }))
  }

  function setGenCols(val: number) {
    setGenState(prev => ({ ...prev, totalCols: Math.max(0, val) }))
  }

  function toggleVipRow(row: string) {
    setGenState(prev => ({
      ...prev,
      vipRows: prev.vipRows.includes(row) ? prev.vipRows.filter(r => r !== row) : [...prev.vipRows, row],
    }))
  }

  function setCoupleRow(row: string | null) {
    setGenState(prev => ({ ...prev, coupleRow: row }))
  }

  function onGenerate() {
    if (!generateRoomId) return
    if (genState.totalRows < 1 || genState.totalCols < 1) {
      toast.error('Số hàng và số cột phải lớn hơn 0')
      return
    }
    generateMut.mutate({
      roomId: generateRoomId,
      data: {
        totalRows: genState.totalRows,
        totalCols: genState.totalCols,
        vipRows: genState.vipRows,
        coupleRow: genState.coupleRow,
      },
    }, { onSuccess: () => setGenerateRoomId(null) })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Tìm kiếm phòng chiếu..."
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
                <input type="checkbox" checked={rooms.length > 0 && selectedIds.size === rooms.length}
                  onChange={toggleAll} className="accent-[#eab308]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Tên phòng</TableHead>
              <TableHead className="text-gray-400">Loại</TableHead>
              <TableHead className="text-gray-400">Tổng ghế</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
              <TableHead className="text-gray-400 text-right">Tạo ghế</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-10">Chưa có phòng chiếu</TableCell>
              </TableRow>
            )}
            {rooms.map((r, index) => (
              <TableRow key={r.id} className="border-white/5 hover:bg-white/5 group">
                <TableCell className="whitespace-nowrap">
                  <input type="checkbox" checked={selectedIds.has(r.id)}
                    onChange={() => toggleSelect(r.id)} className="accent-[#eab308]" />
                </TableCell>
                <TableCell className="text-gray-500 text-sm whitespace-nowrap">{index + 1}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span onClick={() => openEdit(r.id)}
                    className="text-[#eab308] hover:underline cursor-pointer font-medium">
                    {r.name}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={`text-xs px-2 py-1 rounded border ${TYPE_COLORS[r.type] ?? 'text-gray-400 border-white/10'}`}>
                    {label(ROOM_TYPE_LABELS, r.type)}
                  </span>
                </TableCell>
                <TableCell className="text-gray-300 whitespace-nowrap">{r.totalSeats}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[r.status] ?? ''}`}>
                    {label(ROOM_STATUS_LABELS, r.status)}
                  </span>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/admin/rooms/${r.id}/seats`}>
                      <Button size="sm" variant="ghost"
                        className="text-gray-400 hover:text-[#eab308] h-8 w-8 p-0"
                        title="Sơ đồ ghế">
                        <LayoutGrid size={14} />
                      </Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => openGenerate(r.id)}
                      className="text-gray-400 hover:text-[#eab308] h-8 w-8 p-0"
                      title="Tạo ghế">
                      <Settings size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md" className="bg-[#0a1929] border-white/5 text-white">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Chỉnh sửa phòng chiếu' : 'Thêm mới phòng chiếu'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogBody>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">Tên phòng <span className="text-red-400">*</span></label>
                  <Input {...register('name', { required: 'Tên phòng là bắt buộc', maxLength: { value: 50, message: 'Tối đa 50 ký tự' } })} />
                  {errors.name && <p className="text-red-400 text-xs mt-1">{String(errors.name.message)}</p>}
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Loại phòng <span className="text-red-400">*</span></label>
                  <select {...register('type')}
                    className="w-full h-10 rounded-lg border border-white/10 bg-[#0d2137] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#eab308]">
                    {Object.entries(ROOM_TYPE_LABELS).map(([value, lbl]) => (
                      <option key={value} value={value}>{lbl}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Trạng thái</label>
                  <select {...register('status')}
                    className="w-full h-10 rounded-lg border border-white/10 bg-[#0d2137] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#eab308]">
                    {Object.entries(ROOM_STATUS_LABELS).map(([value, lbl]) => (
                      <option key={value} value={value}>{lbl}</option>
                    ))}
                  </select>
                </div>
                {editingItem && (
                  <div className="col-span-12">
                    <label className="text-sm text-gray-400 mb-1.5 block">Tổng số ghế</label>
                    <div className="h-10 flex items-center px-3 rounded-lg border border-white/5 bg-white/5 text-gray-400 text-sm">
                      {editingItem.totalSeats} ghế <span className="text-gray-600 ml-2">(cập nhật qua Tạo sơ đồ ghế)</span>
                    </div>
                  </div>
                )}
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

      {/* Generate Seats Dialog */}
      <Dialog open={generateRoomId !== null} onOpenChange={(o) => { if (!o) setGenerateRoomId(null) }}>
        <DialogContent size="md" className="bg-[#0a1929] border-white/5 text-white">
          <DialogHeader>
            <DialogTitle>Tạo sơ đồ ghế</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {/* Số hàng + số cột */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Số hàng <span className="text-red-400">*</span></label>
                <Input type="number" min={1} max={26} value={genState.totalRows || ''}
                  onChange={(e) => setGenRows(Number(e.target.value))}
                  placeholder="VD: 8"
                  />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Số cột <span className="text-red-400">*</span></label>
                <Input type="number" min={1} max={30} value={genState.totalCols || ''}
                  onChange={(e) => setGenCols(Number(e.target.value))}
                  placeholder="VD: 10"
                  />
              </div>
            </div>

            {genState.totalRows > 0 && genState.totalCols > 0 && (
              <div className="text-xs text-gray-500 space-y-1">
                <p>Hàng: {availableRows.join(', ')} • Tổng: {genState.totalRows * genState.totalCols} ghế</p>
                {genState.coupleRow && (
                  <p className="text-purple-400">
                    Hàng đôi {genState.coupleRow}: {Math.floor(genState.totalCols / 2)} đôi
                    {genState.totalCols % 2 !== 0 && ' + 1 ghế thường (cột cuối lẻ)'}
                  </p>
                )}
              </div>
            )}

            {/* Hàng VIP — tag picker, chỉ hiện khi đã nhập hàng */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Hàng VIP</label>
              {genState.totalRows === 0 ? (
                <p className="text-xs text-gray-600">Nhập số hàng trước</p>
              ) : (
                <>
                  {/* Tags đã chọn */}
                  {genState.vipRows.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {genState.vipRows.map(r => (
                        <span key={r} className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-[#eab308]/20 text-[#eab308] border border-[#eab308]/30 rounded-md">
                          Hàng {r}
                          <button type="button" onClick={() => toggleVipRow(r)} className="hover:text-yellow-200">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Picker buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {availableRows.map(r => {
                      const isVip = genState.vipRows.includes(r)
                      const isCouple = genState.coupleRow === r
                      if (isCouple) return null
                      return (
                        <button key={r} type="button" onClick={() => toggleVipRow(r)}
                          className={`w-8 h-8 rounded text-xs font-bold transition-all ${
                            isVip
                              ? 'bg-[#eab308] text-black'
                              : 'bg-[#0d2137] text-gray-400 border border-white/10 hover:border-[#eab308]/50'
                          }`}>
                          {r}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Hàng đôi — single select */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Hàng ghế đôi <span className="text-gray-600">(tối đa 1 hàng)</span></label>
              {genState.totalRows === 0 ? (
                <p className="text-xs text-gray-600">Nhập số hàng trước</p>
              ) : (
                <>
                  {genState.coupleRow && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-md">
                        Hàng {genState.coupleRow}
                        <button type="button" onClick={() => setCoupleRow(null)} className="hover:text-purple-200">×</button>
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {availableRows.map(r => {
                      const isVip = genState.vipRows.includes(r)
                      const isCouple = genState.coupleRow === r
                      if (isVip) return null
                      return (
                        <button key={r} type="button" onClick={() => setCoupleRow(isCouple ? null : r)}
                          className={`w-8 h-8 rounded text-xs font-bold transition-all ${
                            isCouple
                              ? 'bg-purple-500 text-white'
                              : 'bg-[#0d2137] text-gray-400 border border-white/10 hover:border-purple-500/50'
                          }`}>
                          {r}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </DialogBody>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setGenerateRoomId(null)}
              className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
            <Button onClick={onGenerate} className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold"
              disabled={generateMut.isPending || genState.totalRows < 1 || genState.totalCols < 1}>
              Tạo ghế {genState.totalRows > 0 && genState.totalCols > 0 && `(${genState.totalRows * genState.totalCols} ghế)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onConfirmDelete}
        message={`Bạn có chắc muốn lưu trữ ${selectedIds.size} mục đã chọn?`}
        loading={bulkDeleteMut.isPending}
      />
    </div>
  )
}
