import { useMemo, useState, useRef } from 'react'
import { Plus, ImagePlus, Package, PiggyBank } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'

import ComboFormDialog from './components/ComboFormDialog'

import {
  useAdminCombos, useBulkArchiveCombos, useBulkRestoreCombos, useUploadComboImage,
} from '@/hooks/useAdminCombos'
import type { Combo } from '@/hooks/useAdminCombos'
import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import { useAuthStore } from '@/store/authStore'
import { ADMIN_LIST_PAGE_SIZE } from '@/utils/constants'
import { fmtVnd, label, STORAGE_STATE_LABELS } from '@/utils/labels'
import { STORAGE_STATE_COLORS as STATE_COLORS } from '@/utils/colors'
import { usePageTitle } from '@/hooks/usePageTitle'
import { validateImageUpload } from '@/utils/image'

export default function AdminComboPage() {
  usePageTitle('Quản lý combo')
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Combo | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Theater scope
  const { currentTheater: adminTheater } = useAdminTheaterStore()
  const { user, isBranchAdmin } = useAuthStore()
  const userTheaterId = user?.theaterId ?? null
  const scopedTheaterId = adminTheater?.id ?? (isBranchAdmin() ? userTheaterId : null)
  const theaterLocked = scopedTheaterId != null

  const queryParams = useMemo<{ theaterId?: number; size: number }>(() => {
    const p: { theaterId?: number; size: number } = { size: ADMIN_LIST_PAGE_SIZE }
    if (adminTheater?.id) p.theaterId = adminTheater.id
    return p
  }, [adminTheater])

  const { data: pageData } = useAdminCombos(queryParams)
  const allCombos = pageData?.content ?? []

  // Filter client-side theo keyword (Combo BE chưa support search → list nhỏ <50 items, OK)
  const combos = useMemo(() => {
    if (!keyword.trim()) return allCombos
    const kw = keyword.trim().toLowerCase()
    return allCombos.filter(c =>
      c.code.toLowerCase().includes(kw) || c.name.toLowerCase().includes(kw),
    )
  }, [allCombos, keyword])

  const bulkArchiveMut = useBulkArchiveCombos()
  const bulkRestoreMut = useBulkRestoreCombos()
  const uploadImageMut = useUploadComboImage()

  // Upload ảnh — action riêng tách khỏi form (theo CLAUDE.md File Upload Rules)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadId, setUploadId] = useState<number | null>(null)

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
    uploadImageMut.mutate({ id: uploadId, file })
  }

  function openCreate() {
    setEditingItem(null)
    setDialogOpen(true)
  }
  function openEdit(combo: Combo) {
    setEditingItem(combo)
    setDialogOpen(true)
  }

  function handleBulkArchive() {
    if (selectedIds.size === 0) { toast.error('Hãy chọn ít nhất 1 mục'); return }
    setConfirmOpen(true)
  }
  function handleBulkRestore() {
    if (selectedIds.size === 0) { toast.error('Hãy chọn ít nhất 1 mục'); return }
    bulkRestoreMut.mutate([...selectedIds], { onSuccess: () => setSelectedIds(new Set()) })
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    if (selectedIds.size === combos.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(combos.map((c) => c.id)))
    }
  }

  const renderComboRow = (c: Combo, idx: number) => {
    const isArchived = c.storageState === 'ARCHIVED'
    const lineSavings = c.regularPrice - c.price
    const savingsPercent = c.regularPrice > 0
      ? Math.round((lineSavings / c.regularPrice) * 100)
      : 0
    return (
      <TableRow key={c.id} className={`border-[#3f382d] hover:bg-white/5 group ${isArchived ? 'opacity-50' : ''}`}>
        <TableCell className="whitespace-nowrap">
          <input type="checkbox" checked={selectedIds.has(c.id)}
            onChange={() => toggleSelect(c.id)} className="accent-[#ffc107]" />
        </TableCell>
        <TableCell className="text-gray-500 text-sm whitespace-nowrap">{idx + 1}</TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => openEdit(c)}>
            {c.imageUrl ? (
              <img src={c.imageUrl} alt={c.name} className="w-9 h-9 object-cover rounded-lg shrink-0" />
            ) : (
              <div className="w-9 h-9 bg-[#2a2317] rounded-lg flex items-center justify-center shrink-0">
                <Package size={14} className="text-purple-400/60" />
              </div>
            )}
            <div>
              <p className="text-[#ffc107] hover:underline font-medium font-mono text-sm">{c.code}</p>
              <p className="text-xs text-gray-400">{c.name}</p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-gray-300 text-sm">
          {c.items.map((i, k) => (
            <div key={k} className="text-xs">
              {i.snackName} <span className="text-gray-500">× {i.quantity}</span>
            </div>
          ))}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="text-sm font-semibold text-[#ffc107]">{fmtVnd(c.price)}</div>
          {lineSavings > 0 && (
            <div className="text-xs text-gray-500 line-through">{fmtVnd(c.regularPrice)}</div>
          )}
          {lineSavings > 0 && (
            <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-500/10 border border-green-500/30 text-green-400 w-fit">
              <PiggyBank size={11} />
              <span className="text-[10px] font-semibold">
                {fmtVnd(lineSavings)}
                {savingsPercent > 0 && <span className="opacity-70 ml-0.5">(-{savingsPercent}%)</span>}
              </span>
            </div>
          )}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="flex flex-col gap-1">
            {isArchived ? (
              <span className={`text-xs px-2 py-1 rounded border ${STATE_COLORS[c.storageState] ?? ''}`}>
                {label(STORAGE_STATE_LABELS, c.storageState)}
              </span>
            ) : c.active ? (
              c.effectiveAvailable ? (
                <span className="text-xs px-2 py-1 rounded border bg-green-500/10 text-green-400 border-green-500/30 w-fit">Đang bán</span>
              ) : (
                <span
                  className="text-xs px-2 py-1 rounded border bg-orange-500/10 text-orange-400 border-orange-500/30 w-fit cursor-help"
                  title={`Tạm hết do nguyên liệu thiếu: ${c.unavailableItems.join(', ')}\n→ Cập nhật trạng thái Còn hàng cho các snack trên để combo bán lại.`}>
                  ⚠ Tạm hết
                </span>
              )
            ) : (
              <span className="text-xs px-2 py-1 rounded border bg-gray-500/10 text-gray-400 border-gray-500/30 w-fit">Tạm tắt</span>
            )}
            {!isArchived && c.active && !c.effectiveAvailable && (
              <span className="text-[10px] text-orange-300/80 max-w-[160px] truncate" title={c.unavailableItems.join(', ')}>
                Thiếu: {c.unavailableItems.join(', ')}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right whitespace-nowrap">
          <Button size="sm" variant="ghost" onClick={() => handleUpload(c.id)}
            className="text-gray-400 hover:text-[#ffc107] h-8 w-8 p-0" title="Upload ảnh combo">
            <ImagePlus size={14} />
          </Button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — đồng bộ pattern với AdminSnackPage / AdminMoviePage */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Tìm theo mã hoặc tên combo..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
            <Plus size={16} className="mr-1" /> Thêm mới
          </Button>
          <StatusDropdown
            onArchive={handleBulkArchive}
            onRestore={handleBulkRestore}
            archiveLoading={bulkArchiveMut.isPending}
            restoreLoading={bulkRestoreMut.isPending}
          />
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {/* Table */}
      <div className="rounded-2xl border border-[#3f382d] overflow-clip">
        <Table>
          <TableHeader>
            <TableRow className="border-[#3f382d] hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={combos.length > 0 && selectedIds.size === combos.length}
                  onChange={toggleAll} className="accent-[#ffc107]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Mã / Tên</TableHead>
              <TableHead className="text-gray-400">Items</TableHead>
              <TableHead className="text-gray-400">Giá</TableHead>
              <TableHead className="text-gray-400">Lưu trữ</TableHead>
              <TableHead className="text-gray-400 text-right">Upload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {combos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Package size={32} className="text-gray-600" />
                    <p className="text-sm">{keyword ? `Không tìm thấy combo khớp "${keyword}"` : 'Chưa có combo nào'}</p>
                    {!keyword && (
                      <button onClick={openCreate}
                        className="text-xs text-[#ffc107] hover:underline">
                        Thêm combo đầu tiên
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {combos.map((c, idx) => renderComboRow(c, idx))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => bulkArchiveMut.mutate([...selectedIds], {
          onSuccess: () => { setSelectedIds(new Set()); setConfirmOpen(false) },
        })}
        message={`Bạn có chắc muốn lưu trữ ${selectedIds.size} combo đã chọn?`}
        loading={bulkArchiveMut.isPending}
      />

      <ComboFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        scopedTheaterId={scopedTheaterId}
        theaterLocked={theaterLocked}
      />
    </div>
  )
}
