import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
// [DEMO ĐỒ ÁN] Uncomment để bật lại các tab/menu đã ẩn (đi kèm block dưới):
// import { Link } from 'react-router-dom'
import {
  Film, Tags, DoorOpen, Clock, Users,
  Menu, X, ChevronLeft, LogOut, Clapperboard,
  Shield, Building2,
  type LucideIcon,
} from 'lucide-react'
// [DEMO ĐỒ ÁN] Uncomment để bật lại các tab/menu đã ẩn:
// import {
//   LayoutDashboard, Ticket, ScanLine, Coffee, TicketPercent,
//   Settings, Receipt, CreditCard, MessageSquare, Percent, Package,
//   Home, User, Heart,
// } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useLogout } from '@/hooks/useAuth'
import AdminTheaterSelector from '@/components/admin/AdminTheaterSelector'

/**
 * AdminLayout — khung chính cho admin panel.
 *
 * Theme: Dark Brown (#181309) + Warm Gold (#ffc107) — TÁCH BIỆT khỏi public site
 * (public dùng Dark Blue #051424). Mục đích: ấm hơn, đỡ chói khi admin nhìn dashboard
 * suốt cả ngày.
 *
 * Tokens dùng ở file này:
 *  - Sidebar:  bg-[#120e05]  (đậm nhất, viền trái màn hình)
 *  - Topbar:   bg-[#201b11]  (Card surface)
 *  - Main:     bg-[#181309]  (Page background)
 *  - Input:    bg-[#2a2317]  (input/dropdown nested surface)
 *  - Accent:   #ffc107 (gold), hover #e6ac06
 */

/**
 * Sidebar menu cấu hình.
 * - `superAdminOnly = true`: chỉ SUPER_ADMIN thấy (vd Chi nhánh, Người dùng, Quy tắc giá, Cấu hình hệ thống).
 *   Branch ADMIN bị ẩn → không click vào page (server-side cũng chặn qua @PreAuthorize).
 *
 * [DEMO ĐỒ ÁN] Giai đoạn báo cáo: chỉ giữ 6 tab core
 * (Thể loại, Phim, Chi nhánh, Phòng chiếu, Suất chiếu, Người dùng).
 * Các tab khác đã comment lại — uncomment khi tính năng sẵn sàng (nhớ uncomment cả import ở đầu file).
 */
const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; exact?: boolean; superAdminOnly?: boolean }[] = [
  // { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, exact: true },
  { to: '/admin/genres', label: 'Thể loại', icon: Tags },
  { to: '/admin/movies', label: 'Phim', icon: Film },
  { to: '/admin/theaters', label: 'Chi nhánh', icon: Building2, superAdminOnly: true },
  { to: '/admin/rooms', label: 'Phòng chiếu', icon: DoorOpen },
  { to: '/admin/showtimes', label: 'Suất chiếu', icon: Clock },
  // { to: '/admin/bookings', label: 'Đặt vé', icon: Ticket },
  // { to: '/admin/payments', label: 'Giao dịch', icon: CreditCard },
  // { to: '/admin/snacks', label: 'Đồ ăn', icon: Coffee },
  // { to: '/admin/combos', label: 'Combo', icon: Package },
  // { to: '/admin/vouchers', label: 'Khuyến mãi', icon: TicketPercent },
  { to: '/admin/users', label: 'Người dùng', icon: Users, superAdminOnly: true },
  // { to: '/admin/reviews', label: 'Đánh giá', icon: MessageSquare },
  // { to: '/admin/pos', label: 'POS Đồ ăn', icon: Receipt },
  // { to: '/admin/ticket-pos', label: 'POS Bán vé', icon: Clapperboard },
  // { to: '/admin/check-in', label: 'Quét vé', icon: ScanLine },
  // { to: '/admin/pricing', label: 'Quy tắc giá', icon: Percent, superAdminOnly: true },
  // { to: '/admin/configs', label: 'Cấu hình', icon: Settings, superAdminOnly: true },
]

