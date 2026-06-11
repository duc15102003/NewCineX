import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Loading from '@/components/common/Loading'
import EmptyState from '@/components/common/EmptyState'
import { FilterTrigger } from '@/components/common/FilterDrawer'
import TheaterGroupHeaderRow from '@/components/admin/TheaterGroupHeaderRow'

import PaymentFilterDrawer from './components/PaymentFilterDrawer'
import PaymentDetailDialog from './components/PaymentDetailDialog'

import { label, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, fmtDateTime, fmtVnd } from '@/utils/labels'
import { PAYMENT_STATUS_COLORS, PAYMENT_METHOD_COLORS } from '@/utils/colors'
import {
  useAdminPayments,
  type AdminPayment,
  type AdminPaymentFilter,
} from '@/hooks/useAdminPayments'
import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import { groupByTheater } from '@/utils/groupByTheater'

const PAGE_SIZE = 20

const EMPTY_FILTER: AdminPaymentFilter = {}

export default function AdminPaymentPage() {
  const [page, setPage] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [viewItem, setViewItem] = useState<AdminPayment | null>(null)

  const [adv, setAdv] = useState<AdminPaymentFilter>(EMPTY_FILTER)

  // Admin theater context — null = tất cả; có id = filter theo theater đó
  const { currentTheater: adminTheater } = useAdminTheaterStore()

  const filter: AdminPaymentFilter = {
    ...adv,
    keyword: keyword || undefined,
    theaterId: adminTheater?.id,
    page,
    size: PAGE_SIZE,
  }
  const { data, isLoading } = useAdminPayments(filter)
  const payments = data?.content ?? []
  const totalPages = data?.totalPages ?? 0

  // Grouped view khi SUPER_ADMIN xem 'Tất cả chi nhánh'
  const showGrouped = !adminTheater
  const groupedPayments = useMemo(
    () => (showGrouped ? groupByTheater(payments) : null),
    [payments, showGrouped],
  )
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const toggleGroup = (theaterId: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      next.has(theaterId) ? next.delete(theaterId) : next.add(theaterId)
      return next
    })
  }

  const renderPaymentRow = (p: AdminPayment, idx: number) => (
    <TableRow key={p.id} className="border-[#3f382d] hover:bg-white/5 group">
      <TableCell className="text-gray-500 text-sm whitespace-nowrap">{idx + 1}</TableCell>
      <TableCell className="font-mono text-[#ffc107] text-sm whitespace-nowrap">
        <span onClick={() => setViewItem(p)} className="cursor-pointer hover:underline">
          {p.transactionCode}
        </span>
      </TableCell>
      <TableCell className="text-gray-300 whitespace-nowrap font-mono text-sm">
        {p.bookingCode && (
          <Link to="/admin/bookings" className="text-gray-300 hover:text-[#ffc107] hover:underline">
            {p.bookingCode}
          </Link>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`text-xs px-2 py-1 rounded border ${PAYMENT_METHOD_COLORS[p.method] ?? ''}`}>
          {label(PAYMENT_METHOD_LABELS, p.method)}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="text-sm font-semibold text-[#ffc107]">{fmtVnd(p.amount)}</span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`text-xs px-2 py-1 rounded border ${PAYMENT_STATUS_COLORS[p.status] ?? ''}`}>
          {label(PAYMENT_STATUS_LABELS, p.status)}
        </span>
      </TableCell>
      <TableCell className="text-gray-400 text-sm whitespace-nowrap">{fmtDateTime(p.createdAt)}</TableCell>
      <TableCell className="text-gray-400 text-sm whitespace-nowrap">{fmtDateTime(p.paidAt)}</TableCell>
    </TableRow>
  )

  const activeCount = useMemo(
    () => Object.entries(adv).filter(([, v]) => v !== undefined && v !== '' && v !== null).length,
    [adv],
  )

  function patchAdv(patch: Partial<AdminPaymentFilter>) {
    setAdv((prev) => ({ ...prev, ...patch }))
    setPage(0)
  }
  function resetAdv() {
    setAdv(EMPTY_FILTER)
    setPage(0)
  }

  if (isLoading && !data) return <Loading />

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Tìm theo mã giao dịch / mã booking..."
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(0) }}
            />
          </div>
          <FilterTrigger onClick={() => setDrawerOpen(true)} activeCount={activeCount} />
          {activeCount > 0 && (
            <Button type="button" variant="ghost" onClick={resetAdv}
              className="text-gray-400 hover:text-white hover:bg-white/5 h-9 px-2"
              title="Xóa filter">
              <X size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {payments.length === 0 ? (
        <EmptyState message="Không có giao dịch nào" />
      ) : (
        <div className="rounded-2xl border border-[#3f382d] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-[#3f382d] hover:bg-transparent">
                <TableHead className="text-gray-400 w-12">#</TableHead>
                <TableHead className="text-gray-400">Mã giao dịch</TableHead>
                <TableHead className="text-gray-400">Mã booking</TableHead>
                <TableHead className="text-gray-400">Phương thức</TableHead>
                <TableHead className="text-gray-400">Số tiền</TableHead>
                <TableHead className="text-gray-400">Trạng thái</TableHead>
                <TableHead className="text-gray-400">Tạo lúc</TableHead>
                <TableHead className="text-gray-400">Thanh toán lúc</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showGrouped && groupedPayments && groupedPayments.map((group) => {
                const isCollapsed = collapsedGroups.has(group.theaterId)
                return (
                  <React.Fragment key={`group-${group.theaterId}`}>
                    <TheaterGroupHeaderRow
                      collapsed={isCollapsed}
                      onToggle={() => toggleGroup(group.theaterId)}
                      theaterName={group.theaterName}
                      theaterCity={group.theaterCity}
                      itemCount={group.items.length}
                      itemLabel="giao dịch"
                      colSpan={8}
                    />
                    {!isCollapsed && group.items.map((p, idx) => renderPaymentRow(p, idx))}
                  </React.Fragment>
                )
              })}
              {!showGrouped && payments.map((p, index) => renderPaymentRow(p, page * PAGE_SIZE + index))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}
            className="border-white/10 text-gray-300 hover:bg-white/5">Trước</Button>
          <span className="text-gray-400 text-sm px-2 py-1">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
            className="border-white/10 text-gray-300 hover:bg-white/5">Sau</Button>
        </div>
      )}

      <PaymentFilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        adv={adv}
        onPatch={patchAdv}
        onApply={() => setDrawerOpen(false)}
        onReset={resetAdv}
      />

      <PaymentDetailDialog
        payment={viewItem}
        onClose={() => setViewItem(null)}
      />
    </div>
  )
}
