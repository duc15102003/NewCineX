import { Printer, X, Download } from 'lucide-react'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { fmtVnd, fmtDateTime, fmtTime, fmtDate } from '@/utils/labels'
import { downloadReceiptPDF } from '@/utils/receiptPdf'
import { usePublicConfigNumber } from '@/hooks/useConfig'

/**
 * Hoá đơn snack tại quầy.
 */
export interface SnackReceiptData {
  kind: 'SNACK'
  orderCode: string
  items: Array<{
    name: string
    quantity: number
    price: number
    kind: 'SNACK' | 'COMBO'
  }>
  total: number
  note?: string | null
  paidAt: string
}

/**
 * Vé phim — in cùng QR + thông tin chỗ ngồi để khách dùng vào rạp.
 */
export interface TicketReceiptData {
  kind: 'TICKET'
  bookingCode: string
  movieTitle: string
  roomName: string
  startTime: string
  seats: Array<{ seatNumber: string; seatType: string; price: number }>
  total: number
  paymentMethod: string
  paidAt: string
}

export type ReceiptData = SnackReceiptData | TicketReceiptData

interface Props {
  open: boolean
  onClose: () => void
  data: ReceiptData | null
  /** Tên chi nhánh in trên đầu hoá đơn. */
  theaterName?: string | null
  /** Tên nhân viên POS đang trực — in cuối hoá đơn để truy vết. */
  cashierName?: string | null
}

/**
 * Dialog hiển thị hoá đơn / vé sau khi POS bán thành công. Bấm "In" sẽ gọi
 * window.print() — CSS @media print ở stylesheet global ẩn mọi thứ ngoài
 * .receipt-printable.
 */
export default function ReceiptDialog({ open, onClose, data, theaterName, cashierName }: Props) {
  // Số phút khuyến nghị đến sớm — config động, admin sửa qua Cấu hình hệ thống.
  // Fallback 15 nếu config chưa fetch (network slow). React Query cache 5 phút
  // nên hook chạy nhẹ, không fire request mỗi lần mở dialog.
  const { data: arriveEarlyMinutes } = usePublicConfigNumber('ticket.arrive_early_minutes', 15)
  if (!data) return null
  const isTicket = data.kind === 'TICKET'
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl p-0 overflow-hidden">
        {/* Toolbar — không in */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3f382d] no-print">
          <h3 className="text-sm font-semibold text-amber-50">
            {isTicket ? 'Vé phim' : 'Hoá đơn bán hàng'}
          </h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline"
              onClick={() => downloadReceiptPDF(data, { theaterName, cashierName, arriveEarlyMinutes })}
              className="border-[#ffc107]/40 text-[#ffc107] hover:bg-[#ffc107]/10 hover:text-[#ffc107]"
              title="Tải file PDF — dùng khi không có máy in vật lý">
              <Download size={14} className="mr-1" /> Tải PDF
            </Button>
            <Button size="sm" onClick={() => window.print()}
              className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-md"
              title="In ra máy in vật lý — hoặc chọn 'Save as PDF' trong dialog in của trình duyệt">
              <Printer size={14} className="mr-1" /> In ({navigator.platform.toLowerCase().includes('mac') ? '⌘P' : 'Ctrl+P'})
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-white/5">
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Receipt body — vùng được in */}
        <div className="receipt-printable bg-white text-black p-6 font-mono text-[12px] leading-relaxed">
          <header className="text-center border-b border-dashed border-gray-400 pb-2 mb-3">
            <h1 className="text-lg font-bold tracking-wider">CINEX</h1>
            {theaterName && <p className="text-[11px]">{theaterName}</p>}
            <p className="text-[10px] text-gray-600 mt-1">
              {isTicket ? '— VÉ XEM PHIM —' : '— HOÁ ĐƠN BÁN HÀNG —'}
            </p>
          </header>

          {/* Mã + thời gian */}
          <div className="mb-3 text-[11px]">
            <div className="flex justify-between">
              <span>Mã {isTicket ? 'vé' : 'đơn'}:</span>
              <span className="font-bold">{isTicket ? data.bookingCode : data.orderCode}</span>
            </div>
            <div className="flex justify-between">
              <span>Thời gian:</span>
              <span>{fmtDateTime(data.paidAt)}</span>
            </div>
            {!isTicket && cashierName && (
              <div className="flex justify-between">
                <span>NV phục vụ:</span>
                <span>{cashierName}</span>
              </div>
            )}
          </div>

          {isTicket ? (
            <>
              {/* Thông tin suất */}
              <div className="border-y border-dashed border-gray-400 py-2 mb-3 space-y-0.5">
                <div className="font-bold text-[13px] uppercase">{data.movieTitle}</div>
                <div className="flex justify-between">
                  <span>Suất:</span>
                  <span>{fmtTime(data.startTime)} · {fmtDate(data.startTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Phòng:</span>
                  <span>{data.roomName}</span>
                </div>
              </div>

              {/* Danh sách ghế */}
              <div className="mb-3">
                <div className="font-bold mb-1">Ghế ({data.seats.length}):</div>
                <div className="grid grid-cols-2 gap-x-3">
                  {data.seats.map((s, i) => (
                    <div key={i} className="flex justify-between border-b border-dotted border-gray-300">
                      <span>{s.seatNumber} <span className="text-[10px] text-gray-600">({s.seatType})</span></span>
                      <span>{fmtVnd(s.price)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between text-[11px] mb-3">
                <span>Phương thức:</span>
                <span className="font-bold uppercase">{paymentLabel(data.paymentMethod)}</span>
              </div>
            </>
          ) : (
            <>
              {/* Danh sách items snack/combo */}
              <div className="border-y border-dashed border-gray-400 py-2 mb-3">
                {data.items.map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <span>
                      {it.kind === 'COMBO' && <span className="text-[9px] mr-1 px-1 border border-gray-400 rounded">CB</span>}
                      {it.name} <span className="text-[10px]">× {it.quantity}</span>
                    </span>
                    <span>{fmtVnd(it.price * it.quantity)}</span>
                  </div>
                ))}
              </div>

              {data.note && (
                <div className="mb-3 text-[11px]">
                  <div className="font-bold">Ghi chú:</div>
                  <div className="italic">{data.note}</div>
                </div>
              )}
            </>
          )}

          {/* Tổng */}
          <div className="border-t border-double border-gray-700 pt-2 flex justify-between text-[14px] font-bold">
            <span>TỔNG TIỀN:</span>
            <span>{fmtVnd(data.total)}</span>
          </div>

          {/* Footer */}
          <footer className="text-center text-[10px] text-gray-600 mt-4 pt-2 border-t border-dashed border-gray-300">
            {isTicket ? (
              <>
                <p className="font-bold">Vui lòng đến sớm {arriveEarlyMinutes ?? 15} phút trước giờ chiếu</p>
                <p className="mt-1">Trình mã vé này tại cổng soát vé</p>
              </>
            ) : (
              <>
                <p>Cảm ơn quý khách</p>
                <p className="mt-1">Hẹn gặp lại</p>
              </>
            )}
          </footer>
        </div>

        {/* Action row dưới — không in */}
        <div className="px-4 py-3 border-t border-[#3f382d] flex justify-end no-print">
          <Button variant="outline" size="sm" onClick={onClose}
            className="border-white/10 text-gray-300 hover:bg-white/5">
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function paymentLabel(method: string): string {
  switch (method) {
    case 'CASH': return 'Tiền mặt'
    case 'MOMO': return 'MoMo'
    case 'CARD': return 'Thẻ'
    default: return method
  }
}