function getBreadcrumbs(pathname: string): { label: string; to?: string }[] {
  const crumbs: { label: string; to?: string }[] = [{ label: 'Bảng điều khiển', to: '/admin' }]

  const parent = NAV_ITEMS.find((n) =>
    n.exact ? pathname === n.to : pathname.startsWith(n.to)
  )
  if (!parent) return crumbs

  // Sub-page check (VD: /admin/rooms/1/seats)
  const isSubPage = pathname !== parent.to && pathname.startsWith(parent.to + '/')
  if (isSubPage) {
    crumbs.push({ label: parent.label, to: parent.to })
    // Tên sub-page
    if (pathname.includes('/seats')) crumbs.push({ label: 'Sơ đồ ghế' })
    else crumbs.push({ label: 'Chi tiết' })
  } else {
    crumbs.push({ label: parent.label })
  }

  return crumbs
}

function getAvatarLetter(username?: string) {
  return username ? username.charAt(0).toUpperCase() : 'A'
}

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [headerDropdown, setHeaderDropdown] = useState(false)
  const headerDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (headerDropdownRef.current && !headerDropdownRef.current.contains(e.target as Node)) {
        setHeaderDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])
  const location = useLocation()
  const { user, isSuperAdmin } = useAuthStore()
  const logout = useLogout()
  const breadcrumbs = getBreadcrumbs(location.pathname)

  // Sidebar mở rộng cố định 280px (theo design spec mới);
  // collapsed mode vẫn giữ để toggle gọn icon-only.
  const sidebarWidth = collapsed ? 'w-16' : 'w-[280px]'

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo area */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/5">
        <NavLink to="/admin" className={`flex items-center gap-2.5 hover:opacity-80 transition-opacity ${collapsed && !isMobile ? 'justify-center w-full' : ''}`}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#ffc107]/20 shrink-0">
            <Clapperboard size={16} className="text-[#ffc107]" />
          </div>
          {(!collapsed || isMobile) && (
            <div className="leading-tight">
              <span className="text-[#ffc107] font-bold text-base tracking-wide block">CineX</span>
              <span className="text-white/30 text-[10px] font-medium tracking-widest uppercase">Admin Panel</span>
            </div>
          )}
        </NavLink>
        {!isMobile && (
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-white/30 hover:text-white/70 p-1 rounded-lg hover:bg-white/5 transition-colors hidden md:flex items-center justify-center shrink-0"
          >
            <ChevronLeft
              size={16}
              className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
            />
          </button>
        )}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="text-white/30 hover:text-white/70 p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav label */}
      {(!collapsed || isMobile) && (
        <div className="px-4 pt-5 pb-2">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-white/25">
            Điều hướng
          </span>
        </div>
      )}

      {/* Nav items — filter theo role: branch ADMIN không thấy menu superAdminOnly */}
      <nav className="flex-1 py-2 space-y-0.5 px-3 overflow-y-auto">
        {NAV_ITEMS.filter((n) => !n.superAdminOnly || isSuperAdmin()).map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative group ${collapsed && !isMobile ? 'justify-center' : ''
              } ${isActive
                ? 'bg-[#ffc107]/10 text-[#ffc107] border-l-2 border-[#ffc107]'
                : 'text-gray-300 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
              }`
            }
          >
            <Icon size={17} className="shrink-0" />
            {(!collapsed || isMobile) && <span>{label}</span>}
            {/* Tooltip khi collapsed */}
            {collapsed && !isMobile && (
              <div className="absolute left-full ml-3 px-2 py-1 bg-[#201b11] border border-white/10 rounded-lg text-xs text-white/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                {label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: user info card + actions */}
      <div className="border-t border-white/5 px-3 py-4 space-y-1">

        {/* User info card */}
        {(!collapsed || isMobile) && (
          <div className="mt-3 mx-0 px-3 py-3 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ffc107]/60 to-[#ffc107]/30 flex items-center justify-center shrink-0">
                  <span className="text-[#ffc107] text-sm font-bold">
                    {getAvatarLetter(user?.username)}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-xs font-semibold truncate">{user?.username ?? 'Admin'}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Shield size={9} className="text-[#ffc107]/70" />
                  <span className="text-[#ffc107]/70 text-[10px] font-medium">Quản trị viên</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Avatar khi collapsed */}
        {collapsed && !isMobile && (
          <div className="flex justify-center pt-2">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ffc107]/60 to-[#ffc107]/30 flex items-center justify-center">
                <span className="text-[#ffc107] text-sm font-bold">
                  {getAvatarLetter(user?.username)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#181309] text-white overflow-hidden">
      {/* Desktop sidebar — width fixed 280px theo design spec Admin */}
      <aside
        className={`hidden md:flex flex-col ${sidebarWidth} bg-[#120e05] border-r border-white/5 transition-all duration-200 shrink-0`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 w-[280px] bg-[#120e05] border-r border-white/5 transition-transform duration-200 md:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <SidebarContent isMobile />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — Card surface (#201b11) để tách layer với main #181309 */}
        <header className="flex items-center gap-4 px-6 py-4 bg-[#201b11] border-b border-white/5 shrink-0">
          {/* Mobile menu button */}
          <button
            className="md:hidden text-gray-400 hover:text-white transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-white/15">/</span>}
                {crumb.to ? (
                  <NavLink to={crumb.to} className="text-gray-400 hover:text-white transition-colors">
                    {crumb.label}
                  </NavLink>
                ) : (
                  <span className="text-white font-semibold">{crumb.label}</span>
                )}
              </span>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Theater context selector — admin filter view theo chi nhánh */}
          <AdminTheaterSelector />

          {/* User avatar + dropdown */}
          <div className="relative" ref={headerDropdownRef}>
            <button
              onClick={() => setHeaderDropdown(!headerDropdown)}
              className="flex items-center gap-2.5 text-gray-300 hover:text-white transition-colors"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ffc107] to-[#e6ac06] flex items-center justify-center text-black text-xs font-bold">
                  {getAvatarLetter(user?.username)}
                </div>
              )}
              <span className="text-sm hidden sm:block">{user?.username}</span>
            </button>

            {headerDropdown && (
              <div className="absolute right-0 mt-3 w-52 bg-[#201b11] border border-white/10 rounded-2xl shadow-2xl shadow-black/40 py-2 z-50">
                <div className="px-4 py-2.5 border-b border-white/5">
                  <p className="text-sm font-medium text-white">{user?.username}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Quản trị viên</p>
                </div>
                {/* [DEMO ĐỒ ÁN] Uncomment block dưới để bật lại Trang chủ / Hồ sơ / Vé của tôi / Phim yêu thích
                    (đồng thời uncomment import Link + Home/User/Ticket/Heart ở đầu file).
                <div className="py-1">
                  <Link to="/"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    onClick={() => setHeaderDropdown(false)}>
                    <Home size={16} className="text-gray-400" /> Trang chủ
                  </Link>
                  <Link to="/profile"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    onClick={() => setHeaderDropdown(false)}>
                    <User size={16} className="text-gray-400" /> Hồ sơ
                  </Link>
                  <Link to="/my-tickets"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    onClick={() => setHeaderDropdown(false)}>
                    <Ticket size={16} className="text-gray-400" /> Vé của tôi
                  </Link>
                  <Link to="/favorites"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    onClick={() => setHeaderDropdown(false)}>
                    <Heart size={16} className="text-gray-400" /> Phim yêu thích
                  </Link>
                </div>
                <hr className="border-white/5 my-1" />
                */}
                <button
                  onClick={() => { setHeaderDropdown(false); logout() }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/5 transition-colors"
                >
                  <LogOut size={16} /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content — padding 32px (p-8) theo design spec */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#181309]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
