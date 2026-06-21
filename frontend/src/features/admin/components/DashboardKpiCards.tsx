import { Users, TicketX, PieChart, Building2 } from 'lucide-react'
import { fmtVnd, ROOM_TYPE_LABELS, label } from '@/utils/labels'
import { ROOM_TYPE_TEXT } from '@/utils/colors'
import type {
  OccupancyAggregate, BookingHealth, RevenueBreakdown, RevenueByRoomType,
} from '@/hooks/useStatistics'

interface Props {
  occupancyAgg: OccupancyAggregate | undefined
  bookingHealth: BookingHealth | undefined
  revenueBreakdown: RevenueBreakdown | undefined
  revenueByRoom: RevenueByRoomType[] | undefined
}

/**
 * 4 KPI bổ sung Phase 1 — chuẩn industry dashboard rạp lớn:
 *
 * <ul>
 *   <li>Occupancy aggregate — tỉ lệ lấp ghế tuần/tháng (KPI số 1)</li>
 *   <li>Booking health — no-show / cancel / expire rates</li>
 *   <li>Revenue breakdown — pie vé vs đồ ăn (text-based vì pie chart cần lib)</li>
 *   <li>Revenue by room type — segmentation 2D/3D/IMAX/4DX</li>
 * </ul>
 */
