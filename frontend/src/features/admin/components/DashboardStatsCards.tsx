import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, DollarSign, Users, Film, Coffee } from 'lucide-react'
import type { OverviewStats } from '@/hooks/useAdmin'
import { fmtVnd } from '@/utils/labels'

function fmtCurrency(n: number | undefined): string {
  return fmtVnd(n ?? 0)
}

function fmtNumber(n: number | undefined): string {
  return (n ?? 0).toLocaleString('vi-VN')
}

interface StatCardConfig {
  label: string
  key: keyof OverviewStats
  icon: typeof CalendarDays
  iconBg: string
  iconColor: string
  glow: string
  format: (v: number | undefined) => string
}

const STAT_CARDS: StatCardConfig[] = [
  {
    label: 'Booking hôm nay',
    key: 'todayBookings',
    icon: CalendarDays,
    iconBg: 'bg-[#ffc107]/20',
    iconColor: 'text-[#ffc107]',
    glow: 'shadow-[#ffc107]/10',
    format: fmtNumber,
  },
  {
    label: 'Doanh thu vé',
    key: 'todayRevenue',
    icon: DollarSign,
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    glow: 'shadow-emerald-500/10',
    format: (v) => fmtCurrency(v ?? 0),
  },
  {
    label: 'Doanh thu snack',
    key: 'todaySnackRevenue',
    icon: Coffee,
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-400',
    glow: 'shadow-orange-500/10',
    format: (v) => fmtCurrency(v ?? 0),
  },
  {
    label: 'Người dùng',
    key: 'totalUsers',
    icon: Users,
    iconBg: 'bg-sky-500/20',
    iconColor: 'text-sky-400',
    glow: 'shadow-sky-500/10',
    format: fmtNumber,
  },
  {
    label: 'Tổng phim',
    key: 'totalMovies',
    icon: Film,
    iconBg: 'bg-violet-500/20',
    iconColor: 'text-violet-400',
    glow: 'shadow-violet-500/10',
    format: fmtNumber,
  },
]

export interface DashboardStatsCardsProps {
  stats: OverviewStats | undefined
  isLoading: boolean
}

/** Top 5 stat cards: Booking / Vé / Snack / User / Movie. */
export default function DashboardStatsCards({ stats, isLoading }: DashboardStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map(n => <StatCardSkeleton key={n} />)}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      {STAT_CARDS.map(({ label, key, icon: Icon, iconBg, iconColor, glow, format }) => (
        <Card key={key} className={`bg-[#201b11] border border-[#3f382d] rounded-2xl shadow-lg ${glow} hover:border-white/10 transition-colors`}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
              <Icon size={18} className={iconColor} />
            </div>
            <div className="min-w-0">
              <p className="text-white/50 text-[11px] font-medium uppercase tracking-wide truncate">{label}</p>
              <p className="text-white text-lg font-bold mt-0.5 leading-none truncate">{format(stats?.[key] as number | undefined)}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function StatCardSkeleton() {
  return (
    <div className="bg-[#201b11] border border-[#3f382d] rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/5" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 bg-white/5 rounded" />
          <div className="h-5 w-16 bg-white/5 rounded" />
        </div>
      </div>
    </div>
  )
}
