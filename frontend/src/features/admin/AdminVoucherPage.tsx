import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { PriceInput } from '@/components/ui/price-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import { label, DISCOUNT_TYPE_LABELS, STORAGE_STATE_LABELS, fmtDate } from '@/utils/labels'
import { STORAGE_STATE_COLORS as STATE_COLORS } from '@/utils/colors'
import { useAdminVouchers, useCreateVoucher, useUpdateVoucher, useBulkDeleteVouchers, useBulkRestoreVouchers } from '@/hooks/useAdmin'

interface VoucherFormData {
  code: string
  description: string
  discountType: string
  discountValue: number
  minOrderAmount: number
  maxDiscount: number
  usageLimit: number
  startDate: string
  endDate: string
}

export default function AdminVoucherPage() {
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: pageData } = useAdminVouchers({ keyword: keyword || undefined, size: 50 })
  const vouchers = pageData?.content ?? []

  const createMut = useCreateVoucher()
  const updateMut = useUpdateVoucher()
  const bulkDeleteMut = useBulkDeleteVouchers()
  const bulkRestoreMut = useBulkRestoreVouchers()

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<VoucherFormData>()
  const discountType = watch('discountType')

  function openCreate() {
    setEditingItem(null)
    reset({
      code: '', description: '', discountType: 'PERCENTAGE',
      discountValue: 0, minOrderAmount: 0, maxDiscount: 0,
      usageLimit: 0, startDate: '', endDate: '',
    })
    setDialogOpen(true)
  }

  function openEdit(voucher: any) {
    // Use list data directly — single GET endpoint may not exist
    setEditingItem(voucher)
    reset({
      code: voucher.code,
      description: voucher.description ?? '',
      discountType: voucher.discountType ?? 'PERCENTAGE',
      discountValue: voucher.discountValue ?? 0,
      minOrderAmount: voucher.minOrderAmount ?? 0,
      maxDiscount: voucher.maxDiscount ?? 0,
      usageLimit: voucher.usageLimit ?? 0,
      startDate: voucher.startDate ? voucher.startDate.slice(0, 16) : '',
      endDate: voucher.endDate ? voucher.endDate.slice(0, 16) : '',
    })
    setDialogOpen(true)
  }

  function onSubmit(data: VoucherFormData) {
    // Client-side business validation
    if (data.discountType === 'PERCENTAGE' && Number(data.discountValue) > 100) {
      toast.error('Phần trăm giảm giá không được vượt quá 100%')
      return
    }
    if (data.discountType === 'FIXED_AMOUNT' && data.minOrderAmount && Number(data.discountValue) > Number(data.minOrderAmount)) {
      toast.error('Giá trị giảm không được lớn hơn đơn tối thiểu')
      return
    }
    if (data.maxDiscount && data.minOrderAmount && Number(data.maxDiscount) > Number(data.minOrderAmount)) {
      toast.error('Giảm tối đa không được lớn hơn đơn tối thiểu')
      return
    }
    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      toast.error('Ngày kết thúc phải sau ngày bắt đầu')
      return
    }

    const payload = {
      ...data,
      discountValue: Number(data.discountValue),
      minOrderAmount: Number(data.minOrderAmount),
      maxDiscount: Number(data.maxDiscount),
      usageLimit: Number(data.usageLimit),
    }
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, data: payload }, { onSuccess: () => setDialogOpen(false) })
    } else {
      createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) })
    }
  }

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

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === vouchers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(vouchers.map((v: any) => v.id)))
    }
  }

  function formatDiscount(v: any) {
    if (v.discountType === 'PERCENTAGE') return `${v.discountValue}%`
    if (v.discountType === 'FIXED_AMOUNT') return `${(v.discountValue ?? 0).toLocaleString('vi-VN')}đ`
    return v.discountValue ?? '—'
  }

  function formatUsage(v: any) {
    const used = v.usedCount ?? 0
    const limit = v.usageLimit
    return limit ? `${used}/${limit}` : `${used}/∞`
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Tìm kiếm voucher..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
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
                <input type="checkbox" checked={vouchers.length > 0 && selectedIds.size === vouchers.length}
                  onChange={toggleAll} className="accent-[#eab308]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Mã</TableHead>
              <TableHead className="text-gray-400">Mô tả</TableHead>
              <TableHead className="text-gray-400">Loại giảm</TableHead>
              <TableHead className="text-gray-400">Giá trị</TableHead>
              <TableHead className="text-gray-400">Đã dùng/Giới hạn</TableHead>
              <TableHead className="text-gray-400">Hạn sử dụng</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vouchers.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500 py-10">Không có dữ liệu</TableCell>
              </TableRow>
            )}
            {vouchers.map((v: any, index: number) => (
              <TableRow key={v.id} className="border-white/5 hover:bg-white/5 group">
                <TableCell className="whitespace-nowrap">
                  <input type="checkbox" checked={selectedIds.has(v.id)}
                    onChange={() => toggleSelect(v.id)} className="accent-[#eab308]" />
                </TableCell>
                <TableCell className="text-gray-500 text-sm whitespace-nowrap">{index + 1}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span onClick={() => openEdit(v)}
                    className="text-[#eab308] hover:underline cursor-pointer font-medium">
                    {v.code}
                  </span>
                </TableCell>
                <TableCell className="text-gray-400 text-sm whitespace-nowrap">{v.description || '—'}</TableCell>
                <TableCell className="text-gray-300 text-sm whitespace-nowrap">
                  {label(DISCOUNT_TYPE_LABELS, v.discountType)}
                </TableCell>
                <TableCell className="text-gray-300 text-sm whitespace-nowrap">{formatDiscount(v)}</TableCell>
                <TableCell className="text-gray-300 text-sm whitespace-nowrap">{formatUsage(v)}</TableCell>
                <TableCell className="text-gray-400 text-sm whitespace-nowrap">{fmtDate(v.endDate)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={`text-xs px-2 py-1 rounded border ${STATE_COLORS[v.storageState] ?? ''}`}>
                    {label(STORAGE_STATE_LABELS, v.storageState)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => bulkDeleteMut.mutate([...selectedIds], { onSuccess: () => { setSelectedIds(new Set()); setConfirmOpen(false) } })}
        message={`Bạn có chắc muốn lưu trữ ${selectedIds.size} voucher đã chọn?`}
        loading={bulkDeleteMut.isPending}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg" className="bg-[#0a1929] border-white/5 text-white">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Chỉnh sửa voucher' : 'Thêm voucher mới'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogBody>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">Mã voucher <span className="text-red-400">*</span></label>
                  <Input {...register('code', { required: 'Mã voucher là bắt buộc', maxLength: { value: 30, message: 'Tối đa 30 ký tự' } })} />
                  {errors.code && <p className="text-red-400 text-xs mt-1">{String(errors.code.message)}</p>}
                </div>
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">Mô tả</label>
                  <Textarea {...register('description')} rows={3} />
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Loại giảm giá <span className="text-red-400">*</span></label>
                  <select {...register('discountType')}
                    className="w-full h-10 rounded-lg border border-white/10 bg-[#0d2137] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#eab308]">
                    <option value="PERCENTAGE">Phần trăm (%)</option>
                    <option value="FIXED_AMOUNT">Số tiền cố định</option>
                  </select>
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Giá trị giảm <span className="text-red-400">*</span></label>
                  {discountType === 'PERCENTAGE' ? (
                    <div className="relative">
                      <Input
                        type="number"
                        {...register('discountValue', {
                          required: 'Giá trị giảm là bắt buộc',
                          min: { value: 1, message: 'Giá trị phải >= 1' },
                          max: { value: 100, message: 'Tối đa 100%' },
                        })}
                        placeholder="VD: 20"
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
                    </div>
                  ) : (
                    <Controller
                      name="discountValue"
                      control={control}
                      rules={{ required: 'Giá trị giảm là bắt buộc', min: { value: 1, message: 'Giá trị phải > 0' } }}
                      render={({ field }) => (
                        <PriceInput value={field.value} onChange={field.onChange} placeholder="VD: 50.000" />
                      )}
                    />
                  )}
                  {errors.discountValue && <p className="text-red-400 text-xs mt-1">{String(errors.discountValue.message)}</p>}
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Đơn tối thiểu</label>
                  <Controller
                    name="minOrderAmount"
                    control={control}
                    rules={{ min: 0 }}
                    render={({ field }) => (
                      <PriceInput value={field.value} onChange={field.onChange} placeholder="VD: 100.000" />
                    )}
                  />
                  {errors.minOrderAmount && <p className="text-red-400 text-xs mt-1">{String(errors.minOrderAmount.message)}</p>}
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Giảm tối đa</label>
                  <Controller
                    name="maxDiscount"
                    control={control}
                    rules={{ min: 0 }}
                    render={({ field }) => (
                      <PriceInput value={field.value} onChange={field.onChange} placeholder="VD: 200.000" />
                    )}
                  />
                  {errors.maxDiscount && <p className="text-red-400 text-xs mt-1">{String(errors.maxDiscount.message)}</p>}
                </div>
                <div className="col-span-12">
                  <label className="text-sm text-gray-400 mb-1.5 block">Giới hạn lượt dùng (0 = không giới hạn)</label>
                  <Input type="number" {...register('usageLimit', { min: 0 })} />
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Ngày bắt đầu <span className="text-red-400">*</span></label>
                  <Input type="datetime-local" {...register('startDate', { required: 'Ngày bắt đầu là bắt buộc' })} />
                  {errors.startDate && <p className="text-red-400 text-xs mt-1">{String(errors.startDate.message)}</p>}
                </div>
                <div className="col-span-6">
                  <label className="text-sm text-gray-400 mb-1.5 block">Ngày kết thúc <span className="text-red-400">*</span></label>
                  <Input type="datetime-local" {...register('endDate', { required: 'Ngày kết thúc là bắt buộc' })} />
                  {errors.endDate && <p className="text-red-400 text-xs mt-1">{String(errors.endDate.message)}</p>}
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
