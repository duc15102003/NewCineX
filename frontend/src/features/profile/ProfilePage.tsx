import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { useProfile, useUpdateProfile, useChangePassword } from '@/hooks/useBooking'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/badge'
import Loading from '@/components/common/Loading'
import { fmtDate } from '@/utils/labels'
import api from '@/api/axios'
import { toast } from 'sonner'
import { Camera } from 'lucide-react'

// Schema cập nhật thông tin
const profileSchema = z.object({
  fullName: z.string().min(2, 'Họ tên ít nhất 2 ký tự').max(100),
  phone: z
    .string()
    .regex(/^(0|\+84)[0-9]{8,9}$/, 'Số điện thoại không hợp lệ')
    .or(z.literal('')),
})
type ProfileForm = z.infer<typeof profileSchema>

// Schema đổi mật khẩu
const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z.string().min(6, 'Mật khẩu mới ít nhất 6 ký tự'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine(d => d.newPassword === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })
type PasswordForm = z.infer<typeof passwordSchema>

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const qc = useQueryClient()

  // Form cập nhật thông tin
  const {
    register: regProfile,
    handleSubmit: handleProfile,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: '', phone: '' },
  })

  // Điền dữ liệu khi profile load xong
  useEffect(() => {
    if (profile) {
      resetProfile({
        fullName: profile.fullName ?? '',
        phone: profile.phone ?? '',
      })
    }
  }, [profile, resetProfile])

  // Form đổi mật khẩu
  const {
    register: regPwd,
    handleSubmit: handlePwd,
    reset: resetPwd,
    formState: { errors: pwdErrors },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  })

  async function onSaveProfile(data: ProfileForm) {
    await updateProfile.mutateAsync({
      fullName: data.fullName || undefined,
      phone: data.phone || undefined,
    })
  }

  async function onChangePassword(data: PasswordForm) {
    await changePassword.mutateAsync(data)
    resetPwd()
  }

  if (isLoading) return <Loading />

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#051424] flex items-center justify-center">
        <p className="text-red-400">Không thể tải thông tin tài khoản.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#051424] text-white py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">

        <h1 className="text-2xl font-bold text-[#eab308]">Tài khoản của tôi</h1>

        {/* Thông tin tổng quan */}
        <Card className="bg-[#0a1929] border-white/5 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative group w-16 h-16 flex-shrink-0">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#eab308] flex items-center justify-center text-2xl font-bold text-black">
                    {(profile.fullName ?? profile.username).charAt(0).toUpperCase()}
                  </div>
                )}
                <label className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera size={20} className="text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const formData = new FormData()
                    formData.append('file', file)
                    try {
                      const res = await api.post('/api/users/me/avatar', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                      })
                      const newAvatarUrl = res.data?.data?.avatarUrl
                      if (newAvatarUrl) useAuthStore.getState().updateUser({ avatarUrl: newAvatarUrl })
                      toast.success('Cập nhật ảnh đại diện thành công')
                      qc.invalidateQueries({ queryKey: ['profile'] })
                    } catch {
                      toast.error('Upload ảnh thất bại')
                    }
                  }} />
                </label>
              </div>
              <div>
                <p className="font-semibold text-lg">{profile.fullName ?? profile.username}</p>
                <p className="text-sm text-gray-400">{profile.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="warning" className="text-xs">{profile.role}</Badge>
                  {profile.enabled && (
                    <Badge variant="success" className="text-xs">Đã xác thực</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5 text-sm">
              <div>
                <p className="text-gray-500">Tên đăng nhập</p>
                <p className="font-mono text-gray-200">{profile.username}</p>
              </div>
              <div>
                <p className="text-gray-500">Ngày tham gia</p>
                <p className="text-gray-200">{fmtDate(profile.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form chỉnh sửa thông tin */}
        <Card className="bg-[#0a1929] border-white/5 text-white">
          <CardHeader>
            <CardTitle className="text-lg text-gray-100">Chỉnh sửa thông tin</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfile(onSaveProfile)} className="space-y-4">
              <div>
                <Label htmlFor="fullName" className="text-gray-300">Họ và tên</Label>
                <Input
                  id="fullName"
                  placeholder="Nguyễn Văn A"
                  className="mt-1.5 bg-[#0d2137] border-white/10 text-white placeholder:text-gray-500"
                  {...regProfile('fullName')}
                />
                {profileErrors.fullName && (
                  <p className="text-red-400 text-xs mt-1">{profileErrors.fullName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phone" className="text-gray-300">Số điện thoại</Label>
                <Input
                  id="phone"
                  placeholder="0901234567"
                  className="mt-1.5 bg-[#0d2137] border-white/10 text-white placeholder:text-gray-500"
                  {...regProfile('phone')}
                />
                {profileErrors.phone && (
                  <p className="text-red-400 text-xs mt-1">{profileErrors.phone.message}</p>
                )}
              </div>

              <Button
                type="submit"
                loading={updateProfile.isPending}
                className="w-full bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold"
              >
                Lưu thay đổi
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Form đổi mật khẩu */}
        <Card className="bg-[#0a1929] border-white/5 text-white">
          <CardHeader>
            <CardTitle className="text-lg text-gray-100">Đổi mật khẩu</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePwd(onChangePassword)} className="space-y-4">
              <div>
                <Label htmlFor="oldPassword" className="text-gray-300">Mật khẩu hiện tại <span className="text-red-400">*</span></Label>
                <Input
                  id="oldPassword"
                  type="password"
                  placeholder="••••••"
                  className="mt-1.5 bg-[#0d2137] border-white/10 text-white"
                  {...regPwd('oldPassword')}
                />
                {pwdErrors.oldPassword && (
                  <p className="text-red-400 text-xs mt-1">{pwdErrors.oldPassword.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="newPassword" className="text-gray-300">Mật khẩu mới <span className="text-red-400">*</span></Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••"
                  className="mt-1.5 bg-[#0d2137] border-white/10 text-white"
                  {...regPwd('newPassword')}
                />
                {pwdErrors.newPassword && (
                  <p className="text-red-400 text-xs mt-1">{pwdErrors.newPassword.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-gray-300">Xác nhận mật khẩu mới <span className="text-red-400">*</span></Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••"
                  className="mt-1.5 bg-[#0d2137] border-white/10 text-white"
                  {...regPwd('confirmPassword')}
                />
                {pwdErrors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1">{pwdErrors.confirmPassword.message}</p>
                )}
              </div>

              <Button
                type="submit"
                loading={changePassword.isPending}
                variant="outline"
                className="w-full border-gray-600 text-gray-200 hover:bg-[#0d2137] font-semibold"
              >
                Đổi mật khẩu
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
