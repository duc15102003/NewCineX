import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { toast } from 'sonner'
import { useOverviewStats, useRevenueStats, useTopMovies, useTopSnacks } from '@/hooks/useAdmin'
import type { OverviewStats, TopMovie, TopSnack } from '@/hooks/useAdmin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CalendarDays, DollarSign, Users, Film, Coffee, FileDown, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportPDF, exportExcel } from '@/utils/export'
import type { ExportSection } from '@/utils/export'

function fmt(n: number) {
  return (n ?? 0).toLocaleString('vi-VN') + 'đ'
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDefaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 6)
  return { from: toDateStr(from), to: toDateStr(to) }
}

const QUICK_RANGES = [
  { label: '7 ngày', days: 7 },
  { label: '14 ngày', days: 14 },
  { label: '30 ngày', days: 30 },
]

const STAT_CARDS: {
  label: string
  key: keyof OverviewStats
  icon: typeof CalendarDays
  iconBg: string
  iconColor: string
  glow: string
  format: (v: number | undefined) => string
}[] = [
  {
    label: 'Booking hôm nay',
    key: 'todayBookings',
    icon: CalendarDays,
    iconBg: 'bg-[#eab308]/20',
    iconColor: 'text-[#eab308]',
    glow: 'shadow-[#eab308]/10',
    format: (v) => (v ?? 0).toLocaleString('vi-VN'),
  },
  {
    label: 'Doanh thu vé',
    key: 'todayRevenue',
    icon: DollarSign,
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    glow: 'shadow-emerald-500/10',
    format: (v) => fmt(v ?? 0),
  },
  {
    label: 'Doanh thu snack',
    key: 'todaySnackRevenue',
    icon: Coffee,
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-400',
    glow: 'shadow-orange-500/10',
    format: (v) => fmt(v ?? 0),
  },
  {
    label: 'Người dùng',
    key: 'totalUsers',
    icon: Users,
    iconBg: 'bg-sky-500/20',
    iconColor: 'text-sky-400',
    glow: 'shadow-sky-500/10',
    format: (v) => (v ?? 0).toLocaleString('vi-VN'),
  },
  {
    label: 'Tổng phim',
    key: 'totalMovies',
    icon: Film,
    iconBg: 'bg-violet-500/20',
    iconColor: 'text-violet-400',
    glow: 'shadow-violet-500/10',
    format: (v) => (v ?? 0).toLocaleString('vi-VN'),
  },
]