export default function DashboardKpiCards({
  occupancyAgg, bookingHealth, revenueBreakdown, revenueByRoom,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <OccupancyCard data={occupancyAgg} />
      <BookingHealthCard data={bookingHealth} />
      <RevenueBreakdownCard data={revenueBreakdown} />
      <RevenueByRoomTypeCard data={revenueByRoom} />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────

function OccupancyCard({ data }: { data: OccupancyAggregate | undefined }) {
  const rate = data?.occupancyRate ?? 0
  // 60%+ là benchmark rạp đang chiếu phim hot; <30% cảnh báo phòng ế
  const rateColor = rate >= 60 ? 'text-green-400' : rate >= 30 ? 'text-[#ffc107]' : 'text-red-400'
  return (
    <KpiCard icon={<Users size={16} />} title="Tỉ lệ lấp ghế">
      <div className="flex items-baseline gap-2 mb-3">
        <span className={`text-3xl font-bold ${rateColor}`}>{rate.toFixed(1)}%</span>
        <span className="text-xs text-gray-500">trung bình {data?.sessionCount ?? 0} suất</span>
      </div>
      <ProgressBar percent={rate} color={rate >= 60 ? 'green' : rate >= 30 ? 'gold' : 'red'} />
      <p className="text-xs text-gray-500 mt-2">
        Đã bán <span className="text-gray-300 font-medium">
          {(data?.bookedSeats ?? 0).toLocaleString('vi-VN')}
        </span> / {(data?.totalSeats ?? 0).toLocaleString('vi-VN')} ghế
      </p>
    </KpiCard>
  )
}

function BookingHealthCard({ data }: { data: BookingHealth | undefined }) {
  return (
    <KpiCard icon={<TicketX size={16} />} title="Sức khoẻ vận hành">
      <div className="space-y-2 text-sm">
        <HealthRow
          label="Không đến (no-show)"
          rate={data?.noShowRate ?? 0}
          count={data?.noShowCount ?? 0}
          warnThreshold={10}
        />
        <HealthRow
          label="Huỷ chủ động"
          rate={data?.cancelRate ?? 0}
          count={data?.cancelledCount ?? 0}
          warnThreshold={15}
        />
        <HealthRow
          label="Hết hạn giữ chỗ"
          rate={data?.expireRate ?? 0}
          count={data?.expiredCount ?? 0}
          warnThreshold={20}
        />
      </div>
      <p className="text-[11px] text-gray-500 mt-3 pt-2 border-t border-white/5">
        Tổng <span className="text-gray-300 font-medium">
          {(data?.totalBookings ?? 0).toLocaleString('vi-VN')}
        </span> đơn trong khoảng
      </p>
    </KpiCard>
  )
}

function RevenueBreakdownCard({ data }: { data: RevenueBreakdown | undefined }) {
  return (
    <KpiCard icon={<PieChart size={16} />} title="Cơ cấu doanh thu">
      <div className="space-y-3">
        <BreakdownRow
          label="Vé chiếu phim"
          amount={data?.ticketRevenue ?? 0}
          percent={data?.ticketPercent ?? 0}
          color="bg-[#ffc107]"
        />
        <BreakdownRow
          label="Đồ ăn"
          amount={data?.snackRevenue ?? 0}
          percent={data?.snackPercent ?? 0}
          color="bg-pink-400"
        />
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
        <span className="text-xs text-gray-400">Tổng cộng</span>
        <span className="text-base font-bold text-[#ffc107]">
          {fmtVnd(data?.totalRevenue ?? 0)}
        </span>
      </div>
    </KpiCard>
  )
}

function RevenueByRoomTypeCard({ data }: { data: RevenueByRoomType[] | undefined }) {
  return (
    <KpiCard icon={<Building2 size={16} />} title="Doanh thu theo loại phòng">
      {(data ?? []).length === 0 ? (
        <p className="text-xs text-gray-500 py-4 text-center">Chưa có dữ liệu</p>
      ) : (
        <div className="space-y-2.5">
          {(data ?? []).map((r) => (
            <RoomTypeRow key={r.roomType} item={r} />
          ))}
        </div>
      )}
    </KpiCard>
  )
}

// ──────────────────────────────────────────────────────────────
// Atoms
// ──────────────────────────────────────────────────────────────

function KpiCard({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode
}) {
  return (
    <div className="bg-[#201b11] border border-[#3f382d] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#ffc107]">{icon}</span>
        <h3 className="text-sm font-semibold text-amber-50">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function ProgressBar({ percent, color }: { percent: number; color: 'green' | 'gold' | 'red' }) {
  const bgClass = color === 'green' ? 'bg-green-500'
                  : color === 'gold' ? 'bg-[#ffc107]'
                  : 'bg-red-500'
  return (
    <div className="w-full h-2 bg-[#2a2317] rounded-full overflow-hidden">
      <div className={`h-full ${bgClass} transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  )
}

function HealthRow({ label, rate, count, warnThreshold }: {
  label: string; rate: number; count: number; warnThreshold: number
}) {
  const isWarn = rate >= warnThreshold
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-gray-500">{count.toLocaleString('vi-VN')} đơn</span>
        <span className={`text-sm font-semibold ${isWarn ? 'text-red-400' : 'text-gray-200'} font-mono w-12 text-right`}>
          {rate.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

function BreakdownRow({ label, amount, percent, color }: {
  label: string; amount: number; percent: number; color: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">
          <span className="text-white font-mono font-semibold">{fmtVnd(amount)}</span>
          <span className="ml-2 text-[10px]">({percent.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="w-full h-1.5 bg-[#2a2317] rounded-full overflow-hidden">
        <div className={`h-full ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </div>
  )
}

// Explicit map text → bg để Tailwind JIT scan được (string runtime replace
// không nằm trong scan path → class CSS sẽ bị purge).
const ROOM_TYPE_BG: Record<string, string> = {
  TWO_D: 'bg-blue-400',
  THREE_D: 'bg-purple-400',
  IMAX: 'bg-[#ffc107]',
  FOUR_DX: 'bg-pink-400',
}

function RoomTypeRow({ item }: { item: RevenueByRoomType }) {
  const typeLabel = label(ROOM_TYPE_LABELS, item.roomType)
  const textColor = ROOM_TYPE_TEXT[item.roomType] ?? 'text-gray-300'
  const bgColor = ROOM_TYPE_BG[item.roomType] ?? 'bg-gray-400'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold ${textColor}`}>{typeLabel}</span>
        <span className="text-gray-400">
          <span className="text-gray-500">{item.ticketCount.toLocaleString('vi-VN')} vé</span>
          <span className="text-white ml-2 font-mono font-semibold">{fmtVnd(item.revenue)}</span>
          <span className="ml-2 text-[10px]">({item.percent.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="w-full h-1.5 bg-[#2a2317] rounded-full overflow-hidden">
        <div className={`h-full ${bgColor}`}
          style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }} />
      </div>
    </div>
  )
}
