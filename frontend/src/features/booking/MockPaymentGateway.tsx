import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ShieldCheck, CreditCard, XCircle } from 'lucide-react'

function formatPrice(amount: number) {
  return amount.toLocaleString('vi-VN') + 'đ'
}

/**
 * Trang giả lập cổng thanh toán — giống VNPay nhưng đơn giản.
 * Demo cho thầy cô thấy flow: App → Cổng TT → Callback → Kết quả.
 * Production thay MockPaymentProcessor → VNPayPaymentProcessor (Strategy Pattern).
 */
export default function MockPaymentGateway() {
  const [params] = useSearchParams()
  const transactionCode = params.get('transactionCode') ?? ''
  const amount = Number(params.get('amount') ?? 0)
  const description = params.get('description') ?? ''

  const callbackBase = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8088'}/api/payments/callback`

  function handleSuccess() {
    window.location.href = `${callbackBase}?transactionCode=${transactionCode}&status=SUCCESS`
  }

  function handleCancel() {
    window.location.href = `${callbackBase}?transactionCode=${transactionCode}&status=FAILED`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1929] to-[#051424] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header cổng TT */}
        <div className="bg-[#0a1929] border border-white/10 rounded-t-2xl p-6 text-center border-b-0">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShieldCheck size={24} className="text-[#eab308]" />
            <h1 className="text-xl font-bold text-white">CineX Pay</h1>
          </div>
          <p className="text-xs text-gray-500">Cổng thanh toán giả lập — Môi trường Development</p>
        </div>

        {/* Thông tin đơn hàng */}
        <div className="bg-[#0d2137] border border-white/10 p-6 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <CreditCard size={20} className="text-[#eab308]" />
            <span className="text-sm text-gray-300">Thông tin giao dịch</span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Mã giao dịch</span>
              <span className="font-mono text-[#eab308] font-medium">{transactionCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Nội dung</span>
              <span className="text-white text-right max-w-[200px]">{description}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-white/5">
              <span className="text-gray-300 font-medium">Số tiền</span>
              <span className="text-2xl font-bold text-[#eab308]">{formatPrice(amount)}</span>
            </div>
          </div>
        </div>

        {/* Phương thức thanh toán giả */}
        <div className="bg-[#0d2137] border border-white/10 border-t-0 p-6">
          <p className="text-xs text-gray-500 mb-4 text-center">Chọn kết quả thanh toán để tiếp tục</p>

          <div className="space-y-3">
            <Button onClick={handleSuccess}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold text-base">
              ✅ Thanh toán thành công
            </Button>
            <Button onClick={handleCancel} variant="outline"
              className="w-full h-12 border-red-500/30 text-red-400 hover:bg-red-500/10 font-semibold text-base">
              <XCircle size={16} className="mr-2" /> Hủy giao dịch
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#0a1929] border border-white/10 rounded-b-2xl border-t-0 p-4 text-center">
          <p className="text-[10px] text-gray-600">
            Đây là cổng thanh toán giả lập cho môi trường phát triển.
            <br />Production sẽ tích hợp VNPay / MoMo thật qua Strategy Pattern.
          </p>
        </div>
      </div>
    </div>
  )
}
