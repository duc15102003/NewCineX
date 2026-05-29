import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import Loading from '@/components/common/Loading'
import EmptyState from '@/components/common/EmptyState'
import { DoorOpen } from 'lucide-react'
import { label, BOOKING_STATUS_LABELS, fmtDateTime } from '@/utils/labels'
import { BOOKING_STATUS_COLORS as STATUS_COLORS } from '@/utils/colors'
import { useAdminBookings } from '@/hooks/useAdmin'

function fmtPrice(v: number) {
  return v?.toLocaleString('vi-VN') + 'đ'
}

export default function AdminBookingPage() {
  const [page, setPage] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [viewBooking, setViewBooking] = useState<any>(null)

  const { data, isLoading } = useAdminBookings({ keyword: keyword || undefined, page, size: 20 })

  const bookings = data?.content ?? []
  const totalPages = data?.totalPages ?? 0

  if (isLoading) return <Loading />

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Tìm theo mã booking..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {bookings.length === 0 ? (
        <EmptyState message="Không có booking nào" />
      ) : (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-gray-400 w-12">#</TableHead>
                <TableHead className="text-gray-400">Mã booking</TableHead>
                <TableHead className="text-gray-400">Người đặt</TableHead>
                <TableHead className="text-gray-400">Phim</TableHead>
                <TableHead className="text-gray-400">Suất chiếu</TableHead>
                <TableHead className="text-gray-400">Phòng</TableHead>
                <TableHead className="text-gray-400">Số ghế</TableHead>
                <TableHead className="text-gray-400">Tổng tiền</TableHead>
                <TableHead className="text-gray-400">Trạng thái</TableHead>
                <TableHead className="text-gray-400">Ngày đặt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b, index) => (
                <TableRow key={b.id} className="border-white/5 hover:bg-white/5 group">
                  <TableCell className="text-gray-500 text-sm whitespace-nowrap">{page * 20 + index + 1}</TableCell>
                  <TableCell className="font-mono text-[#eab308] text-sm whitespace-nowrap">
                    <span onClick={() => setViewBooking(b)} className="cursor-pointer hover:underline">{b.bookingCode}</span>
                  </TableCell>
                  <TableCell className="text-gray-300 whitespace-nowrap">{b.username ?? '—'}</TableCell>
                  <TableCell className="text-gray-300 whitespace-nowrap">{b.movieTitle ?? '—'}</TableCell>
                  <TableCell className="text-gray-300 whitespace-nowrap">{fmtDateTime(b.startTime)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {b.roomName ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-200">
                        <DoorOpen size={12} className="text-[#eab308]" />
                        {b.roomName}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-200 font-medium">
                      {b.seatCount ?? 0} ghế
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-sm font-semibold text-[#eab308]">{b.totalAmount ? fmtPrice(b.totalAmount) : '—'}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[b.status] ?? ''}`}>
                      {label(BOOKING_STATUS_LABELS, b.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm whitespace-nowrap">{fmtDateTime(b.createdAt)}</TableCell>
                </TableRow>
              ))}
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

      {/* View Booking Detail Dialog */}
      <Dialog open={!!viewBooking} onOpenChange={() => setViewBooking(null)}>
        <DialogContent size="md" className="bg-[#0a1929] border-white/5 text-white">
          <DialogHeader>
            <DialogTitle>Chi tiết booking</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Mã booking</span><span className="font-mono text-[#eab308]">{viewBooking?.bookingCode}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Người đặt</span><span className="text-white">{viewBooking?.username}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Phim</span><span className="text-white">{viewBooking?.movieTitle}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Suất chiếu</span><span className="text-white">{fmtDateTime(viewBooking?.startTime)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Phòng</span><span className="text-white">{viewBooking?.roomName}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Số ghế</span><span className="text-white">{viewBooking?.seatCount}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Tổng tiền</span><span className="text-[#eab308] font-semibold">{viewBooking?.totalAmount ? fmtPrice(viewBooking.totalAmount) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Trạng thái</span>
              <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[viewBooking?.status] ?? ''}`}>{label(BOOKING_STATUS_LABELS, viewBooking?.status)}</span>
            </div>
            <div className="flex justify-between"><span className="text-gray-400">Ngày đặt</span><span className="text-white">{fmtDateTime(viewBooking?.createdAt)}</span></div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewBooking(null)} className="border-white/10 text-gray-300 hover:bg-white/5">Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
