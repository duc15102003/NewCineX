import { useEffect, useRef, useState } from 'react'
import { MapPin, ChevronDown, Building2 } from 'lucide-react'

import { useTheaterStore } from '@/store/theaterStore'
import { useTheaterOptions } from '@/hooks/useAdminTheaters'

/**
 * Badge chi nhánh ở header — click để mở dropdown chọn lại chi nhánh.
 *
 * <p>Pattern theo CGV mobile: hiển thị chi nhánh đang chọn, click để đổi.
 */
export default function TheaterSelector() {
  const { currentTheater, setCurrentTheater } = useTheaterStore()
  const { data: theaters = [] } = useTheaterOptions()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!currentTheater) return null // Modal first-time sẽ handle case này

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-gray-300 hover:text-[#ffc107] transition-colors text-sm group"
        title="Đổi chi nhánh"
        aria-label={`Chi nhánh hiện tại: ${currentTheater.name}. Bấm để đổi.`}
        aria-expanded={open}
      >
        <MapPin size={14} className="text-[#ffc107]" />
        <span className="hidden sm:inline max-w-[180px] truncate">{currentTheater.name}</span>
        <span className="sm:hidden">{currentTheater.city}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-72 bg-[#201b11] border border-[#3f382d] rounded-2xl shadow-2xl shadow-black/40 py-2 animate-in fade-in slide-in-from-top-2 duration-150 z-50">
          <div className="px-4 py-2.5 border-b border-[#3f382d]">
            <p className="text-xs text-gray-500">Chọn chi nhánh CineX</p>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {theaters.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">Chưa có chi nhánh nào</div>
            ) : (
              theaters.map((t) => {
                const isActive = t.id === currentTheater.id
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setCurrentTheater({ id: t.id, code: t.code, name: t.name, city: t.city })
                      setOpen(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 transition-colors flex items-start gap-3 ${
                      isActive
                        ? 'bg-[#ffc107]/10 text-[#ffc107]'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Building2 size={16} className={`mt-0.5 shrink-0 ${isActive ? 'text-[#ffc107]' : 'text-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{t.address}</div>
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
