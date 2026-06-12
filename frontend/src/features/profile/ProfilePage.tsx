import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useProfile, useUpdateProfile, useChangePassword } from '@/hooks/useBooking'
import { useUploadAvatar } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Loading from '@/components/common/Loading'
import { fmtDate } from '@/utils/labels'
import { Camera, Loader2 } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'

// Schema cập nhật thông tin
const profileSchema = z.object({
  fullName: z.string().min(2, 'Họ tên ít nhất 2 ký tự').max(100),
  phone: z
    .string()
    .regex(/^(0|\+84)[0-9]{8,9}$/, 'Số điện thoại không hợp lệ')
    .or(z.literal('')),
  // Ngày sinh optional — nếu khai thì BE auto-block phim không đủ tuổi (Phase 2).
  dateOfBirth: z
    .string()
    .refine(v => !v || new Date(v) < new Date(), 'Ngày sinh phải là ngày trong quá khứ')
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
  usePageTitle('Hồ sơ cá nhân')
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const uploadAvatar = useUploadAvatar()

  // Form cập nhật thông tin
  const {
    register: regProfile,
    handleSubmit: handleProfile,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: '', phone: '', dateOfBirth: '' },
  })

  // Điền dữ liệu khi profile load xong
  useEffect(() => {
    if (profile) {
      resetProfile({
        fullName: profile.fullName ?? '',
        phone: profile.phone ?? '',
        dateOfBirth: profile.dateOfBirth ?? '',
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
      dateOfBirth: data.dateOfBirth || undefined,
    })
  }

  async function onChangePassword(data: PasswordForm) {
    await changePassword.mutateAsync(data)
    resetPwd()
  }

  if (isLoading) return <Loading />

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#181309] flex items-center justify-center">
        <p className="text-red-400">Không thể tải thông tin tài khoản.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#181309] text-white py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">

        <h1 className="text-2xl font-bold text-[#ffc107]">Tài khoản của tôi</h1>

        {/* Email verification banner — chỉ hiện khi chưa verify */}
        {profile.emailVerified === false && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3">
            <div className="text-orange-400 mt-0.5">⚠️</div>
            <div className="flex-1">
              <p className="text-orange-300 font-medium">Email chưa được xác thực</p>
              <p className="text-orange-200/70 text-sm mt-1">
                Vui lòng kiểm tra email <span className="font-mono">{profile.email}</span> và bấm vào liên kết xác thực.
                Một số tính năng có thể bị hạn chế cho đến khi xác thực.
              </p>
            </div>
          </div>
        )}

        {/* Thông tin tổng quan */}
        <Card className="bg-[#201b11] border-white/5 text-white rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {/* Avatar — overlay loading khi upload để user biết đang xử lý
                  + tránh click lặp lại lúc đang chờ. */}
              <div className="relative group w-16 h-16 flex-shrink-0">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#ffc107] flex items-center justify-center text-2xl font-bold text-black">
                    {(profile.fullName ?? profile.username).charAt(0).toUpperCase()}
                  </div>
                )}
                {uploadAvatar.isPending ? (
                  // Đang upload → overlay đặc + spinner; KHÔNG cho click thêm.
                  <div className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center">
                    <Loader2 size={20} className="text-[#ffc107] animate-spin" />
                  </div>
                ) : (
                  <label className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera size={20} className="text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadAvatar.isPending}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadAvatar.mutate(file)
                        // Reset input để cho phép upload lại cùng file (sau khi
                        // delete) — browser cache value=last selected nếu không reset.
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
              </div>
              <div>
                <p className="font-semibold text-lg">{profile.fullName ?? profile.username}</p>
                <p className="text-sm text-gray-400">{profile.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="warning" className="text-xs">{profile.role}</Badge>
                  {profile.enabled && (
                    <Badge variant="success" className="text-xs">Đang hoạt động</Badge>
                  )}
                  {profile.emailVerified ? (
                    <Badge variant="success" className="text-xs">Email đã xác thực</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">Email chưa xác thực</Badge>
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
        <Card className="bg-[#201b11] border-white/5 text-white rounded-2xl">
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
                  className="mt-1.5 bg-[#2a2317] border-white/10 text-white placeholder:text-gray-500"
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
                  className="mt-1.5 bg-[#2a2317] border-white/10 text-white placeholder:text-gray-500"
                  {...regProfile('phone')}
                />
                {profileErrors.phone && (
                  <p className="text-red-400 text-xs mt-1">{profileErrors.phone.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="dateOfBirth" className="text-gray-300">
                  Ngày sinh <span className="text-gray-500 font-normal">(tuỳ chọn)</span>
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  className="mt-1.5 bg-[#2a2317] border-white/10 text-white"
                  {...regProfile('dateOfBirth')}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Khai báo ngày sinh giúp tự động xác minh độ tuổi khi đặt phim T13/T16/T18 — không phải tick xác nhận mỗi lần.
                </p>
                {profileErrors.dateOfBirth && (
                  <p className="text-red-400 text-xs mt-1">{profileErrors.dateOfBirth.message}</p>
                )}
              </div>

              <Button
                type="submit"
                loading={updateProfile.isPending}
                className="w-full bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
              >
                Lưu thay đổi
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Form đổi mật khẩu */}
        <Card className="bg-[#201b11] border-white/5 text-white rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg text-gray-100">Đổi mật khẩu</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePwd(onChangePassword)} className="space-y-4">
              <div>
                <Label htmlFor="oldPassword" className="text-gray-300">Mật khẩu hiện tại <span className="text-red-400">*</span></Label>
                <div className="mt-1.5">
                  <PasswordInput id="oldPassword" placeholder="••••••" {...regPwd('oldPassword')} />
                </div>
                {pwdErrors.oldPassword && (
                  <p className="text-red-400 text-xs mt-1">{pwdErrors.oldPassword.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="newPassword" className="text-gray-300">Mật khẩu mới <span className="text-red-400">*</span></Label>
                <div className="mt-1.5">
                  <PasswordInput id="newPassword" placeholder="••••••" {...regPwd('newPassword')} />
                </div>
                {pwdErrors.newPassword && (
                  <p className="text-red-400 text-xs mt-1">{pwdErrors.newPassword.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-gray-300">Xác nhận mật khẩu mới <span className="text-red-400">*</span></Label>
                <div className="mt-1.5">
                  <PasswordInput id="confirmPassword" placeholder="••••••" {...regPwd('confirmPassword')} />
                </div>
                {pwdErrors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1">{pwdErrors.confirmPassword.message}</p>
                )}
              </div>

              <Button
                type="submit"
                loading={changePassword.isPending}
                variant="outline"
                className="w-full border-gray-600 text-gray-200 hover:bg-[#2a2317] font-semibold rounded-lg"
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
