import { useEffect, useState, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import EmptyState from '@/components/common/EmptyState'
import TableSkeleton from '@/components/common/TableSkeleton'
import { FilterTrigger } from '@/components/common/FilterDrawer'
import { Building2, DoorOpen, X, Ticket } from 'lucide-react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { label, BOOKING_STATUS_LABELS, fmtDateTime, fmtVnd } from '@/utils/labels'
import { BOOKING_STATUS_COLORS as STATUS_COLORS } from '@/utils/colors'
import { useAdminBookings, type AdminBooking, type AdminBookingFilter } from '@/hooks/useAdminBookings'
import { OPTIONS_DROPDOWN_PAGE_SIZE } from '@/utils/constants'
import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import { useAdminRooms } from '@/hooks/useAdminRooms'
import { useMovies } from '@/hooks/useMovies'
import BookingFilterDrawer from './components/BookingFilterDrawer'
import BookingDetailDialog from './components/BookingDetailDialog'
import { usePageTitle } from '@/hooks/usePageTitle'

const EMPTY_FILTER: AdminBookingFilter = {}
const PAGE_SIZE = 20

export default function AdminBookingPage() {
  usePageTitle('Quản lý booking')
  const [page, setPage] = useState(0)
  const [keywordInput, setKeywordInput] = useState('')
  const keyword = useDebouncedValue(keywordInput, 400)
  useEffect(() => { setPage(0) }, [keyword])
  const [viewBooking, setViewBooking] = useState<AdminBooking | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [adv, setAdv] = useState<AdminBookingFilter>(EMPTY_FILTER)

  // Admin theater context — null = tất cả; có id = filter theo theater đó.
  // KHAI BÁO TRƯỚC useMovies/useAdminRooms để pass theaterId scope dropdown.
  const { currentTheater: adminTheater } = useAdminTheaterStore()

  // Movies + rooms cho dropdown — scope theo chi nhánh đang chọn để admin
  // đứng ở Hà Nội không thấy phòng/phim CN khác trong filter.
  const { data: moviePage } = useMovies({
    size: OPTIONS_DROPDOWN_PAGE_SIZE,
    theaterId: adminTheater?.id,
  })
  const movies = moviePage?.content ?? []
  const { data: roomPage } = useAdminRooms({
    size: OPTIONS_DROPDOWN_PAGE_SIZE,
    theaterId: adminTheater?.id,
  })
  const rooms = roomPage?.content ?? []

  const filter: AdminBookingFilter = {
    ...adv,
    keyword: keyword || undefined,
    theaterId: adminTheater?.id,
    page,
    size: PAGE_SIZE,
  }
  const { data, isLoading } = useAdminBookings(filter)

  const bookings = data?.content ?? []
  const totalPages = data?.totalPages ?? 0

  // Force theater pick (industry standard): admin LUÔN xem 1 CN cụ thể qua
  // selector ở topbar. Không cần render cột "Chi nhánh" nữa.

  // Đếm số filter đang áp dụng (không tính keyword/page/size)
  const activeCount = useMemo(() => {
    return Object.entries(adv).filter(([, v]) => v !== undefined && v !== '' && v !== null).length
  }, [adv])

  function patchAdv(patch: Partial<AdminBookingFilter>) {
    setAdv((prev) => ({ ...prev, ...patch }))
    setPage(0)
  }

  function resetAdv() {
    setAdv(EMPTY_FILTER)
    setPage(0)
  }

  const renderBookingRow = (b: AdminBooking, idx: number) => (
    <BookingRow key={b.id} booking={b} index={idx} showTheater={false} onClick={setViewBooking} />
  )

  const tableCols = 9
  const showSkeleton = isLoading && !data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Tìm theo mã booking..."
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
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

      {!showSkeleton && bookings.length === 0 ? (
        <EmptyState
          icon={Ticket}
          message={keywordInput ? `Không tìm thấy booking khớp "${keywordInput}"` : 'Chưa có booking nào'}
          description={keywordInput ? 'Thử kiểm tra lại mã booking hoặc xoá bộ lọc đang áp.' : 'Booking sẽ xuất hiện khi khách đặt vé qua website, hoặc nhân viên tạo vé qua POS Bán vé.'}
        />
      ) : (
        <div className="rounded-2xl border border-[#3f382d] overflow-clip">
          <Table>
            <TableHeader>
              <TableRow className="border-[#3f382d] hover:bg-transparent">
                <TableHead className="text-gray-400 w-12">#</TableHead>
                <TableHead className="text-gray-400">Mã booking</TableHead>
                <TableHead className="text-gray-400">Người đặt</TableHead>
                <TableHead className="text-gray-400">Phim</TableHead>
                {/* Cột "Chi nhánh" bỏ — force theater pick ở topbar */}
                <TableHead className="text-gray-400">Suất chiếu</TableHead>
                <TableHead className="text-gray-400">Phòng</TableHead>
                <TableHead className="text-gray-400">Số ghế</TableHead>
                <TableHead className="text-gray-400">Tổng tiền</TableHead>
                <TableHead className="text-gray-400">Trạng thái</TableHead>
                <TableHead className="text-gray-400">Ngày đặt</TableHead>
              </TableRow>
            </TableHeader>
            {showSkeleton ? (
              <TableSkeleton rows={PAGE_SIZE} columns={tableCols} />
            ) : (
              <TableBody>
                {bookings.map((b, index) => renderBookingRow(b, page * PAGE_SIZE + index))}
              </TableBody>
            )}
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}
            className="border-white/10 text-gray-300 hover:bg-white/5">Trước</Button>
          <span className="text-gray-400 text-sm px-2 py-1">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
            className="border-white/10 text-gray-300 hover:bg-white/5">Sau</Button>
        </div>
      )}

      <BookingFilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        adv={adv}
        movies={movies}
        rooms={rooms}
        onPatch={patchAdv}
        onApply={() => setDrawerOpen(false)}
        onReset={resetAdv}
      />

      <BookingDetailDialog booking={viewBooking} onClose={() => setViewBooking(null)} />
    </div>
  )
}

