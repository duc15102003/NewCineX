import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, User, LogOut, Ticket, Heart, LayoutDashboard, Film } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useLogout } from '@/hooks/useAuth'
import NotificationBell from '@/components/common/NotificationBell'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { user, isLoggedIn, isAdmin } = useAuthStore()
  const logout = useLogout()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const avatarLetter = user?.username?.charAt(0).toUpperCase() ?? 'U'

  return (
    <header className="sticky top-0 z-50 bg-[#051424]/95 backdrop-blur border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <Film size={24} className="text-[#eab308]" />
            <span className="text-2xl font-bold text-[#eab308]">CineX</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {/* <Link to="/" className="text-gray-300 hover:text-[#eab308] transition-colors">
              Trang chủ
            </Link> */}{/* Trang chủ user */}
            {/* <Link to="/movies" className="text-gray-300 hover:text-[#eab308] transition-colors">
              Phim
            </Link> */}{/* Danh sách phim user — Đạt */}

            {isLoggedIn() ? (
              <>
              <NotificationBell />
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2.5 text-gray-300 hover:text-white transition-colors"
                >
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#eab308] to-[#ca8a04] flex items-center justify-center text-black text-xs font-bold">
                      {avatarLetter}
                    </div>
                  )}
                  <span className="text-sm">{user?.username}</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-3 w-52 bg-[#0d1c2d] border border-white/10 rounded-xl shadow-2xl shadow-black/40 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* User info */}
                    <div className="px-4 py-2.5 border-b border-white/5">
                      <p className="text-sm font-medium text-white">{user?.username}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Thành viên CineX</p>
                    </div>

                    <div className="py-1">
                      <Link
                        to="/profile"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <User size={16} className="text-gray-400" /> Hồ sơ
                      </Link>
                      <Link
                        to="/my-tickets"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <Ticket size={16} className="text-gray-400" /> Vé của tôi
                      </Link>
                      <Link
                        to="/favorites"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <Heart size={16} className="text-gray-400" /> Phim yêu thích
                      </Link>
                    </div>

                    {isAdmin() && (
                      <>
                        <hr className="border-white/5 my-1" />
                        <Link
                          to="/admin"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#eab308] hover:bg-[#eab308]/5 transition-colors"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <LayoutDashboard size={16} /> Quản trị
                        </Link>
                      </>
                    )}

                    <hr className="border-white/5 my-1" />
                    <button
                      onClick={() => { setDropdownOpen(false); logout() }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/5 transition-colors"
                    >
                      <LogOut size={16} /> Đăng xuất
                    </button>
                  </div>
                )}
              </div>
              </>
            ) : (
              <div className="flex gap-3">
                <Link
                  to="/login"
                  className="border border-[#eab308] text-[#eab308] hover:bg-[#eab308]/10 font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-gray-300"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#0a1929] border-t border-white/5 px-4 py-4 space-y-1">
          {/* <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-white/5 hover:text-[#eab308]" onClick={() => setMenuOpen(false)}>
            Trang chủ
          </Link> */}{/* Trang chủ user */}
          {/* <Link to="/movies" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-white/5 hover:text-[#eab308]" onClick={() => setMenuOpen(false)}>
            Phim
          </Link> */}{/* Danh sách phim user — Đạt */}

          {isLoggedIn() ? (
            <>
              <hr className="border-white/5 my-2" />
              <div className="flex items-center gap-3 px-3 py-2">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#eab308] to-[#ca8a04] flex items-center justify-center text-black text-xs font-bold">
                    {avatarLetter}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-white">{user?.username}</p>
                  <p className="text-xs text-gray-500">Thành viên CineX</p>
                </div>
              </div>
              <Link to="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-white/5" onClick={() => setMenuOpen(false)}>
                <User size={16} className="text-gray-400" /> Hồ sơ
              </Link>
              <Link to="/my-tickets" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-white/5" onClick={() => setMenuOpen(false)}>
                <Ticket size={16} className="text-gray-400" /> Vé của tôi
              </Link>
              <Link to="/favorites" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-white/5" onClick={() => setMenuOpen(false)}>
                <Heart size={16} className="text-gray-400" /> Phim yêu thích
              </Link>
              {isAdmin() && (
                <Link to="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#eab308] hover:bg-[#eab308]/5" onClick={() => setMenuOpen(false)}>
                  <LayoutDashboard size={16} /> Quản trị
                </Link>
              )}
              <hr className="border-white/5 my-2" />
              <button onClick={() => { setMenuOpen(false); logout() }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-400/5 w-full">
                <LogOut size={16} /> Đăng xuất
              </button>
            </>
          ) : (
            <>
              <hr className="border-white/5 my-2" />
              <div className="flex gap-3 px-3">
                <Link to="/login" className="flex-1 text-center border border-[#eab308] text-[#eab308] hover:bg-[#eab308]/10 font-medium py-2 rounded-lg transition-colors" onClick={() => setMenuOpen(false)}>
                  Đăng nhập
                </Link>
                <Link to="/register" className="flex-1 text-center bg-[#eab308] hover:bg-[#ca8a04] text-black font-medium py-2 rounded-lg transition-colors" onClick={() => setMenuOpen(false)}>
                  Đăng ký
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  )
}
