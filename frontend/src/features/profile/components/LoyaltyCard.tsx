import { Award, Clock, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useMyLoyalty, type LoyaltyTier } from '@/hooks/useLoyalty'
import { fmtDate, LOYALTY_TIER_LABELS, label } from '@/utils/labels'

/**
 * Card hiển thị trạng thái loyalty của user — industry chuẩn CGV/Lotte app:
 * <ul>
 *   <li>Badge hạng hiện tại (Bạc/Vàng/Bạch Kim) + icon Award</li>
 *   <li>Số điểm khả dụng (loyaltyPoints)</li>
 *   <li>Progress bar lên hạng kế tiếp</li>
 *   <li>Warning vàng nếu có điểm sắp hết hạn 30 ngày tới</li>
 * </ul>
 *
 * <p>Skip render nếu user chưa có data hoặc API fail — không phá ProfilePage.
 */
export default function LoyaltyCard() {
  const { data: loyalty } = useMyLoyalty()

  if (!loyalty) return null

  const tierColor = TIER_COLORS[loyalty.tier]
  const progressPercent = computeProgressPercent(loyalty)

  return (
    <Card className="bg-[#201b11] border-white/5 text-white rounded-2xl">
      <CardContent className="pt-6 space-y-4">
        {/* Header: hạng + điểm */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Hạng thành viên</p>
            <div className="flex items-center gap-2">
              <Award size={20} className={tierColor.icon} />
              <span className={`text-xl font-bold ${tierColor.text}`}>
                {label(LOYALTY_TIER_LABELS, loyalty.tier)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Điểm khả dụng</p>
            <p className="text-2xl font-bold text-[#ffc107]">
              {loyalty.loyaltyPoints.toLocaleString('vi-VN')}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Tổng tích lũy: {loyalty.lifetimePoints.toLocaleString('vi-VN')}
            </p>
          </div>
        </div>

        {/* Progress bar lên hạng kế tiếp — ẩn nếu PLATINUM */}
        {loyalty.nextTier && loyalty.pointsToNextTier != null && loyalty.nextTierThreshold != null && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-400">
              <span className="inline-flex items-center gap-1">
                <TrendingUp size={12} /> Còn {loyalty.pointsToNextTier.toLocaleString('vi-VN')} điểm
                lên {label(LOYALTY_TIER_LABELS, loyalty.nextTier)}
              </span>
              <span>{loyalty.lifetimePoints.toLocaleString('vi-VN')} / {loyalty.nextTierThreshold.toLocaleString('vi-VN')}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#ffc107] transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Warning điểm sắp hết hạn 30 ngày — industry pattern CGV "X điểm hết hạn DD/MM" */}
        {loyalty.pointsExpiringIn30Days > 0 && loyalty.nearestExpiryDate && (
          <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
            <Clock size={14} className="text-orange-400 mt-0.5 shrink-0" />
            <div className="text-xs text-orange-200/90 leading-relaxed">
              <strong className="text-orange-300">
                {loyalty.pointsExpiringIn30Days.toLocaleString('vi-VN')} điểm sắp hết hạn
              </strong>
              {' '}— đợt sớm nhất hết hạn ngày <strong>{fmtDate(loyalty.nearestExpiryDate)}</strong>.
              Dùng điểm khi đặt vé để không bị mất.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Mapping tier → màu sắc UI — gold cho hạng cao, gray cho STANDARD. */
const TIER_COLORS: Record<LoyaltyTier, { text: string; icon: string }> = {
  STANDARD: { text: 'text-gray-300', icon: 'text-gray-400' },
  SILVER: { text: 'text-gray-100', icon: 'text-gray-300' },
  GOLD: { text: 'text-[#ffc107]', icon: 'text-[#ffc107]' },
  PLATINUM: { text: 'text-[#ffc107]', icon: 'text-[#ffc107]' },
}

/**
 * Tính % progress lên hạng kế tiếp. Cần biết lifetime hiện tại + threshold
 * hạng KẾ TIẾP + threshold hạng HIỆN TẠI (làm mốc 0%).
 *
 * <p>Ví dụ: SILVER lifetime=2.500, threshold GOLD=5.000, threshold SILVER=1.000
 *   → progress = (2.500 - 1.000) / (5.000 - 1.000) = 37.5%
 */
function computeProgressPercent(loyalty: { lifetimePoints: number; tier: LoyaltyTier; nextTierThreshold: number | null }): number {
  if (loyalty.nextTierThreshold == null) return 100
  // Threshold hạng hiện tại — từ tier ngược lại. Default 0 cho STANDARD.
  const currentThreshold: Record<LoyaltyTier, number> = {
    STANDARD: 0,
    SILVER: 1000,
    GOLD: 5000,
    PLATINUM: 20000,
  }
  const start = currentThreshold[loyalty.tier]
  const span = loyalty.nextTierThreshold - start
  if (span <= 0) return 100
  const progress = Math.max(0, Math.min(100, ((loyalty.lifetimePoints - start) / span) * 100))
  return progress
}
