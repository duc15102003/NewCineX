import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { label, BOOKING_STATUS_LABELS, fmtDateTime, fmtVnd } from '@/utils/labels'
import { BOOKING_STATUS_COLORS as STATUS_COLORS } from '@/utils/colors'
import type { AdminBooking } from '@/hooks/useAdminBookings'

export interface BookingDetailDialogProps {
  booking: AdminBooking | null
  onClose: () => void
}

/** Dialog read-only xem chi tiết 1 booking. */
export default function BookingDetailDialog({ booking, onClose }: BookingDetailDialogProps) {
  return (
    <Dialog open={!!booking} onOpenChange={() => onClose()}>
      <DialogContent size="md" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle>Chi tiết booking</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3 text-sm">
          <Row label="Mã booking">
            <span className="font-mono text-[#ffc107]">{booking?.bookingCode}</span>
          </Row>
          <Row label="Người đặt"><span className="text-white">{booking?.username}</span></Row>
          <Row label="Phim"><span className="text-white">{booking?.movieTitle}</span></Row>
          <Row label="Suất chiếu"><span className="text-white">{fmtDateTime(booking?.startTime)}</span></Row>
          <Row label="Phòng"><span className="text-white">{booking?.roomName}</span></Row>
          <Row label="Số ghế"><span className="text-white">{booking?.seatCount}</span></Row>
          <Row label="Tổng tiền">
            <span className="text-[#ffc107] font-semibold">
              {booking?.totalAmount ? fmtVnd(booking.totalAmount) : ''}
            </span>
          </Row>
          <Row label="Trạng thái">
            {booking && (
              <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[booking.status] ?? ''}`}>
                {label(BOOKING_STATUS_LABELS, booking.status)}
              </span>
            )}
          </Row>
          <Row label="Ngày đặt"><span className="text-white">{fmtDateTime(booking?.createdAt)}</span></Row>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}
            className="border-white/10 text-gray-300 hover:bg-white/5">Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      {children}
    </div>
  )
}
