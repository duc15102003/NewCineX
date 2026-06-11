import { Building2, ArrowUp } from 'lucide-react'

/**
 * Empty state hiển thị khi POS không có theater context cụ thể.
 *
 * <p><b>Chuẩn industry (Vista FilmAtSite / Veezi / Compeso):</b> POS bắt buộc bind
 * 1 site/theater duy nhất — cashier vật lý đứng 1 quầy của 1 rạp, doanh thu, ca trực,
 * két tiền, thuế phải attribute immutable per-site. Không có concept "All sites" trong POS.
 *
 * <p>BRANCH_ADMIN không bao giờ thấy state này vì JWT auto-scope theo theater.
 * SUPER_ADMIN chọn "Tất cả chi nhánh" ở header → POS chặn lại, yêu cầu chọn 1 CN cụ thể.
 */
export default function POSTheaterRequired({ mode }: { mode: 'TICKET' | 'SNACK' }) {
  const label = mode === 'TICKET' ? 'bán vé' : 'bán đồ ăn'
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-[#201b11] border border-[#3f382d] rounded-2xl p-8">
      <div className="relative mb-6">
        <Building2 size={64} className="text-[#ffc107]/40" />
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 text-xs font-bold">
          !
        </div>
      </div>
      <h2 className="text-xl font-bold text-amber-50 mb-2 text-center">
        Chọn chi nhánh để vào POS {label}
      </h2>
      <p className="text-gray-400 text-sm text-center max-w-md mb-6 leading-relaxed">
        POS bắt buộc gắn với một chi nhánh cụ thể — toàn bộ giao dịch, doanh thu, két tiền sẽ
        được ghi vào chi nhánh đang chọn. Vui lòng chọn chi nhánh ở thanh trên cùng để bắt đầu.
      </p>
      <div className="flex items-center gap-2 text-[#ffc107] text-sm">
        <ArrowUp size={16} className="animate-bounce" />
        <span>Dropdown chi nhánh ở góc trên bên phải</span>
      </div>
    </div>
  )
}
