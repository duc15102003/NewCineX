import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarRange } from 'lucide-react'
import type { TopMovieRun } from '@/hooks/useAdmin'
import { fmtVnd, fmtDate } from '@/utils/labels'
import { cdnImage } from '@/utils/image'

interface Props {
  items: TopMovieRun[] | undefined
}

/**
 * Top đợt chiếu (engagements) — phân biệt FIRST_RUN/REISSUE/FESTIVAL của cùng 1 phim.
 *
 * <p><b>Khác Top Movies (DashboardTopTables):</b> Top Movies gộp doanh thu theo phim
 * (1 row Avatar = tổng cả 3 đợt). Bảng này tách từng đợt — distributor cần báo cáo này
 * để chia commission theo loại đợt (FIRST_RUN 60/40, REISSUE 50/50, v.v.).
 */
export default function DashboardMovieRunsTable({ items }: Props) {
  return (
    <Card className="bg-[#201b11] border border-white/5 rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
          <CalendarRange size={16} className="text-[#ffc107]" />
          Top đợt chiếu ({items?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items && items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 font-medium py-2 pr-3 w-8">#</th>
                  <th className="text-left text-gray-400 font-medium py-2 pr-3">Phim · Đợt</th>
                  <th className="text-left text-gray-400 font-medium py-2 pr-3">Khoảng ngày</th>
                  <th className="text-right text-gray-400 font-medium py-2 pr-3">Vé</th>
                  <th className="text-right text-gray-400 font-medium py-2">Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={r.movieRunId} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-3 text-gray-500">{i + 1}</td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        {r.moviePosterUrl && (
                          <img
                            src={cdnImage(r.moviePosterUrl, 60)}
                            alt={r.movieTitle}
                            loading="lazy"
                            className="w-7 h-10 object-cover rounded flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-white truncate">{r.movieTitle}</p>
                          {r.runType && <RunTypeBadge type={r.runType} />}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-gray-400 whitespace-nowrap text-xs">
                      {fmtDate(r.startDate)}
                      <span className="text-gray-600 mx-1">→</span>
                      {r.endDate ? fmtDate(r.endDate) : <span className="text-gray-500 italic">không giới hạn</span>}
                    </td>
                    <td className="py-3 pr-3 text-right text-white">{r.ticketCount.toLocaleString('vi-VN')}</td>
                    <td className="py-3 text-right text-[#ffc107] font-semibold whitespace-nowrap">{fmtVnd(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-8">Chưa có dữ liệu</p>
        )}
      </CardContent>
    </Card>
  )
}

/** Badge màu khác nhau cho FIRST_RUN / REISSUE / FESTIVAL — distributor nhìn lập tức biết loại. */
function RunTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    FIRST_RUN: 'bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30',
    REISSUE: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    FESTIVAL: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    HOLDOVER: 'bg-green-500/10 text-green-400 border-green-500/30',
  }
  const labels: Record<string, string> = {
    FIRST_RUN: 'Khởi chiếu',
    REISSUE: 'Chiếu lại',
    FESTIVAL: 'Liên hoan phim',
    HOLDOVER: 'Kéo dài',
  }
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-md border mt-0.5 ${colors[type] ?? 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
      {labels[type] ?? type}
    </span>
  )
}
