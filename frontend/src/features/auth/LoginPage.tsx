import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate } from 'react-router-dom'
import { useLogin } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'

const loginSchema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  // mode='onTouched' = validate khi blur input lần đầu rồi switch onChange
  // → user nhập đến đâu thấy lỗi đến đó nhưng không spam error khi vừa focus.
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
  })
  const login = useLogin()

  // Đã đăng nhập → redirect về trang chủ (không cho vào lại trang login)
  if (isLoggedIn()) return <Navigate to="/" replace />

  const onSubmit = (data: LoginForm) => {
    login.mutate(data)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#201b11] border border-white/5 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Đăng nhập</h1>
          <p className="text-gray-400 text-center text-sm mb-8">
            Đăng nhập để đặt vé xem phim
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <Label htmlFor="username">Tên đăng nhập <span className="text-red-400">*</span></Label>
              <Input
                id="username"
                placeholder="Tên đăng nhập"
                aria-invalid={!!errors.username}
                className={`mt-1.5 bg-[#2a2317] ${errors.username ? 'border-red-500/60 focus:border-red-500' : 'border-white/10'}`}
                {...register('username')}
              />
              {errors.username && (
                <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Mật khẩu <span className="text-red-400">*</span></Label>
              <div className="mt-1.5">
                <PasswordInput id="password" placeholder="••••••" {...register('password')} />
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-[#ffc107] hover:underline">
                Quên mật khẩu?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
              disabled={login.isPending}
            >
              {login.isPending ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-[#ffc107] hover:underline">
              Đăng ký
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
