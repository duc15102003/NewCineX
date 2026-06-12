import { Building2, ChevronDown, ChevronRight } from 'lucide-react'

import { TableCell, TableRow } from '@/components/ui/table'

/**
 * Reusable group header row cho grouped admin tables.
 *
 * <p>Click để collapse/expand. Span hết cột (colSpan tùy theo page).
 *
 * <p>Pattern thống nhất với AdminRoomPage:
 * <pre>
 *   ▼ 🏢 CineX Hà Nội — Hà Nội                    10 items
 * </pre>
 */
interface Props {
  collapsed: boolean
  onToggle: () => void
  theaterName: string
  theaterCity?: string
  itemCount: number
  itemLabel?: string // "phòng", "suất chiếu", "vé"...
  colSpan: number
  /**
   * Tổng count THẬT của chi nhánh (từ BE aggregate query) — khi truyền vào
   * sẽ hiển thị "X / Y mục" để user biết itemCount chỉ là phần hiện trên trang.
   * Bỏ trống → fallback hiển thị chỉ itemCount.
   */
  totalCount?: number
}

export default function TheaterGroupHeaderRow({
  collapsed,
  onToggle,
  theaterName,
  theaterCity,
  itemCount,
  itemLabel = 'mục',
  colSpan,
  totalCount,
}: Props) {
  // sticky top-0 + z-10 → khi user kéo nội dung phía dưới, header chi nhánh
  // dính ở đầu container scroll → biết mình đang xem chi nhánh nào.
  // bg đậm hơn parent + backdrop-blur để không bị trong suốt khi sticky.
  return (
    <TableRow
      className="border-[#3f382d] bg-[#2a2317] hover:bg-[#2a2317]/80 cursor-pointer sticky top-0 z-10 backdrop-blur"
      onClick={onToggle}
    >
      <TableCell colSpan={colSpan} className="py-2.5">
        <div className="flex items-center gap-2">
          {collapsed
            ? <ChevronRight size={14} className="text-gray-400" />
            : <ChevronDown size={14} className="text-[#ffc107]" />}
          <Building2 size={14} className="text-[#ffc107]" />
          <span className="font-semibold text-amber-50">{theaterName}</span>
          {theaterCity && (
            <span className="text-xs text-gray-500">— {theaterCity}</span>
          )}
          <span className="ml-auto text-xs text-gray-400">
            {totalCount != null && totalCount !== itemCount
              ? `${itemCount} / ${totalCount} ${itemLabel}`
              : `${itemCount} ${itemLabel}`}
          </span>
        </div>
      </TableCell>
    </TableRow>
  )
}
