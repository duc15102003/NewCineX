import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'

import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import { FilterTrigger } from '@/components/common/FilterDrawer'
import TheaterGroupHeaderRow from '@/components/admin/TheaterGroupHeaderRow'
import VoucherFormDialog from './components/VoucherFormDialog'
import VoucherFilterDrawer from './components/VoucherFilterDrawer'
import VoucherRow from './components/VoucherRow'

import { useAdminVouchers, useBulkDeleteVouchers, useBulkRestoreVouchers } from '@/hooks/useAdmin'
import type { AdminVoucher, AdminVoucherFilter } from '@/hooks/useAdminVouchers'
import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import { useAuthStore } from '@/store/authStore'
import { groupByTheater } from '@/utils/groupByTheater'
import { ADMIN_LIST_PAGE_SIZE } from '@/utils/constants'

const EMPTY_FILTER: AdminVoucherFilter = {}

export default function AdminVoucherPage() {
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminVoucher | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const [adv, setAdv] = useState<AdminVoucherFilter>(EMPTY_FILTER)
  const [includeExpired, setIncludeExpired] = useState(true)

  // Theater scope: branch admin auto-lock; SUPER_ADMIN dùng adminTheaterStore
  const { currentTheater: adminTheater } = useAdminTheaterStore()
  const { user, isBranchAdmin } = useAuthStore()
  const userTheaterId = user?.theaterId ?? null
  const scopedTheaterId = adminTheater?.id ?? (isBranchAdmin() ? userTheaterId : null)
  const branchLocked = isBranchAdmin()

  const queryFilter: AdminVoucherFilter = useMemo(() => ({
    ...adv,
    keyword: keyword || undefined,
    expired: includeExpired ? adv.expired : false,
    theaterId: adminTheater?.id,
    size: ADMIN_LIST_PAGE_SIZE,
  }), [adv, keyword, includeExpired, adminTheater])

  const { data: pageData } = useAdminVouchers(queryFilter)
  const vouchers = pageData?.content ?? []

  // Grouped view khi SUPER_ADMIN xem "Tất cả chi nhánh"
  const showGrouped = !adminTheater && !branchLocked
  const globalVouchers = useMemo(
    () => (showGrouped ? vouchers.filter(v => v.theaterId == null) : []),
    [vouchers, showGrouped],
  )
  const groupedVouchers = useMemo(
    () => (showGrouped ? groupByTheater(vouchers.filter(v => v.theaterId != null)) : null),
    [vouchers, showGrouped],
  )
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const [globalCollapsed, setGlobalCollapsed] = useState(false)
  const toggleGroup = (theaterId: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      next.has(theaterId) ? next.delete(theaterId) : next.add(theaterId)
      return next
    })
  }

  const activeCount = useMemo(() => {
    return Object.entries(adv).filter(([, v]) => v !== undefined && v !== '' && v !== null).length
      + (includeExpired ? 0 : 1)
  }, [adv, includeExpired])

  function patchAdv(patch: Partial<AdminVoucherFilter>) {
    setAdv((prev) => ({ ...prev, ...patch }))
  }
  function resetAdv() {
    setAdv(EMPTY_FILTER)
    setIncludeExpired(true)
  }

  const bulkDeleteMut = useBulkDeleteVouchers()
  const bulkRestoreMut = useBulkRestoreVouchers()

  function openCreate() {
    setEditingItem(null)
    setDialogOpen(true)
  }
  function openEdit(voucher: AdminVoucher) {
    setEditingItem(voucher)
    setDialogOpen(true)
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
      setSelectedIds(new Set(vouchers.map((v) => v.id)))
    }
  }

  const renderVoucherRow = (v: AdminVoucher, index: number) => (
    <VoucherRow
      key={v.id}
      voucher={v}
      index={index}
      selected={selectedIds.has(v.id)}
      onToggleSelect={toggleSelect}
      onEdit={openEdit}
    />
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Tìm kiếm voucher..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <FilterTrigger onClick={() => setDrawerOpen(true)} activeCount={activeCount} />
          {activeCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={resetAdv}
              className="text-gray-400 hover:text-white hover:bg-white/5 h-9 px-2"
              title="Xóa filter"
            >
              <X size={14} />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
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

      <VoucherFilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        adv={adv}
        onPatch={patchAdv}
        includeExpired={includeExpired}
        onSetIncludeExpired={setIncludeExpired}
        branchLocked={branchLocked}
        onApply={() => setDrawerOpen(false)}
        onReset={resetAdv}
      />

      {/* Table */}
      <div className="rounded-2xl border border-white/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={vouchers.length > 0 && selectedIds.size === vouchers.length}
                  onChange={toggleAll} className="accent-[#ffc107]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Mã</TableHead>
              <TableHead className="text-gray-400">Phạm vi</TableHead>
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
                <TableCell colSpan={10} className="text-center text-gray-500 py-10">Không có dữ liệu</TableCell>
              </TableRow>
            )}
            {showGrouped ? (
              <>
                {globalVouchers.length > 0 && (
                  <React.Fragment key="group-global">
                    <TheaterGroupHeaderRow
                      collapsed={globalCollapsed}
                      onToggle={() => setGlobalCollapsed(c => !c)}
                      theaterName="Voucher toàn hệ thống"
                      theaterCity="Áp dụng mọi chi nhánh"
                      itemCount={globalVouchers.length}
                      itemLabel="voucher"
                      colSpan={10}
                    />
                    {!globalCollapsed && globalVouchers.map((v, idx) => renderVoucherRow(v, idx))}
                  </React.Fragment>
                )}
                {groupedVouchers && groupedVouchers.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.theaterId)
                  return (
                    <React.Fragment key={`group-${group.theaterId}`}>
                      <TheaterGroupHeaderRow
                        collapsed={isCollapsed}
                        onToggle={() => toggleGroup(group.theaterId)}
                        theaterName={group.theaterName}
                        theaterCity={group.theaterCity}
                        itemCount={group.items.length}
                        itemLabel="voucher"
                        colSpan={10}
                      />
                      {!isCollapsed && group.items.map((v, idx) => renderVoucherRow(v, idx))}
                    </React.Fragment>
                  )
                })}
              </>
            ) : (
              vouchers.map((v, index) => renderVoucherRow(v, index))
            )}
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

      {/* Create/Edit Dialog — tách thành component riêng để page < 300 dòng */}
      <VoucherFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        scopedTheaterId={scopedTheaterId}
        branchLocked={branchLocked}
      />
    </div>
  )
}
