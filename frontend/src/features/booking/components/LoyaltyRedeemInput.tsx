import { useState } from 'react'
import { Award, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useMyLoyalty } from '@/hooks/useLoyalty'
import { usePublicConfigNumber } from '@/hooks/useConfig'
import { fmtVnd } from '@/utils/labels'

export interface LoyaltyRedeemInputProps {
  /** Số điểm hiện đã apply (cha quản state). */
  redeemPoints: number
  onRedeemPointsChange: (points: number) => void
  /** Tổng tiền vé sau group discount (để cap số tiền giảm hiển thị). */
  maxDiscountCap: number
}

/**
 * Input đổi điểm tích lúc đặt vé — chuẩn industry CGV/Lotte app.
 *
 * <ul>
 *   <li>Hiện balance + tier user từ {@code useMyLoyalty}</li>
 *   <li>Đọc {@code loyalty.min_redeem_points} + {@code loyalty.redeem_value}
 *       từ public config để khớp validate BE</li>
 *   <li>Preview tiền giảm ngay khi nhập (FE cap theo maxDiscountCap)</li>
 *   <li>Nút Áp dụng/Hủy giống pattern voucher</li>
 * </ul>
 *
 * Ẩn hoàn toàn nếu user chưa login hoặc loyaltyPoints < minRedeem (không đủ
 * điểm tối thiểu).
 */
