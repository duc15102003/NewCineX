import { TableCell, TableRow } from '@/components/ui/table'
import { Building2, DoorOpen, Send, Loader2 } from 'lucide-react'
import { label, SHOWTIME_STATUS_LABELS, STORAGE_STATE_LABELS, fmtDate, fmtTime, fmtVnd } from '@/utils/labels'
import { SHOWTIME_STATUS_COLORS as STATUS_COLORS, STORAGE_STATE_COLORS as STATE_COLORS, SEAT_TYPE_PRICE_TEXT } from '@/utils/colors'
import { usePublishShowtime, type AdminShowtime } from '@/hooks/useAdminShowtimes'

export interface ShowtimeRowProps {
  showtime: AdminShowtime
  index: number
  selected: boolean
  /** Render cột "Chi nhánh" khi đang xem "Tất cả chi nhánh" — phân biệt suất thuộc rạp nào. */
  showTheater?: boolean
  onToggleSelect: (id: number) => void
  onEdit: (id: number) => void
}

/** Row trong bảng AdminShowtimePage — hiển thị phim, phòng, giá, trạng thái. */
export default function ShowtimeRow({ showtime: s, index, selected, showTheater, onToggleSelect, onEdit }: ShowtimeRowProps) {
  const isArchived = s.storageState === 'ARCHIVED'
  const isDraft = s.status === 'DRAFT'
  const publishMut = usePublishShowtime()
  // DRAFT cần đập vào mắt admin để publish — viền trái + tint nhẹ nâu vàng.
  const draftHighlight = isDraft && !isArchived
    ? 'bg-[#ffc107]/[0.03] border-l-2 border-l-[#ffc107]'
    : ''
  return (
    <TableRow className={`border-[#3f382d] hover:bg-white/5 group ${draftHighlight} ${isArchived ? 'opacity-50' : ''}`}>
      <TableCell className="whitespace-nowrap">
        <input type="checkbox" checked={selected}
          onChange={() => onToggleSelect(s.id)} className="accent-[#ffc107]" />
      </TableCell>
      <TableCell className="text-gray-500 text-sm whitespace-nowrap">{index + 1}</TableCell>
      <TableCell className="whitespace-nowrap">
        <span onClick={() => onEdit(s.id)}
          className="text-[#ffc107] hover:underline cursor-pointer font-medium block">
          {s.movieTitle ?? s.movie?.title}
        </span>
        <span className="text-gray-500 text-xs">
          {fmtDate(s.startTime)} · {fmtTime(s.startTime)} - {fmtTime(s.endTime)}
        </span>
      </TableCell>
      {showTheater && (
        <TableCell className="whitespace-nowrap">
          {s.theaterName ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-200">
              <Building2 size={12} className="text-[#ffc107]" />
              <span>{s.theaterName}</span>
              {s.theaterCity && <span className="text-gray-500">— {s.theaterCity}</span>}
            </span>
          ) : (
            <span className="text-xs text-gray-500">—</span>
          )}
        </TableCell>
      )}
      <TableCell className="whitespace-nowrap">
        {(s.roomName || s.room?.name) && (
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-200">
            <DoorOpen size={12} className="text-[#ffc107]" />
            {s.roomName ?? s.room?.name}
          </span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-300">
            Thường: <span className={`font-medium ${SEAT_TYPE_PRICE_TEXT.STANDARD}`}>{fmtVnd(s.basePrice)}</span>
          </span>
          {s.vipPrice != null && (
            <span className="text-gray-300">
              VIP: <span className={`font-medium ${SEAT_TYPE_PRICE_TEXT.VIP}`}>{fmtVnd(s.vipPrice)}</span>
            </span>
          )}
          {s.couplePrice != null && (
            <span className="text-gray-300">
              Đôi: <span className={`font-medium ${SEAT_TYPE_PRICE_TEXT.COUPLE}`}>{fmtVnd(s.couplePrice)}</span>
            </span>
          )}
          {s.sweetboxPrice != null && (
            <span className="text-gray-300">
              Sweetbox: <span className={`font-medium ${SEAT_TYPE_PRICE_TEXT.SWEETBOX}`}>{fmtVnd(s.sweetboxPrice)}</span>
            </span>
          )}
          {s.deluxePrice != null && (
            <span className="text-gray-300">
              Deluxe: <span className={`font-medium ${SEAT_TYPE_PRICE_TEXT.DELUXE}`}>{fmtVnd(s.deluxePrice)}</span>
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="inline-flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[s.status] ?? ''}`}>
            {label(SHOWTIME_STATUS_LABELS, s.status)}
          </span>
          {isDraft && !isArchived && (
            <button type="button"
              onClick={() => publishMut.mutate(s.id)}
              disabled={publishMut.isPending}
              title="Đẩy suất nháp lên lịch chính — khách sẽ nhìn thấy ngay sau khi đăng"
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md
                bg-[#ffc107] text-black
                hover:bg-[#e6ac06] disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm">
              {publishMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Đăng
            </button>
          )}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`text-xs px-2 py-1 rounded border ${STATE_COLORS[s.storageState] ?? ''}`}>
          {label(STORAGE_STATE_LABELS, s.storageState)}
        </span>
      </TableCell>
    </TableRow>
  )
}
