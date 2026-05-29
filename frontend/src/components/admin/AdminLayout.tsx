import { useState } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { Film, Tags, DoorOpen, Clock, Users, LogOut, Home, Menu, X, ChevronLeft } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useLogout } from '@/hooks/useAuth'

const NAV_ITEMS = [
  { to: '/admin/movies', label: 'Phim', icon: Film },
  { to: '/admin/genres', label: 'Thể loại', icon: Tags },
  { to: '/admin/rooms', label: 'Phòng chiếu', icon: DoorOpen },
  { to: '/admin/showtimes', label: 'Suất chiếu', icon: Clock },
  { to: '/admin/users', label: 'Người dùng', icon: Users },
]

export default function AdminLayout() {
  const { user } = useAuthStore()
  const logout = useLogout()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebarWidth = collapsed ? 'w-16' : 'w-56'

  const navContent = (
    <nav className="flex-1 py-4 space-y-1 px-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? 'bg-[#eab308]/10 text-[#eab308]' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}>
          <Icon size={18} />
          {!collapsed && <span>{label}</span>}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="flex h-screen bg-[#051424] text-white overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col ${sidebarWidth} bg-[#0a1929] border-r border-white/5 transition-all duration-200 shrink-0`}>
        <div className="flex items-center justify-between px-4 py-5 border-b border-white/5">
          {!collapsed && <Link to="/" className="text-lg font-bold text-[#eab308]">CineX</Link>}
          <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-white">
            <ChevronLeft size={18} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {navContent}
        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#eab308]/20 flex items-center justify-center text-[#eab308] font-bold text-sm">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.username}</p>
                <p className="text-xs text-gray-500">{user?.role}</p>
              </div>
            )}
          </div>
          <button onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 mt-1 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={18} />
            {!collapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Mobile hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0a1929] border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold text-[#eab308]">CineX</Link>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-gray-400">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)}>
          <aside className="w-64 h-full bg-[#0a1929] border-r border-white/5 pt-16" onClick={e => e.stopPropagation()}>
            {navContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 md:pt-6 pt-16">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
