import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, CheckCircle2, XCircle } from 'lucide-react'
import api, { getErrorMessage } from '@/api/axios'

const schema = z.object({
  newPassword: z.string().min(6, 'Mật khẩu từ 6-100 ký tự').max(100, 'Mật khẩu từ 6-100 ký tự'),
  confirmPassword: z.string().min(1, 'Xác nhận mật khẩu là bắt buộc'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'form' | 'success' | 'error'>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    if (!token) return
    setLoading(true)
    try {
      await api.post('/api/auth/reset-password', {
        token,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      })
      setStatus('success')
    } catch (e) {
      setErrorMsg(getErrorMessage(e, 'Đặt lại mật khẩu thất bại'))
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#0a1929] border border-white/5 rounded-2xl p-8 text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Link không hợp lệ</h1>
          <p className="text-gray-400 text-sm mb-6">Thiếu token trong URL. Vui lòng yêu cầu gửi lại email.</p>
          <Link to="/forgot-password">
            <Button className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold">
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
        <div className="w-full max-w-md bg-[#0a1929] border border-white/5 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Đặt lại mật khẩu thành công!</h1>
          <p className="text-gray-400 text-sm mb-6">Bạn có thể đăng nhập bằng mật khẩu mới.</p>
          <Link to="/login">
            <Button className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold">
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
        <div className="w-full max-w-md bg-[#0a1929] border border-white/5 rounded-2xl p-8 text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Không thể đặt lại mật khẩu</h1>
          <p className="text-gray-400 text-sm mb-6">{errorMsg}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setStatus('form')}
              className="border-white/10 text-gray-300 hover:bg-white/5">
              Thử lại
            </Button>
            <Link to="/forgot-password">
              <Button className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold">
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
      <div className="w-full max-w-md bg-[#0a1929] border border-white/5 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-[#eab308]/10 flex items-center justify-center">
            <Lock size={24} className="text-[#eab308]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Đặt lại mật khẩu</h1>
            <p className="text-gray-400 text-sm">Nhập mật khẩu mới cho tài khoản</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="text-gray-400">Mật khẩu mới <span className="text-red-400">*</span></Label>
            <Input type="password" {...register('newPassword')} placeholder="Tối thiểu 6 ký tự" className="mt-1.5" />
            {errors.newPassword && <p className="text-red-400 text-xs mt-1">{errors.newPassword.message}</p>}
          </div>
          <div>
            <Label className="text-gray-400">Xác nhận mật khẩu <span className="text-red-400">*</span></Label>
            <Input type="password" {...register('confirmPassword')} placeholder="Nhập lại mật khẩu" className="mt-1.5" />
            {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
          </div>
          <Button type="submit" disabled={loading}
            className="w-full bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold h-11">
            {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
          </Button>
        </form>
      </div>
    </div>
  )
}