const EXPORT_COLUMNS = [
  { header: '#', key: 'rank' },
  { header: 'Tên', key: 'title' },
  { header: 'Số lượng', key: 'quantity' },
  { header: 'Doanh thu', key: 'revenue', format: (v: unknown) => (Number(v) || 0).toLocaleString('vi-VN') + 'đ' },
]

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0d2137] border border-white/10 rounded-lg px-4 py-2 shadow-xl text-sm">
      <p className="text-white/60 mb-1">{label}</p>
      <p className="text-[#eab308] font-semibold">{fmt(Number(payload[0]?.value ?? 0))}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useOverviewStats()
  const [range, setRange] = useState(getDefaultRange)
  const [activeDays, setActiveDays] = useState(7)

  const { data: revenue } = useRevenueStats(range.from, range.to)
  const { data: topMovies } = useTopMovies(range.from, range.to)
  const { data: topSnacks } = useTopSnacks(range.from, range.to)

  function selectQuickRange(days: number) {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - (days - 1))
    setRange({ from: toDateStr(from), to: toDateStr(to) })
    setActiveDays(days)
  }

  function handleDateChange(field: 'from' | 'to', value: string) {
    setRange(prev => ({ ...prev, [field]: value }))
    setActiveDays(0)
  }

  const dateLabel = `${range.from} đến ${range.to}`
  const hasData = (topMovies?.length ?? 0) > 0 || (topSnacks?.length ?? 0) > 0

  function buildExportSections(): { sections: ExportSection[]; movieRows: Record<string, unknown>[]; snackRows: Record<string, unknown>[] } {
    const movieRows = (topMovies ?? []).map((m: TopMovie, i: number) => ({
      rank: i + 1, title: m.title, quantity: m.ticketCount ?? 0, revenue: m.revenue ?? 0,
    }))
    const snackRows = (topSnacks ?? []).map((s: TopSnack, i: number) => ({
      rank: i + 1, title: s.snackName, quantity: s.totalQuantitySold ?? 0, revenue: s.totalRevenue ?? 0,
    }))
    const sections: ExportSection[] = []
    if (movieRows.length > 0) sections.push({ label: 'Thống kê phim', rows: movieRows })
    if (snackRows.length > 0) sections.push({ label: 'Thống kê đồ ăn', rows: snackRows })
    return { sections, movieRows, snackRows }
  }

  function handleExport(type: 'pdf' | 'excel') {
    if (!hasData) { toast.error('Không có dữ liệu để xuất'); return }
    try {
      const { sections, movieRows } = buildExportSections()
      const params = {
        title: 'Báo cáo thống kê — CineX',
        subtitle: `Khoảng thời gian: ${dateLabel}`,
        columns: EXPORT_COLUMNS,
        rows: movieRows,
        fileName: `cinex-thongke-${range.from}_${range.to}`,
        sections,
      }
      if (type === 'pdf') {
        exportPDF(params)
      } else {
        exportExcel(params)
      }
      toast.success(type === 'pdf' ? 'Xuất PDF thành công' : 'Xuất Excel thành công')
    } catch {
      toast.error('Lỗi xuất báo cáo')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Tổng quan</h1>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(n => (
            <div key={n} className="bg-[#0a1929] border border-white/5 rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 bg-white/5 rounded" />
                  <div className="h-5 w-16 bg-white/5 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {STAT_CARDS.map(({ label, key, icon: Icon, iconBg, iconColor, glow, format }) => (
            <Card key={key} className={`bg-[#0a1929] border border-white/5 rounded-xl shadow-lg ${glow} hover:border-white/10 transition-colors`}>
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
      )}

      {/* Filter bar */}
      <Card className="bg-[#0a1929] border border-white/5 rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Filter size={16} className="text-[#eab308]" />
              <span className="text-white/60 text-sm font-medium">Thời gian:</span>
              <div className="flex items-center gap-2">
                <Input type="date" value={range.from}
                  onChange={(e) => handleDateChange('from', e.target.value)}
                  className="h-8 text-xs w-36" />
                <span className="text-gray-500 text-xs">đến</span>
                <Input type="date" value={range.to}
                  onChange={(e) => handleDateChange('to', e.target.value)}
                  className="h-8 text-xs w-36" />
              </div>
              <div className="flex items-center gap-1.5">
                {QUICK_RANGES.map(q => (
                  <button key={q.days} onClick={() => selectQuickRange(q.days)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      activeDays === q.days
                        ? 'bg-[#eab308] text-black'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-white/10 text-gray-300 hover:bg-white/5"
                onClick={() => handleExport('pdf')}>
                <FileDown size={14} className="mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" className="border-white/10 text-gray-300 hover:bg-white/5"
                onClick={() => handleExport('excel')}>
                <FileDown size={14} className="mr-1" /> Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Thống kê phim + đồ ăn */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#0a1929] border border-white/5 rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base font-semibold">Thống kê phim ({topMovies?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {topMovies && topMovies.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 pr-3 text-white/40 font-medium text-xs uppercase tracking-wide w-8">#</th>
                    <th className="text-left py-2 pr-3 text-white/40 font-medium text-xs uppercase tracking-wide">Phim</th>
                    <th className="text-right py-2 pr-3 text-white/40 font-medium text-xs uppercase tracking-wide">Vé</th>
                    <th className="text-right py-2 text-white/40 font-medium text-xs uppercase tracking-wide">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {topMovies.map((m: TopMovie, i: number) => (
                    <tr key={m.movieId} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-3">
                        <span className={`text-sm font-bold ${i === 0 ? 'text-[#eab308]' : 'text-white/30'}`}>{i + 1}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          {m.posterUrl ? (
                            <img src={m.posterUrl} alt={m.title} className="w-10 h-14 object-cover rounded flex-shrink-0"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                          ) : (
                            <div className="w-10 h-14 rounded bg-white/5 flex-shrink-0 flex items-center justify-center">
                              <Film size={14} className="text-white/20" />
                            </div>
                          )}
                          <span className="text-white font-medium line-clamp-2">{m.title}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <span className="text-[#eab308] font-semibold">{(m.ticketCount ?? 0).toLocaleString('vi-VN')}</span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-emerald-400 font-semibold">{fmt(m.revenue)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-[220px]">
                <p className="text-white/30 text-sm">Chưa có dữ liệu</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#0a1929] border border-white/5 rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base font-semibold">Thống kê đồ ăn ({topSnacks?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {topSnacks && topSnacks.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 pr-3 text-white/40 font-medium text-xs uppercase tracking-wide w-8">#</th>
                    <th className="text-left py-2 pr-3 text-white/40 font-medium text-xs uppercase tracking-wide">Đồ ăn</th>
                    <th className="text-right py-2 pr-3 text-white/40 font-medium text-xs uppercase tracking-wide">Số lượng</th>
                    <th className="text-right py-2 text-white/40 font-medium text-xs uppercase tracking-wide">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {topSnacks.map((s: TopSnack, i: number) => (
                    <tr key={s.snackId} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-3">
                        <span className={`text-sm font-bold ${i === 0 ? 'text-[#eab308]' : 'text-white/30'}`}>{i + 1}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          {s.imageUrl ? (
                            <img src={s.imageUrl} alt={s.snackName} className="w-10 h-10 object-cover rounded flex-shrink-0"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                          ) : (
                            <div className="w-10 h-10 rounded bg-white/5 flex-shrink-0 flex items-center justify-center">
                              <Coffee size={14} className="text-white/20" />
                            </div>
                          )}
                          <span className="text-white font-medium line-clamp-2">{s.snackName}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <span className="text-[#eab308] font-semibold">{(s.totalQuantitySold ?? 0).toLocaleString('vi-VN')}</span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-emerald-400 font-semibold">{fmt(s.totalRevenue)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-[220px]">
                <p className="text-white/30 text-sm">Chưa có dữ liệu</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Biểu đồ doanh thu */}
      <Card className="bg-[#0a1929] border border-white/5 rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base font-semibold">Biểu đồ doanh thu</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {revenue && revenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#ffffff60', fontSize: 11 }} axisLine={{ stroke: '#ffffff10' }} tickLine={false} />
                <YAxis tick={{ fill: '#ffffff60', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={36} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#eab308" strokeWidth={2} fill="url(#revenueGradient)" dot={false}
                  activeDot={{ r: 5, fill: '#eab308', stroke: '#0a1929', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px]">
              <p className="text-white/30 text-sm">Chưa có dữ liệu trong khoảng thời gian này</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
