import { useEffect, useRef, useState } from 'react'
import { Building2, ChevronDown } from 'lucide-react'

import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import { useTheaterOptions } from '@/hooks/useAdminTheaters'
import { useAuthStore } from '@/store/authStore'

/**
 * Theater context selector ở admin topbar — chỉ render cho SUPER_ADMIN.
 *
 * <p><b>Industry standard (Vista Veezi / Cinetixx / CGV admin):</b>
 * <ul>
 *   <li><b>SUPER_ADMIN</b>: dropdown chọn 1 trong các CN; auto-pick CN đầu tiên
 *       khi login lần đầu. Đây là vai trò duy nhất CẦN switch context.</li>
 *   <li><b>BRANCH_ADMIN</b>: ẨN selector. Account đã gắn cố định 1 CN, badge
 *       trên topbar chỉ là noise (BE auto-scope mọi query/mutation theo JWT).</li>
 *   <li><b>USER / guest</b>: null.</li>
 * </ul>
 *
 * <p><b>Bảo vệ BE (defense in depth):</b> dù FE có ẩn / hiện / FE cố tình
 * gửi theaterId khác, {@code SecurityService} ở mọi list endpoint OVERRIDE
 * filter.theaterId thành theater của user; mọi mutation gọi
 * {@code requireAccessToTheater()} throw FORBIDDEN nếu khác CN.
 */
export default function AdminTheaterSelector() {
  const { currentTheater, setCurrentTheater } = useAdminTheaterStore()
  const { data: theaters = [] } = useTheaterOptions()
  const { isSuperAdmin } = useAuthStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Chỉ SUPER_ADMIN cần theater selector. BRANCH_ADMIN + USER + guest: ẩn.
  if (!isSuperAdmin()) {
    return null
  }

  // Auto-pick chi nhánh đầu tiên khi SUPER_ADMIN chưa có context
  // (login lần đầu hoặc xoá localStorage). Đảm bảo luôn có 1 CN active —
  // operational pages không phải xử lý case null.
  useEffect(() => {
    if (!currentTheater && theaters.length > 0) {
      const first = theaters[0]
      setCurrentTheater({ id: first.id, code: first.code, name: first.name, city: first.city })
    }
  }, [currentTheater, theaters, setCurrentTheater])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const displayLabel = currentTheater?.name ?? 'Đang tải...'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#3f382d] bg-[#2a2317] hover:border-[#ffc107]/50 text-gray-200 text-sm transition-colors"
        title="Đổi chi nhánh"
        aria-label={`Đang xem: ${displayLabel}. Bấm để đổi chi nhánh.`}
        aria-expanded={open}
      >
        <Building2 size={14} className="text-[#ffc107]" />
        <span className="max-w-[200px] truncate">{displayLabel}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-[#201b11] border border-[#3f382d] rounded-2xl shadow-2xl shadow-black/40 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-2 border-b border-[#3f382d]">
            <p className="text-xs text-gray-500">Chuyển chi nhánh</p>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {theaters.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">Chưa có chi nhánh nào</div>
            ) : (
              theaters.map((t) => {
                const isActive = t.id === currentTheater?.id
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setCurrentTheater({ id: t.id, code: t.code, name: t.name, city: t.city })
                      setOpen(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${
                      isActive
                        ? 'bg-[#ffc107]/10 text-[#ffc107]'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Building2 size={16} className={`mt-0.5 shrink-0 ${isActive ? 'text-[#ffc107]' : 'text-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{t.city}</div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
