import { useState } from 'react'
import { Award, ArrowUp, ArrowDown, History, Crown } from 'lucide-react'

import { useMyLoyalty, useMyLoyaltyTransactions } from '@/hooks/useLoyalty'
import type { LoyaltyTier } from '@/hooks/useLoyalty'
import { Button } from '@/components/ui/button'
import { fmtDateTime } from '@/utils/labels'
import Loading from '@/components/common/Loading'

const TIER_LABELS: Record<LoyaltyTier, string> = {
  STANDARD: 'Tiêu chuẩn',
  SILVER: 'Bạc',
  GOLD: 'Vàng',
  PLATINUM: 'Bạch kim',
}

const TIER_COLORS: Record<LoyaltyTier, string> = {
  STANDARD: 'from-gray-500 to-gray-700',
  SILVER: 'from-gray-300 to-gray-500',
  GOLD: 'from-yellow-400 to-yellow-600',
  PLATINUM: 'from-purple-400 to-purple-600',
}

const TX_LABELS = {
  EARN: 'Cộng',
  REDEEM: 'Đổi',
  ADJUST: 'Điều chỉnh',
}

export default function LoyaltyPage() {
  const { data: account, isLoading } = useMyLoyalty()
  const [page, setPage] = useState(0)
  const { data: txPage } = useMyLoyaltyTransactions(page, 10)
  const transactions = txPage?.content ?? []

  if (isLoading || !account) return <Loading />

  const progressPercent = account.nextTierThreshold
    ? Math.min(100, Math.round((account.lifetimePoints / account.nextTierThreshold) * 100))
    : 100

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-amber-50 text-2xl font-bold tracking-tight">Điểm thưởng & Hạng thành viên</h1>
        <p className="text-gray-400 text-sm mt-1">
          Cứ 1.000đ chi tiêu = 1 điểm. Tích đủ điểm để lên hạng + nhận ưu đãi.
        </p>
      </div>

      {/* Tier card — gradient theo hạng */}
      <div className={`rounded-2xl p-6 bg-gradient-to-br ${TIER_COLORS[account.tier]} text-white shadow-lg`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm opacity-90">
              <Crown size={16} />
              <span>Hạng hiện tại</span>
            </div>
            <div className="text-3xl font-bold mt-1">{TIER_LABELS[account.tier]}</div>
          </div>
          <Award size={48} className="opacity-30" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs opacity-80">Điểm khả dụng</div>
            <div className="text-2xl font-semibold">{account.loyaltyPoints.toLocaleString('vi-VN')}</div>
          </div>
          <div>
            <div className="text-xs opacity-80">Điểm tích lũy (lifetime)</div>
            <div className="text-2xl font-semibold">{account.lifetimePoints.toLocaleString('vi-VN')}</div>
          </div>
        </div>

        {/* Progress to next tier */}
        {account.nextTier && (
          <div className="mt-6">
            <div className="flex justify-between text-xs opacity-90 mb-1">
              <span>Còn {account.pointsToNextTier?.toLocaleString('vi-VN')} điểm lên {TIER_LABELS[account.nextTier]}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white/80 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}
        {!account.nextTier && (
          <div className="mt-6 text-sm opacity-90">Bạn đã đạt hạng cao nhất 🎉</div>
        )}
      </div>

      {/* Transaction history */}
      <div className="rounded-2xl bg-[#201b11] border border-[#3f382d] overflow-hidden">
        <div className="p-4 border-b border-[#3f382d] flex items-center gap-2">
          <History size={18} className="text-[#ffc107]" />
          <h2 className="text-white font-semibold">Lịch sử điểm</h2>
        </div>
        {transactions.length === 0 ? (
          <div className="text-center py-10 text-gray-500">Chưa có giao dịch nào</div>
        ) : (
          <div className="divide-y divide-[#3f382d]">
            {transactions.map(tx => (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-white/5">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${tx.points > 0 ? 'text-green-400' : 'text-orange-400'}`}>
                    {tx.points > 0 ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">
                      {TX_LABELS[tx.transactionType]}
                      {tx.bookingCode && <span className="text-gray-400 font-normal ml-2">— {tx.bookingCode}</span>}
                    </div>
                    {tx.reason && <div className="text-gray-500 text-xs mt-0.5">{tx.reason}</div>}
                    <div className="text-gray-600 text-xs mt-0.5">{fmtDateTime(tx.createdAt)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-base font-semibold ${tx.points > 0 ? 'text-green-400' : 'text-orange-400'}`}>
                    {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString('vi-VN')}
                  </div>
                  <div className="text-gray-500 text-xs">Còn {tx.balanceAfter.toLocaleString('vi-VN')}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {txPage && txPage.totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t border-[#3f382d]">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}
                    className="border-white/10 text-gray-300 hover:bg-white/5">Trước</Button>
            <span className="text-gray-400 text-sm px-2 py-1">{page + 1} / {txPage.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= txPage.totalPages - 1} onClick={() => setPage(page + 1)}
                    className="border-white/10 text-gray-300 hover:bg-white/5">Sau</Button>
          </div>
        )}
      </div>
    </div>
  )
}
