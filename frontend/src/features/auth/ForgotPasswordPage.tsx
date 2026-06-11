import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useForgotPassword } from '@/hooks/useAuth'

const schema = z.object({
  email: z.string().min(1, 'Email là bắt buộc').email('Email không hợp lệ'),
})

type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const forgotPassword = useForgotPassword()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Luôn hiện success (chống user enumeration) — kể cả mạng lỗi cũng treat as sent.
  function onSubmit(data: FormData) {
    forgotPassword.mutate(data.email, {
      onSettled: () => setSent(true),
    })
  }

  if (sent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#201b11] border border-white/5 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Kiểm tra email của bạn</h1>
          <p className="text-gray-400 text-sm mb-6">
            Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.
            Vui lòng kiểm tra hộp thư (bao gồm spam).
          </p>
          <Link to="/login">
            <Button className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
              Quay lại đăng nhập
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#201b11] border border-white/5 rounded-2xl p-8">
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6">
          <ArrowLeft size={14} /> Quay lại đăng nhập
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-[#ffc107]/10 flex items-center justify-center">
            <Mail size={24} className="text-[#ffc107]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Quên mật khẩu</h1>
            <p className="text-gray-400 text-sm">Nhập email để nhận link đặt lại</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="text-gray-400">Email <span className="text-red-400">*</span></Label>
            <Input {...register('email')} placeholder="your@email.com" className="mt-1.5" />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <Button type="submit" disabled={forgotPassword.isPending}
            className="w-full bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold h-11 rounded-lg">
            {forgotPassword.isPending ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
          </Button>
        </form>
      </div>
    </div>
  )
}
