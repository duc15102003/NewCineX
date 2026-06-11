import { TableCell, TableRow } from '@/components/ui/table'
import { DoorOpen } from 'lucide-react'
import { label, SHOWTIME_STATUS_LABELS, fmtDate, fmtTime, fmtVnd } from '@/utils/labels'
import { SHOWTIME_STATUS_COLORS as STATUS_COLORS } from '@/utils/colors'
import type { AdminShowtime } from '@/hooks/useAdminShowtimes'

export interface ShowtimeRowProps {
  showtime: AdminShowtime
  index: number
  selected: boolean
  onToggleSelect: (id: number) => void
  onEdit: (id: number) => void
}

/** Row trong bảng AdminShowtimePage — hiển thị phim, phòng, giá, trạng thái. */
export default function ShowtimeRow({ showtime: s, index, selected, onToggleSelect, onEdit }: ShowtimeRowProps) {
  return (
    <TableRow className="border-white/5 hover:bg-white/5 group">
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
            Thường: <span className="text-white font-medium">{fmtVnd(s.basePrice)}</span>
          </span>
          {s.vipPrice && (
            <span className="text-gray-300">
              VIP: <span className="text-[#ffc107] font-medium">{fmtVnd(s.vipPrice)}</span>
            </span>
          )}
          {s.couplePrice && (
            <span className="text-gray-300">
              Đôi: <span className="text-purple-400 font-medium">{fmtVnd(s.couplePrice)}</span>
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[s.status] ?? ''}`}>
          {label(SHOWTIME_STATUS_LABELS, s.status)}
        </span>
      </TableCell>
    </TableRow>
  )
}
