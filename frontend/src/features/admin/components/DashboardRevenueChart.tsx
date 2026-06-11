import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmtVnd } from '@/utils/labels'

interface RevenueDatum {
  date: string
  revenue: number
}

export interface DashboardRevenueChartProps {
  data: RevenueDatum[] | undefined
}

/** Biểu đồ area doanh thu theo thời gian. */
export default function DashboardRevenueChart({ data }: DashboardRevenueChartProps) {
  return (
    <Card className="bg-[#201b11] border border-[#3f382d] rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base font-semibold">Biểu đồ doanh thu</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffc107" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ffc107" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#ffffff60', fontSize: 11 }}
                axisLine={{ stroke: '#ffffff10' }} tickLine={false} />
              <YAxis tick={{ fill: '#ffffff60', fontSize: 11 }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={36} />
              <Tooltip content={<RevenueTooltip />} />
              <Area type="monotone" dataKey="revenue"
                stroke="#ffc107" strokeWidth={2}
                fill="url(#revenueGradient)" dot={false}
                activeDot={{ r: 5, fill: '#ffc107', stroke: '#201b11', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[220px]">
            <p className="text-white/30 text-sm">Chưa có dữ liệu trong khoảng thời gian này</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface RevenueTooltipProps {
  active?: boolean
  payload?: { value?: number }[]
  label?: string
}

function RevenueTooltip({ active, payload, label }: RevenueTooltipProps) {
  if (!active || !payload?.length) return null
  const value = Number(payload[0]?.value ?? 0)
  return (
    <div className="bg-[#2a2317] border border-white/10 rounded-lg px-4 py-2 shadow-xl text-sm">
      <p className="text-white/60 mb-1">{label}</p>
      <p className="text-[#ffc107] font-semibold">
        {fmtVnd(value)}
      </p>
    </div>
  )
}