export default function LoyaltyRedeemInput({
  redeemPoints, onRedeemPointsChange, maxDiscountCap,
}: LoyaltyRedeemInputProps) {
  const { data: loyalty } = useMyLoyalty()
  const { data: minRedeem = 100 } = usePublicConfigNumber('loyalty.min_redeem_points', 100)
  const { data: redeemValue = 1000 } = usePublicConfigNumber('loyalty.redeem_value', 1000)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  if (!loyalty || loyalty.loyaltyPoints < minRedeem) return null

  // Số điểm CẦN tối đa cho đơn này — ceiling vì 1 điểm rời rạc.
  // Nhập > số này → hệ thống tự cap, khách không mất điểm thừa.
  const pointsNeeded = Math.ceil(Math.max(0, maxDiscountCap) / redeemValue)

  // Vé quá nhỏ — không đủ giá trị để đổi min_redeem điểm. Show explainer.
  if (pointsNeeded < minRedeem) {
    return (
      <div className="mb-4 rounded-lg border border-white/5 bg-[#2a2317]/40 px-3 py-2 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <Award size={12} className="text-gray-500" />
          Đơn này quá nhỏ để dùng điểm tích luỹ
          <span className="text-gray-600">(tối thiểu {minRedeem} điểm = {fmtVnd(minRedeem * redeemValue)})</span>
        </span>
      </div>
    )
  }

  // Đã apply — hiển thị badge với SỐ ĐIỂM THỰC TỪ (sau cap), không phải số nhập.
  if (redeemPoints > 0) {
    const actualPointsUsed = Math.min(redeemPoints, pointsNeeded)
    const discount = Math.min(actualPointsUsed * redeemValue, maxDiscountCap)
    const wasClamped = redeemPoints > actualPointsUsed
    return (
      <div className="mb-4 bg-[#ffc107]/10 border border-[#ffc107]/30 rounded-lg px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Award size={16} className="text-[#ffc107] shrink-0" />
            <span className="text-gray-200">
              Đã đổi <strong>{actualPointsUsed.toLocaleString('vi-VN')}</strong> điểm
              <span className="text-green-400"> (−{fmtVnd(discount)})</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => { onRedeemPointsChange(0); setDraft(''); setError('') }}
            className="text-gray-400 hover:text-white"
            title="Hủy đổi điểm"
          >
            <X size={14} />
          </button>
        </div>
        {wasClamped && (
          <p className="text-[11px] text-amber-300/80 mt-1 leading-relaxed">
            Bạn nhập {redeemPoints} điểm, hệ thống chỉ cần {actualPointsUsed} điểm để giảm hết. Phần dư {redeemPoints - actualPointsUsed} điểm vẫn còn trong tài khoản.
          </p>
        )}
      </div>
    )
  }

  function apply() {
    const num = Number(draft)
    if (!Number.isInteger(num) || num <= 0) {
      setError('Số điểm phải là số nguyên dương')
      return
    }
    if (num < minRedeem) {
      setError(`Đổi tối thiểu ${minRedeem} điểm`)
      return
    }
    if (loyalty && num > loyalty.loyaltyPoints) {
      setError(`Bạn chỉ có ${loyalty.loyaltyPoints.toLocaleString('vi-VN')} điểm`)
      return
    }
    setError('')
    onRedeemPointsChange(num)
  }

  const draftNum = Number(draft)
  const previewDiscount = draftNum > 0
    ? Math.min(draftNum * redeemValue, maxDiscountCap)
    : 0
  // Phân biệt 2 case lỗi/cảnh báo:
  // - exceedsBalance: nhập VƯỢT số điểm có → đỏ, không apply được
  // - willClamp: nhập trong khả năng NHƯNG dư so với cần → vàng, hệ thống tự cap
  const exceedsBalance = draftNum > loyalty.loyaltyPoints
  const willClamp = !exceedsBalance && draftNum > pointsNeeded
  // Gợi ý số điểm tối ưu — min(balance, pointsNeeded) — bấm 1 phát nhập sẵn
  const maxRedeemable = Math.min(loyalty.loyaltyPoints, pointsNeeded)

  return (
    <div className="mb-4 space-y-1.5">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <Award size={12} className="text-[#ffc107]" />
          Đổi điểm tích (có {loyalty.loyaltyPoints.toLocaleString('vi-VN')} điểm)
        </span>
        <span className="text-gray-500">1 điểm = {fmtVnd(redeemValue)}</span>
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          min={minRedeem}
          max={maxRedeemable}
          placeholder={`Tối thiểu ${minRedeem} điểm`}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError('') }}
          className="flex-1 h-9 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={apply}
          disabled={!draft || exceedsBalance}
          className="border-[#ffc107]/40 text-[#ffc107] hover:bg-[#ffc107]/10 hover:text-[#ffc107] h-9"
        >
          Áp dụng
        </Button>
      </div>
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span>
          Đơn này cần tối đa <span className="text-gray-300">{pointsNeeded.toLocaleString('vi-VN')} điểm</span> để giảm hết
          {maxRedeemable >= minRedeem && (
            <button type="button"
              onClick={() => { setDraft(String(maxRedeemable)); setError('') }}
              className="ml-2 text-[#ffc107] hover:underline">
              Đổi tối đa ({maxRedeemable.toLocaleString('vi-VN')} điểm)
            </button>
          )}
        </span>
        {draftNum > 0 && draftNum >= minRedeem && !exceedsBalance && draftNum <= pointsNeeded && (
          <span className="text-green-400">−{fmtVnd(previewDiscount)}</span>
        )}
      </div>
      {exceedsBalance && (
        <p className="text-red-400 text-[11px] leading-relaxed">
          Bạn chỉ có <strong>{loyalty.loyaltyPoints.toLocaleString('vi-VN')} điểm</strong>, không thể đổi {draftNum.toLocaleString('vi-VN')} điểm.
        </p>
      )}
      {willClamp && !error && (
        <p className="text-amber-300/90 text-[11px] leading-relaxed">
          ⓘ Bạn nhập {draftNum.toLocaleString('vi-VN')} điểm — vé chỉ cần {pointsNeeded.toLocaleString('vi-VN')} điểm để giảm hết.
          Hệ thống sẽ chỉ trừ {pointsNeeded.toLocaleString('vi-VN')} điểm, phần dư <strong>{(draftNum - pointsNeeded).toLocaleString('vi-VN')} điểm</strong> giữ lại trong tài khoản.
        </p>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
