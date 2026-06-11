import { useEffect, useRef, useState } from 'react'
import { Building2, ChevronDown, Globe2, Lock } from 'lucide-react'

import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import { useTheaterOptions } from '@/hooks/useAdminTheaters'
import { useAuthStore } from '@/store/authStore'

/**
 * Theater context indicator/selector ở admin topbar.
 *
 * <p><b>Render conditional theo role:</b>
 * <ul>
 *   <li><b>SUPER_ADMIN</b>: dropdown đầy đủ, có "Tất cả chi nhánh" + chọn từng theater
 *       → xem cross-branch report.</li>
 *   <li><b>Branch ADMIN</b>: badge READ-ONLY hiển thị chi nhánh được assign.
 *       KHÔNG cho đổi (server-side cũng enforce qua JWT claim).</li>
 *   <li><b>USER / guest</b>: null.</li>
 * </ul>
 */
export default function AdminTheaterSelector() {
  const { currentTheater, setCurrentTheater } = useAdminTheaterStore()
  const { data: theaters = [] } = useTheaterOptions()
  const { user, isSuperAdmin, isBranchAdmin } = useAuthStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Branch ADMIN: hiển thị badge read-only chi nhánh được assign
  if (isBranchAdmin()) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#3f382d] bg-[#2a2317] text-gray-200 text-sm"
           title="Chi nhánh được gán cố định cho tài khoản này">
        <Building2 size={14} className="text-[#ffc107]" />
        <span className="max-w-[220px] truncate">{user?.theaterName ?? 'Đang tải...'}</span>
        <Lock size={12} className="text-gray-500" />
      </div>
    )
  }

  // Không phải SUPER_ADMIN → ẩn (USER không vào admin layout thường, nhưng defensive)
  if (!isSuperAdmin()) {
    return null
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const displayLabel = currentTheater ? currentTheater.name : 'Tất cả chi nhánh'
  const Icon = currentTheater ? Building2 : Globe2

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#3f382d] bg-[#2a2317] hover:border-[#ffc107]/50 text-gray-200 text-sm transition-colors"
        title="Đổi chi nhánh"
        aria-label={`Đang xem: ${displayLabel}. Bấm để đổi chi nhánh.`}
        aria-expanded={open}
      >
        <Icon size={14} className="text-[#ffc107]" />
        <span className="max-w-[200px] truncate">{displayLabel}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-[#201b11] border border-[#3f382d] rounded-2xl shadow-2xl shadow-black/40 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-2 border-b border-[#3f382d]">
            <p className="text-xs text-gray-500">Filter view theo chi nhánh</p>
          </div>

          {/* Option "Tất cả chi nhánh" — admin tổng */}
          <button
            onClick={() => {
              setCurrentTheater(null)
              setOpen(false)
            }}
            className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
              !currentTheater
                ? 'bg-[#ffc107]/10 text-[#ffc107]'
                : 'text-gray-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Globe2 size={16} className={!currentTheater ? 'text-[#ffc107]' : 'text-gray-400'} />
            <div className="flex-1 min-w-0">
              <div className="font-medium">Tất cả chi nhánh</div>
              <div className="text-xs text-gray-500 mt-0.5">Hiển thị cross-branch report</div>
            </div>
          </button>

          <div className="my-1 border-t border-[#3f382d]" />

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
