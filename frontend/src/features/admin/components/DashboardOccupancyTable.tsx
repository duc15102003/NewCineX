import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'
import type { Occupancy } from '@/hooks/useAdmin'
import { fmtTime } from '@/utils/labels'

interface Props {
  items: Occupancy[] | undefined
  date: string
}

/**
 * Bảng tỷ lệ lấp đầy ghế của các suất chiếu trong ngày — operations team theo dõi
 * phòng nào lấp đầy (cân nhắc thêm suất), phòng nào ế (cân nhắc bỏ slot, đổi phim).
 *
 * <p>Vista FilmAtSite gọi pattern này là "Session Occupancy Report" — báo cáo bắt
 * buộc trong operations meeting hàng ngày của rạp.
 *
 * <p>Sắp xếp suất theo {@code startTime ASC} (cinema operator đọc theo dòng thời gian).
 * Color bar theo % lấp đầy: <30% xám, 30-70% vàng, >70% xanh (lý tưởng).
 */
export default function DashboardOccupancyTable({ items, date }: Props) {
  // Lọc chỉ suất chiếu hôm đó (BE đã filter, nhưng defensive sort lại theo time)
  const sorted = [...(items ?? [])].sort((a, b) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  )

  return (
    <Card className="bg-[#201b11] border border-white/5 rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
          <Users size={16} className="text-[#ffc107]" />
          Tỷ lệ lấp đầy phòng — {fmtDateDisplay(date)} ({sorted.length} suất)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {sorted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 font-medium py-2 pr-3">Giờ</th>
                  <th className="text-left text-gray-400 font-medium py-2 pr-3">Phim</th>
                  <th className="text-left text-gray-400 font-medium py-2 pr-3">Phòng</th>
                  <th className="text-right text-gray-400 font-medium py-2 pr-3 whitespace-nowrap">Ghế đã đặt</th>
                  <th className="text-left text-gray-400 font-medium py-2 w-1/4">Lấp đầy</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(o => (
                  <tr key={o.showtimeId} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-3 text-white font-mono whitespace-nowrap">{fmtTime(o.startTime)}</td>
                    <td className="py-3 pr-3 text-white truncate max-w-xs">{o.movieTitle}</td>
                    <td className="py-3 pr-3 text-gray-400 whitespace-nowrap">{o.roomName}</td>
                    <td className="py-3 pr-3 text-right text-gray-300 whitespace-nowrap">
                      {o.bookedSeats}/{o.totalSeats}
                    </td>
                    <td className="py-3">
                      <OccupancyBar rate={o.occupancyRate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-8">Không có suất chiếu</p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Bar visual + % number. Color thay đổi theo dải:
 * - <30%: xám đỏ (ế, cân nhắc bỏ slot)
 * - 30-70%: vàng (trung bình, ổn)
 * - >70%: xanh (lấp đầy tốt, có thể thêm suất)
 */
function OccupancyBar({ rate }: { rate: number }) {
  const pct = Math.round(rate)
  let color = 'bg-red-500/60'
  let textColor = 'text-red-400'
  if (pct >= 70) {
    color = 'bg-green-500/60'
    textColor = 'text-green-400'
  } else if (pct >= 30) {
    color = 'bg-[#ffc107]/60'
    textColor = 'text-[#ffc107]'
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden min-w-[60px]">
        <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-mono ${textColor} w-9 text-right`}>{pct}%</span>
    </div>
  )
}

/** Format yyyy-mm-dd → dd/mm/yyyy. */
function fmtDateDisplay(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}
