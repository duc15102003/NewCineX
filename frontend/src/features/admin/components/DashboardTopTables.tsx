import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Film, Coffee } from 'lucide-react'
import type { TopMovie, TopSnack } from '@/hooks/useAdmin'
import { fmtVnd } from '@/utils/labels'

function fmtCurrency(n: number | undefined): string {
  return fmtVnd(n ?? 0)
}

function fmtNumber(n: number | undefined): string {
  return (n ?? 0).toLocaleString('vi-VN')
}

export interface DashboardTopTablesProps {
  topMovies: TopMovie[] | undefined
  topSnacks: TopSnack[] | undefined
}

/** Section 2 bảng: Top phim doanh thu + Top snack bán chạy trong khoảng thời gian filter. */
export default function DashboardTopTables({ topMovies, topSnacks }: DashboardTopTablesProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <TopMoviesTable items={topMovies} />
      <TopSnacksTable items={topSnacks} />
    </div>
  )
}

// ============================================================
//  Sub-components
// ============================================================

interface TopMoviesTableProps {
  items: TopMovie[] | undefined
}

function TopMoviesTable({ items }: TopMoviesTableProps) {
  return (
    <Card className="bg-[#201b11] border border-[#3f382d] rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base font-semibold">
          Thống kê phim ({items?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items && items.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <TableTh className="w-8" align="left">#</TableTh>
                <TableTh align="left">Phim</TableTh>
                <TableTh align="right">Vé</TableTh>
                <TableTh align="right" last>Doanh thu</TableTh>
              </tr>
            </thead>
            <tbody>
              {items.map((m, i) => (
                <tr key={m.movieId} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-3">
                    <RankBadge rank={i + 1} />
                  </td>
                  <td className="py-3 pr-3">
                    <PosterAndTitle posterUrl={m.posterUrl} title={m.title} fallbackIcon={<Film size={14} className="text-white/20" />} portrait />
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <span className="text-[#ffc107] font-semibold">{fmtNumber(m.ticketCount)}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-emerald-400 font-semibold">{fmtCurrency(m.revenue ?? 0)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState />
        )}
      </CardContent>
    </Card>
  )
}

interface TopSnacksTableProps {
  items: TopSnack[] | undefined
}

function TopSnacksTable({ items }: TopSnacksTableProps) {
  return (
    <Card className="bg-[#201b11] border border-[#3f382d] rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base font-semibold">
          Thống kê đồ ăn ({items?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items && items.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <TableTh className="w-8" align="left">#</TableTh>
                <TableTh align="left">Đồ ăn</TableTh>
                <TableTh align="right">Số lượng</TableTh>
                <TableTh align="right" last>Doanh thu</TableTh>
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => (
                <tr key={s.snackId} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-3">
                    <RankBadge rank={i + 1} />
                  </td>
                  <td className="py-3 pr-3">
                    <PosterAndTitle posterUrl={s.imageUrl} title={s.snackName} fallbackIcon={<Coffee size={14} className="text-white/20" />} />
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <span className="text-[#ffc107] font-semibold">{fmtNumber(s.totalQuantitySold)}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-emerald-400 font-semibold">{fmtCurrency(s.totalRevenue ?? 0)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState />
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
//  Reusable bits
// ============================================================

interface TableThProps {
  children: React.ReactNode
  align: 'left' | 'right'
  className?: string
  last?: boolean
}

function TableTh({ children, align, className = '', last }: TableThProps) {
  const padding = last ? '' : 'pr-3'
  return (
    <th className={`py-2 ${padding} text-${align} text-white/40 font-medium text-xs uppercase tracking-wide ${className}`}>
      {children}
    </th>
  )
}

interface RankBadgeProps {
  rank: number
}

function RankBadge({ rank }: RankBadgeProps) {
  return (
    <span className={`text-sm font-bold ${rank === 1 ? 'text-[#ffc107]' : 'text-white/30'}`}>
      {rank}
    </span>
  )
}

interface PosterAndTitleProps {
  posterUrl: string | null | undefined
  title: string
  fallbackIcon: React.ReactNode
  /** Portrait = 10×14 (poster phim); default = 10×10 (snack vuông). */
  portrait?: boolean
}

function PosterAndTitle({ posterUrl, title, fallbackIcon, portrait }: PosterAndTitleProps) {
  // Track lỗi load image — nếu URL có nhưng 404/CORS, swap sang fallback icon thay vì
  // ẩn ảnh để lại ô trống (bug user phát hiện trên Dashboard).
  const [imgError, setImgError] = useState(false)
  const size = portrait ? 'w-10 h-14' : 'w-10 h-10'
  const showImage = posterUrl && !imgError
  return (
    <div className="flex items-center gap-3">
      {showImage ? (
        <img src={posterUrl} alt={title} className={`${size} object-cover rounded flex-shrink-0`}
          onError={() => setImgError(true)} />
      ) : (
        <div className={`${size} rounded bg-white/5 flex-shrink-0 flex items-center justify-center`}>
          {fallbackIcon}
        </div>
      )}
      <span className="text-white font-medium line-clamp-2">{title}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-[220px]">
      <p className="text-white/30 text-sm">Chưa có dữ liệu</p>
    </div>
  )
}
