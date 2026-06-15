import { useState } from 'react'
import { toast } from 'sonner'

import { useOverviewStats, useRevenueStats, useTopMovies, useTopSnacks, useTopMovieRuns, useOccupancy,
  useOccupancyAggregate, useBookingHealth, useRevenueBreakdown, useRevenueByRoomType } from '@/hooks/useAdmin'
import type { TopMovie, TopSnack } from '@/hooks/useAdmin'
import { exportPDF, exportExcel } from '@/utils/export'
import type { ExportSection } from '@/utils/export'
import { fmtVnd } from '@/utils/labels'
import { useAdminTheaterStore } from '@/store/adminTheaterStore'

import DashboardStatsCards from './components/DashboardStatsCards'
import DashboardKpiCards from './components/DashboardKpiCards'
import DashboardFilterBar from './components/DashboardFilterBar'
import DashboardTopTables from './components/DashboardTopTables'
import DashboardRevenueChart from './components/DashboardRevenueChart'
import DashboardMovieRunsTable from './components/DashboardMovieRunsTable'
import DashboardOccupancyTable from './components/DashboardOccupancyTable'

const DEFAULT_RANGE_DAYS = 7

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDefaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (DEFAULT_RANGE_DAYS - 1))
  return { from: toDateStr(from), to: toDateStr(to) }
}

const EXPORT_COLUMNS = [
  { header: '#', key: 'rank' },
  { header: 'Tên', key: 'title' },
  { header: 'Số lượng', key: 'quantity' },
  { header: 'Doanh thu', key: 'revenue', format: (v: unknown) => fmtVnd(Number(v) || 0) },
]

export default function DashboardPage() {
  // Filter theo chi nhánh (SUPER_ADMIN dropdown header / branch ADMIN auto từ JWT phía BE)
  const { currentTheater } = useAdminTheaterStore()
  const theaterId = currentTheater?.id

  const { data: stats, isLoading } = useOverviewStats(theaterId)
  const [range, setRange] = useState(getDefaultRange)
  const [activeDays, setActiveDays] = useState(DEFAULT_RANGE_DAYS)

  const { data: revenue } = useRevenueStats(range.from, range.to, theaterId)
  const { data: topMovies } = useTopMovies(range.from, range.to, theaterId)
  const { data: topSnacks } = useTopSnacks(range.from, range.to, theaterId)
  const { data: topMovieRuns } = useTopMovieRuns(range.from, range.to, theaterId)
  // Phase 1 KPI bổ sung — chuẩn industry
  const { data: occupancyAgg } = useOccupancyAggregate(range.from, range.to, theaterId)
  const { data: bookingHealth } = useBookingHealth(range.from, range.to, theaterId)
  const { data: revenueBreakdown } = useRevenueBreakdown(range.from, range.to, theaterId)
  const { data: revenueByRoom } = useRevenueByRoomType(range.from, range.to, theaterId)
  // Occupancy luôn cho ngày hôm nay — operations team xem real-time lấp đầy mỗi suất
  const today = toDateStr(new Date())
  const { data: occupancy } = useOccupancy(today, theaterId)

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

  function handleExport(type: 'pdf' | 'excel') {
    const movieRows = (topMovies ?? []).map((m: TopMovie, i: number) => ({
      rank: i + 1, title: m.title, quantity: m.ticketCount ?? 0, revenue: m.revenue ?? 0,
    }))
    const snackRows = (topSnacks ?? []).map((s: TopSnack, i: number) => ({
      rank: i + 1, title: s.snackName, quantity: s.totalQuantitySold ?? 0, revenue: s.totalRevenue ?? 0,
    }))
    if (movieRows.length === 0 && snackRows.length === 0) {
      toast.error('Không có dữ liệu để xuất')
      return
    }
    const sections: ExportSection[] = []
    if (movieRows.length > 0) sections.push({ label: 'Thống kê phim', rows: movieRows })
    if (snackRows.length > 0) sections.push({ label: 'Thống kê đồ ăn', rows: snackRows })

    const dateLabel = `${range.from} đến ${range.to}`
    const params = {
      title: 'Báo cáo thống kê — CineX',
      subtitle: `Khoảng thời gian: ${dateLabel}`,
      columns: EXPORT_COLUMNS,
      rows: movieRows,
      fileName: `cinex-thongke-${range.from}_${range.to}`,
      sections,
    }
    try {
      if (type === 'pdf') exportPDF(params)
      else exportExcel(params)
      toast.success(type === 'pdf' ? 'Xuất PDF thành công' : 'Xuất Excel thành công')
    } catch {
      toast.error('Lỗi xuất báo cáo')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Tổng quan</h1>

      <DashboardStatsCards stats={stats} isLoading={isLoading} />

      <DashboardFilterBar
        from={range.from}
        to={range.to}
        activeDays={activeDays}
        onDateChange={handleDateChange}
        onQuickRange={selectQuickRange}
        onExportPdf={() => handleExport('pdf')}
        onExportExcel={() => handleExport('excel')}
      />

      <DashboardKpiCards
        occupancyAgg={occupancyAgg}
        bookingHealth={bookingHealth}
        revenueBreakdown={revenueBreakdown}
        revenueByRoom={revenueByRoom}
      />

      <DashboardTopTables topMovies={topMovies} topSnacks={topSnacks} />

      <DashboardMovieRunsTable items={topMovieRuns} />

      <DashboardOccupancyTable items={occupancy} date={today} />

      <DashboardRevenueChart data={revenue} />
    </div>
  )
}
