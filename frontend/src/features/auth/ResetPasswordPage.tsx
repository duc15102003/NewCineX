import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Lock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { getErrorMessage } from '@/api/axios'
import { useResetPassword } from '@/hooks/useAuth'

const schema = z.object({
  newPassword: z.string().min(6, 'Mật khẩu từ 6-100 ký tự').max(100, 'Mật khẩu từ 6-100 ký tự'),
  confirmPassword: z.string().min(1, 'Xác nhận mật khẩu là bắt buộc'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

/**
 * Phân loại lỗi BE trả về:
 * - TERMINAL: token sai/hết hạn → user không tự sửa được, switch sang trang lỗi
 *   để dẫn về flow forgot-password.
 * - RETRYABLE: mật khẩu yếu/trùng/không khớp → show banner đỏ trên form, giữ
 *   nguyên form để user sửa và submit lại (chuẩn CGV/Lotte/ngân hàng).
 */
function isTerminalError(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('token') || lower.includes('hết hạn') || lower.includes('expired')
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'form' | 'success' | 'error'>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [inlineError, setInlineError] = useState('')
  const resetPassword = useResetPassword()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function onSubmit(data: FormData) {
    if (!token) return
    setInlineError('')
    resetPassword.mutate(
      { token, newPassword: data.newPassword, confirmPassword: data.confirmPassword },
      {
        onSuccess: () => setStatus('success'),
        onError: (e) => {
          const msg = getErrorMessage(e, 'Đặt lại mật khẩu thất bại')
          if (isTerminalError(msg)) {
            setErrorMsg(msg)
            setStatus('error')
          } else {
            setInlineError(msg)
          }
        },
      },
    )
  }

  if (!token) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#201b11] border border-white/5 rounded-2xl p-8 text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Liên kết không hợp lệ</h1>
          <p className="text-gray-400 text-sm mb-6">Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại email.</p>
          <Link to="/forgot-password">
            <Button className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
              Gửi lại email
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#201b11] border border-white/5 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Đặt lại mật khẩu thành công!</h1>
          <p className="text-gray-400 text-sm mb-6">Bạn có thể đăng nhập bằng mật khẩu mới.</p>
          <Link to="/login">
            <Button className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
              Đăng nhập ngay
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#201b11] border border-white/5 rounded-2xl p-8 text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Không thể đặt lại mật khẩu</h1>
          <p className="text-gray-400 text-sm mb-6">{errorMsg}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setStatus('form')}
              className="border-white/10 text-gray-300 hover:bg-white/5">
              Thử lại
            </Button>
            <Link to="/forgot-password">
              <Button className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
                Gửi lại email
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#201b11] border border-white/5 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-[#ffc107]/10 flex items-center justify-center">
            <Lock size={24} className="text-[#ffc107]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Đặt lại mật khẩu</h1>
            <p className="text-gray-400 text-sm">Nhập mật khẩu mới cho tài khoản</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {inlineError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{inlineError}</p>
            </div>
          )}
          <div>
            <Label className="text-gray-400">Mật khẩu mới <span className="text-red-400">*</span></Label>
            <div className="mt-1.5">
              <PasswordInput {...register('newPassword')} placeholder="Tối thiểu 6 ký tự" />
            </div>
            {errors.newPassword && <p className="text-red-400 text-xs mt-1">{errors.newPassword.message}</p>}
          </div>
          <div>
            <Label className="text-gray-400">Xác nhận mật khẩu <span className="text-red-400">*</span></Label>
            <div className="mt-1.5">
              <PasswordInput {...register('confirmPassword')} placeholder="Nhập lại mật khẩu" />
            </div>
            {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
          </div>
          <Button type="submit" disabled={resetPassword.isPending}
            className="w-full bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold h-11 rounded-lg">
            {resetPassword.isPending ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
          </Button>
        </form>
      </div>
    </div>
  )
}
