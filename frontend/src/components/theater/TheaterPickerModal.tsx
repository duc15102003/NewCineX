import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Building2, MapPin } from 'lucide-react'

import { useTheaterStore } from '@/store/theaterStore'
import { useTheaterOptions } from '@/hooks/useAdminTheaters'

/**
 * Các route KHÔNG cần theater context — modal không được hiện trên đây.
 * Auth pages: user cần đăng nhập trước, chưa cần biết chi nhánh.
 * Payment result: redirect từ cổng thanh toán, có thể mất session — không block.
 */
const ROUTES_WITHOUT_THEATER = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/payment/result',
]

/**
 * Modal first-time: hiện ra khi user chưa chọn chi nhánh.
 *
 * <p><b>Pattern theo CGV mobile:</b> bắt buộc chọn chi nhánh trước khi vào nội dung.
 * Không cho click backdrop hoặc ESC để dismiss — user phải chọn ít nhất 1 lần.
 *
 * <p>Render inline thay vì dùng component Dialog chung vì cần override behavior
 * (Dialog mặc định close khi click backdrop).
 *
 * <p>Component này render ở MainLayout — luôn check khi user-facing page mount.
 */
export default function TheaterPickerModal() {
  const { currentTheater } = useTheaterStore()
  const location = useLocation()

  // Skip modal nếu user đang ở auth/payment-result routes.
  // Render null TRƯỚC khi gọi useTheaterOptions → không gọi API trên các route này
  // (tránh 401 loop khi user chưa login mà API theater còn require auth).
  const skipOnThisRoute = ROUTES_WITHOUT_THEATER.some(p => location.pathname.startsWith(p))
  if (skipOnThisRoute || currentTheater) return null

  return <ModalContent />
}

/** Tách content ra subcomponent để hook useTheaterOptions chỉ chạy khi thực sự cần. */
function ModalContent() {
  const { setCurrentTheater } = useTheaterStore()
  const { data: theaters = [], isLoading } = useTheaterOptions()

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop — KHÔNG có onClick để tránh dismiss khi click ngoài */}
      <div className="fixed inset-0 bg-black/70" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="relative bg-[#201b11] rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-[#3f382d] text-white">
          <div className="p-6">
            <h2 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2 text-amber-50">
              <MapPin size={20} className="text-[#ffc107]" />
              Bạn ở chi nhánh nào?
            </h2>
            <p className="text-gray-400 text-sm mt-3">
              Chọn chi nhánh CineX gần bạn để xem lịch chiếu phù hợp. Bạn có thể đổi bất cứ lúc nào
              ở góc trên header.
            </p>
          </div>

          <div className="px-6 pb-6">
            {isLoading ? (
              <div className="text-center py-6 text-gray-500 text-sm">Đang tải danh sách chi nhánh...</div>
            ) : theaters.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">Hiện chưa có chi nhánh nào hoạt động</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {theaters.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setCurrentTheater({ id: t.id, code: t.code, name: t.name, city: t.city })}
                    className="w-full text-left p-4 rounded-xl border border-[#3f382d] bg-[#2a2317] hover:border-[#ffc107] hover:bg-[#ffc107]/5 transition-all flex items-start gap-3 group"
                  >
                    <Building2 size={20} className="text-[#ffc107] mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white group-hover:text-[#ffc107] transition-colors">{t.name}</div>
                      <div className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                        <MapPin size={11} />
                        <span className="truncate">{t.address}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
