import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function HomePage() {
  const { user, isLoggedIn } = useAuthStore()

  return (
    <div className="min-h-screen bg-[#051424] text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[#eab308] mb-4">CineX</h1>
        <p className="text-gray-400 mb-8">Hệ thống đặt vé xem phim online</p>
        {isLoggedIn() ? (
          <div className="space-y-3">
            <p className="text-gray-300">Xin chào, <span className="text-[#eab308] font-semibold">{user?.username}</span></p>
            {user?.role === 'ADMIN' && (
              <Link to="/admin/movies" className="inline-block bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold px-6 py-2.5 rounded-xl transition-colors">
                Vào quản trị
              </Link>
            )}
          </div>
        ) : (
          <div className="flex gap-3 justify-center">
            <Link to="/login" className="border border-[#eab308] text-[#eab308] hover:bg-[#eab308]/10 px-6 py-2.5 rounded-xl font-semibold transition-colors">
              Đăng nhập
            </Link>
            <Link to="/register" className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold px-6 py-2.5 rounded-xl transition-colors">
              Đăng ký
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
