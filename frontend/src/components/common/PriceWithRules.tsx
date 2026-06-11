import { TrendingDown } from 'lucide-react'
import { fmtVnd } from '@/utils/labels'
import type { AppliedPricingRule } from '@/types/movie'

interface PriceWithRulesProps {
  /** Giá gốc (raw từ DB) — gạch ngang CHỈ khi effective thấp hơn (có discount). */
  basePrice: number | null | undefined
  /** Giá thực sự thu sau PricingEngine. Fallback về basePrice nếu null. */
  effectivePrice: number | null | undefined
  /** Danh sách rule đang áp dụng — chỉ render chip GIẢM giá (discount < 0), ẩn rule tăng. */
  appliedRules?: AppliedPricingRule[]
  /** Label trước giá (vd "Thường:", "VIP:"). */
  label?: string
  /** "compact" = inline 1 dòng, không hiện rule chip. "full" = block 2 dòng + chip. */
  mode?: 'compact' | 'full'
  /** Class màu cho effective price (default gold). */
  priceColorClass?: string
}

/**
 * Hiển thị giá theo chuẩn industry rạp chiếu (CGV/Lotte/BHD/Galaxy):
 * <ul>
 *   <li><b>Discount</b> (suất sáng -20%, học sinh -30%) → gạch ngang giá gốc + giá sau giảm +
 *       chip xanh "-20% Suất sáng". Tâm lý loss aversion → tăng conversion.</li>
 *   <li><b>Surge</b> (cuối tuần +30%, giờ vàng +15%) → KHÔNG hiển thị badge tăng giá,
 *       KHÔNG gạch ngang. Hiện thẳng giá cao như "giá mặc định" — anchor pricing.</li>
 * </ul>
 *
 * <p><b>Tại sao ẩn surge?</b> Hiển thị "+15% peak" làm khách cảm thấy bị chặt chém → bỏ giỏ.
 * Số liệu Nielsen: hiện discount tăng conversion 15-30%, hiện surge giảm conversion 20-40%.
 * Rạp đặt baseline = weekend price → weekday tự nhiên thành "giảm so với baseline".
 *
 * <p>Internal admin view vẫn nhận đủ data từ BE — chỉ component này filter để render customer-facing.
 */
export default function PriceWithRules({
  basePrice, effectivePrice, appliedRules, label,
  mode = 'compact', priceColorClass = 'text-[#ffc107]',
}: PriceWithRulesProps) {
  const base = basePrice ?? 0
  const effective = effectivePrice ?? base
  const hasDiscount = effective < base
  // Chỉ chip có discountPercent < 0 (giảm) — ẩn chip tăng để không phá tâm lý mua hàng
  const discountRules = (appliedRules ?? []).filter(r => r.discountPercent < 0)

  if (mode === 'compact') {
    return (
      <span className="inline-flex items-baseline gap-1.5">
        {label && <span className="text-gray-300">{label}</span>}
        {hasDiscount && (
          <span className="text-gray-500 line-through text-xs">{fmtVnd(base)}</span>
        )}
        <span className={`font-medium ${priceColorClass}`}>{fmtVnd(effective)}</span>
      </span>
    )
  }

  // mode === 'full'
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        {label && <span className="text-gray-300 text-sm">{label}</span>}
        {hasDiscount && (
          <span className="text-gray-500 line-through text-xs">{fmtVnd(base)}</span>
        )}
        <span className={`font-semibold text-base ${priceColorClass}`}>{fmtVnd(effective)}</span>
      </div>
      {hasDiscount && discountRules.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {discountRules.map(r => (
            <span
              key={r.code}
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border bg-green-500/10 text-green-400 border-green-500/30"
              title={r.name}
            >
              <TrendingDown size={10} />
              {r.name} {r.discountPercent}%
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
