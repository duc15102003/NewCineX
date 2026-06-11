import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate } from 'react-router-dom'
import { useRegister } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'

const registerSchema = z.object({
  fullName: z.string().optional(),
  username: z.string().min(3, 'Tên đăng nhập tối thiểu 3 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  // mode='onTouched': lỗi xuất hiện sau lần blur đầu rồi update theo onChange
  // → user nhập email sai → blur → thấy lỗi → fix → lỗi tự biến mất khi đúng
  const { register: reg, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
  })
  const registerMutation = useRegister()

  if (isLoggedIn()) return <Navigate to="/" replace />

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate({
      fullName: data.fullName || undefined,
      username: data.username,
      email: data.email,
      password: data.password,
    })
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-[#201b11] border border-white/5 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Đăng ký</h1>
          <p className="text-gray-400 text-center text-sm mb-8">
            Tạo tài khoản CineX miễn phí
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Họ tên</Label>
              <Input
                id="fullName"
                placeholder="Vũ Tường An"
                className="mt-1.5 bg-[#2a2317] border-white/10"
                {...reg('fullName')}
              />
              {errors.fullName && (
                <p className="text-red-400 text-xs mt-1">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="username">Tên đăng nhập <span className="text-red-400">*</span></Label>
              <Input
                id="username"
                placeholder="Tên đăng nhập"
                aria-invalid={!!errors.username}
                className={`mt-1.5 bg-[#2a2317] ${errors.username ? 'border-red-500/60 focus:border-red-500' : 'border-white/10'}`}
                {...reg('username')}
              />
              {errors.username && (
                <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email <span className="text-red-400">*</span></Label>
              <Input
                id="email"
                type="email"
                placeholder="Nhập email"
                aria-invalid={!!errors.email}
                className={`mt-1.5 bg-[#2a2317] ${errors.email ? 'border-red-500/60 focus:border-red-500' : 'border-white/10'}`}
                {...reg('email')}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Mật khẩu <span className="text-red-400">*</span></Label>
              <div className="mt-1.5">
                <PasswordInput id="password" placeholder="Tối thiểu 6 ký tự" {...reg('password')} />
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu <span className="text-red-400">*</span></Label>
              <div className="mt-1.5">
                <PasswordInput id="confirmPassword" placeholder="Nhập lại mật khẩu" {...reg('confirmPassword')} />
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? 'Đang đăng ký...' : 'Đăng ký'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-[#ffc107] hover:underline">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
