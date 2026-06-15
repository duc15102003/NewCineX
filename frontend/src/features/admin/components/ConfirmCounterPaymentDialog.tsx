import { useEffect, useState } from 'react'
import { Banknote, CreditCard, QrCode, Loader2 } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fmtVnd } from '@/utils/labels'

import type { PosPaymentMethod } from './POSOrderSummary'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  paymentMethod: PosPaymentMethod
  totalAmount: number
  loading: boolean
  onConfirm: () => void
}

/**
 * Dialog xác nhận thanh toán tại quầy — flow chuẩn rạp:
 *
 * <p>CASH: NV nhập tiền nhận từ khách → tính tiền thối → confirm
 * <br>CARD_POS: NV gửi số tiền sang máy POS thẻ → khách cà → máy báo OK → confirm
 * <br>MOMO: hiện QR → khách scan trả → NV nhận thông báo MoMo → confirm
 *
 * <p>Chặn case "auto thanh toán khi click" — staff phải XÁC NHẬN tiền đã
 * vào két/máy POS/MoMo thành công. Sai sót giảm hẳn so với 1-click.
 */
export default function ConfirmCounterPaymentDialog({
  open, onOpenChange, paymentMethod, totalAmount, loading, onConfirm,
}: Props) {
  const [tendered, setTendered] = useState<string>('')

  useEffect(() => {
    if (open) setTendered('')
  }, [open])

  const tenderedNum = Number(tendered) || 0
  const change = tenderedNum - totalAmount
  const cashReady = paymentMethod !== 'CASH' || tenderedNum >= totalAmount

  const config = METHOD_CONFIG[paymentMethod]
  const Icon = config.icon

  function handleConfirm() {
    if (loading) return
    if (paymentMethod === 'CASH' && tenderedNum < totalAmount) return
    onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent size="md" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon size={18} className={config.iconColor} />
            {config.title}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="rounded-xl border border-[#ffc107]/30 bg-[#ffc107]/5 p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Tổng cần thu</p>
              <p className="text-2xl font-bold text-[#ffc107]">{fmtVnd(totalAmount)}</p>
            </div>

            {paymentMethod === 'CASH' && (
              <>
                <div>
                  <Label className="text-xs text-gray-400 mb-1.5 block">
                    Tiền nhận từ khách <span className="text-red-400">*</span>
                  </Label>
                  <Input type="number"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'e' || e.key === '-' || e.key === '+') e.preventDefault()
                    }}
                    placeholder={`Ít nhất ${fmtVnd(totalAmount)}`}
                    autoFocus
                    className="text-lg h-11" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_TENDER.filter(v => v >= totalAmount).slice(0, 4).map(v => (
                    <button key={v} type="button"
                      onClick={() => setTendered(String(v))}
                      className="px-3 py-2 rounded-md border border-white/10 bg-[#2a2317] text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                      {fmtVnd(v)}
                    </button>
                  ))}
                </div>
                <div className={`rounded-xl border p-3 ${
                  change < 0
                    ? 'border-red-500/30 bg-red-500/5'
                    : change === 0
                      ? 'border-white/10 bg-white/[0.02]'
                      : 'border-green-500/30 bg-green-500/5'
                }`}>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-gray-400">
                      {change < 0 ? 'Còn thiếu' : 'Tiền thối'}
                    </span>
                    <span className={`text-xl font-bold ${
                      change < 0 ? 'text-red-400' : change === 0 ? 'text-gray-300' : 'text-green-400'
                    }`}>
                      {fmtVnd(Math.abs(change))}
                    </span>
                  </div>
                </div>
              </>
            )}

            {paymentMethod === 'CARD_POS' && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.06] p-4 space-y-2">
                <p className="text-sm text-blue-200">
                  <span className="font-semibold">Bước thực hiện:</span>
                </p>
                <ol className="text-xs text-gray-300 space-y-1.5 ml-4 list-decimal leading-relaxed">
                  <li>Gửi số tiền <span className="text-[#ffc107] font-semibold">{fmtVnd(totalAmount)}</span> sang máy POS thẻ</li>
                  <li>Khách cà thẻ / chèn thẻ</li>
                  <li>Đợi máy POS thẻ in biên lai thành công</li>
                  <li>Bấm "Xác nhận" bên dưới</li>
                </ol>
              </div>
            )}

            {paymentMethod === 'MOMO' && (
              <div className="rounded-xl border border-pink-500/30 bg-pink-500/[0.06] p-4 space-y-3">
                <p className="text-sm text-pink-200">
                  <span className="font-semibold">Bước thực hiện:</span>
                </p>
                <ol className="text-xs text-gray-300 space-y-1.5 ml-4 list-decimal leading-relaxed">
                  <li>Mở app MoMo của quầy → tạo yêu cầu thu <span className="text-[#ffc107] font-semibold">{fmtVnd(totalAmount)}</span></li>
                  <li>Hiển thị QR cho khách scan</li>
                  <li>Khách trả thành công → quầy nhận thông báo MoMo</li>
                  <li>Bấm "Xác nhận" bên dưới</li>
                </ol>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={loading}
            onClick={() => onOpenChange(false)}
            className="border-white/10 text-gray-300 hover:bg-white/5">
            Huỷ
          </Button>
          <Button type="button"
            onClick={handleConfirm}
            disabled={loading || !cashReady}
            className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
            {loading
              ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Đang ghi...</>
              : 'Xác nhận đã thu tiền'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Mệnh giá thường dùng để quick-pick — chỉ hiện ≥ totalAmount. */
const QUICK_TENDER = [50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000]

const METHOD_CONFIG: Record<PosPaymentMethod, { title: string; icon: typeof Banknote; iconColor: string }> = {
  CASH: {
    title: 'Thu tiền mặt tại quầy',
    icon: Banknote,
    iconColor: 'text-green-400',
  },
  CARD_POS: {
    title: 'Thanh toán qua máy POS thẻ',
    icon: CreditCard,
    iconColor: 'text-blue-400',
  },
  MOMO: {
    title: 'Thanh toán qua MoMo QR',
    icon: QrCode,
    iconColor: 'text-pink-400',
  },
}