// ============================================================
//  Sub-components
// ============================================================

interface BookingRowProps {
  booking: AdminBooking
  index: number
  /** Render cột Chi nhánh khi đang xem "Tất cả chi nhánh". */
  showTheater?: boolean
  onClick: (b: AdminBooking) => void
}

function BookingRow({ booking: b, index, showTheater, onClick }: BookingRowProps) {
  return (
    <TableRow className="border-[#3f382d] hover:bg-white/5 group">
      <TableCell className="text-gray-500 text-sm whitespace-nowrap">{index + 1}</TableCell>
      <TableCell className="font-mono text-[#ffc107] text-sm whitespace-nowrap">
        <span onClick={() => onClick(b)} className="cursor-pointer hover:underline">{b.bookingCode}</span>
      </TableCell>
      <TableCell className="text-gray-300 whitespace-nowrap">{b.username}</TableCell>
      <TableCell className="text-gray-300 whitespace-nowrap">{b.movieTitle}</TableCell>
      {showTheater && (
        <TableCell className="whitespace-nowrap">
          {b.theaterName ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-200">
              <Building2 size={12} className="text-[#ffc107]" />
              <span>{b.theaterName}</span>
              {b.theaterCity && <span className="text-gray-500">— {b.theaterCity}</span>}
            </span>
          ) : (
            <span className="text-xs text-gray-500">—</span>
          )}
        </TableCell>
      )}
      <TableCell className="text-gray-300 whitespace-nowrap">{fmtDateTime(b.startTime)}</TableCell>
      <TableCell className="whitespace-nowrap">
        {b.roomName && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-200">
            <DoorOpen size={12} className="text-[#ffc107]" />
            {b.roomName}
          </span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-200 font-medium">
          {b.seatCount ?? 0} ghế
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="text-sm font-semibold text-[#ffc107]">{fmtVnd(b.totalAmount)}</span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[b.status] ?? ''}`}>
          {label(BOOKING_STATUS_LABELS, b.status)}
        </span>
      </TableCell>
      <TableCell className="text-gray-400 text-sm whitespace-nowrap">{fmtDateTime(b.createdAt)}</TableCell>
    </TableRow>
  )
}
