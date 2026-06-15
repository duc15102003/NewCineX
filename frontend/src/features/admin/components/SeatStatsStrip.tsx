import type { SeatTypeKey, SeatTypeMeta } from '@/types/seatEditor'
import type { SeatItem } from '@/hooks/useAdmin'

interface Props {
  types: SeatTypeMeta[]
  rows: [string, SeatItem[]][]
  totalSeats: number
  getDisplayType: (seat: SeatItem) => SeatTypeKey
}

/**
 * Stats strip horizontal — đặt ngay dưới Resize bar (top), để khi admin
 * tăng/giảm số hàng/cột thấy tổng đổi theo realtime. Không nhồi vào sidebar
 * trái (sidebar giữ tool picker focus khi vẽ).
 *
 * <p>Hiển thị "Tổng (bán được)" prominent đầu, các loại ghế chip nhỏ sau.
 * Ẩn loại có count=0 để không nhồi UI.
 */
export default function SeatStatsStrip({ types, rows, totalSeats, getDisplayType }: Props) {
  const counts = types.map(t => ({
    meta: t,
    count: rows.reduce(
      (sum, [, seats]) => sum + seats.filter(s => getDisplayType(s) === t.key).length,
      0,
    ),
  })).filter(c => c.count > 0)

  return (
    <div className="bg-[#201b11] border border-[#3f382d] rounded-2xl px-4 py-2.5 flex items-center gap-4 flex-wrap">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
          Tổng bán được
        </span>
        <span className="text-xl font-bold text-[#ffc107] leading-none">{totalSeats}</span>
        <span className="text-xs text-gray-500">ghế</span>
      </div>

      <div className="h-6 w-px bg-white/10" />

      <div className="flex items-center gap-2 flex-wrap flex-1">
        {counts.map(({ meta, count }) => {
          const isDouble = meta.width === 2
          const displayCount = isDouble
            ? `${count} (${Math.floor(count / 2)} cặp)`
            : String(count)
          return (
            <span key={meta.key}
              className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-white/10 bg-[#2a2317]"
              title={meta.hint}>
              <span className={`w-2.5 h-2.5 rounded ${meta.bgClass} shrink-0`} />
              <span className="text-gray-400">{meta.label}</span>
              <span className="text-white font-semibold">{displayCount}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
