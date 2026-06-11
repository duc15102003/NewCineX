import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react'
import { getErrorMessage } from '@/api/axios'
import { useVerifyEmail } from '@/hooks/useAuth'

/**
 * Trang xử lý link xác thực email từ email user nhận sau khi đăng ký.
 *
 * Luồng:
 * 1. User nhận email → click link `${frontendUrl}/verify-email?token=xxx`
 * 2. Trang đọc query `token` → POST/GET `/api/auth/verify-email?token=xxx`
 * 3. BE validate token (tồn tại, chưa used, chưa expired) → set user.emailVerified = true
 * 4. FE hiển thị success → user redirect về login hoặc trang chủ
 *
 * Edge cases:
 * - Token thiếu → error
 * - Token sai/expired → error với message rõ ràng
 * - Token đã dùng → success idempotent (đã verify rồi cũng OK)
 */
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [errorMsg, setErrorMsg] = useState('')
  const verifyEmail = useVerifyEmail()
  // useRef guard: React 18 StrictMode mount component 2 lần ở dev → chống call API 2 lần
  // → tránh request đầu success, request thứ 2 fail vì token đã used.
  const calledRef = useRef(false)

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    if (!token) {
      setStatus('error')
      setErrorMsg('Liên kết không hợp lệ — thiếu token xác thực.')
      return
    }

    verifyEmail.mutate(token, {
      onSuccess: () => setStatus('success'),
      onError: (e) => {
        setStatus('error')
        setErrorMsg(getErrorMessage(e, 'Token không hợp lệ hoặc đã hết hạn'))
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="min-h-screen bg-[#181309] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#201b11] border border-white/5 rounded-2xl p-8 text-center">
        {status === 'pending' && (
          <>
            <Loader2 className="w-16 h-16 text-[#ffc107] mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold text-white mb-2">Đang xác thực email...</h1>
            <p className="text-gray-400">Vui lòng đợi trong giây lát.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Xác thực thành công!</h1>
            <p className="text-gray-400 mb-6">
              Email của bạn đã được xác thực. Bây giờ bạn có thể sử dụng đầy đủ tính năng của CineX.
            </p>
            <Link to="/login">
              <Button className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold w-full rounded-lg">
                <Mail className="w-4 h-4 mr-2" />
                Đăng nhập ngay
              </Button>
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Xác thực thất bại</h1>
            <p className="text-gray-400 mb-6">{errorMsg}</p>
            <div className="flex flex-col gap-2">
              <Link to="/login">
                <Button variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5 w-full">
                  Quay lại đăng nhập
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold w-full rounded-lg">
                  Đăng ký lại
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
