import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { label, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, fmtDateTime, fmtVnd } from '@/utils/labels'
import { PAYMENT_METHOD_COLORS, PAYMENT_STATUS_COLORS } from '@/utils/colors'

interface PaymentDetail {
  transactionCode: string
  bookingCode: string | null
  method: string
  amount: number | null
  status: string
  createdAt: string | null
  paidAt: string | null
  paymentUrl: string | null
}

export interface PaymentDetailDialogProps {
  payment: PaymentDetail | null
  onClose: () => void
}

/** Dialog chi tiết giao dịch payment — read-only, không edit. */
export default function PaymentDetailDialog({ payment, onClose }: PaymentDetailDialogProps) {
  return (
    <Dialog open={!!payment} onOpenChange={() => onClose()}>
      <DialogContent size="md" className="bg-[#201b11] border-white/5 text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle>Chi tiết giao dịch</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3 text-sm">
          <Row label="Mã giao dịch">
            <span className="font-mono text-[#ffc107]">{payment?.transactionCode}</span>
          </Row>
          <Row label="Mã booking">
            <span className="font-mono text-white">{payment?.bookingCode ?? ''}</span>
          </Row>
          <Row label="Phương thức">
            {payment && (
              <span className={`text-xs px-2 py-1 rounded border ${PAYMENT_METHOD_COLORS[payment.method] ?? ''}`}>
                {label(PAYMENT_METHOD_LABELS, payment.method)}
              </span>
            )}
          </Row>
          <Row label="Số tiền">
            <span className="text-[#ffc107] font-semibold">{fmtVnd(payment?.amount)}</span>
          </Row>
          <Row label="Trạng thái">
            {payment && (
              <span className={`text-xs px-2 py-1 rounded border ${PAYMENT_STATUS_COLORS[payment.status] ?? ''}`}>
                {label(PAYMENT_STATUS_LABELS, payment.status)}
              </span>
            )}
          </Row>
          <Row label="Tạo lúc">
            <span className="text-white">{fmtDateTime(payment?.createdAt)}</span>
          </Row>
          <Row label="Thanh toán lúc">
            <span className="text-white">{fmtDateTime(payment?.paidAt)}</span>
          </Row>
          {payment?.paymentUrl && (
            <div className="flex justify-between gap-2">
              <span className="text-gray-400 shrink-0">URL thanh toán</span>
              <a href={payment.paymentUrl} target="_blank" rel="noreferrer"
                className="text-[#ffc107] underline truncate">
                {payment.paymentUrl}
              </a>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}
            className="border-white/10 text-gray-300 hover:bg-white/5">Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface RowProps {
  label: string
  children: React.ReactNode
}

function Row({ label, children }: RowProps) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      {children}
    </div>
  )
}
