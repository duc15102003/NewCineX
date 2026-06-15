import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { LayoutGrid } from 'lucide-react'
import { label, ROOM_TYPE_LABELS, ROOM_STATUS_LABELS, STORAGE_STATE_LABELS } from '@/utils/labels'
import { ROOM_STATUS_COLORS as STATUS_COLORS, ROOM_TYPE_COLORS as TYPE_COLORS, STORAGE_STATE_COLORS as STATE_COLORS } from '@/utils/colors'
import type { AdminRoom } from '@/hooks/useAdminRooms'

export interface RoomRowProps {
  room: AdminRoom
  index: number
  indent?: boolean
  selected: boolean
  onToggleSelect: (id: number) => void
  onEdit: (room: AdminRoom) => void
}

/** Row trong bảng AdminRoomPage. indent=true khi nằm trong grouped view. */
export default function RoomRow({
  room: r, index, indent, selected, onToggleSelect, onEdit,
}: RoomRowProps) {
  const isArchived = r.storageState === 'ARCHIVED'
  return (
    <TableRow className={`border-[#3f382d] hover:bg-white/5 group ${isArchived ? 'opacity-50' : ''}`}>
      <TableCell className={`whitespace-nowrap ${indent ? 'pl-6' : ''}`}>
        <input type="checkbox" checked={selected}
          onChange={() => onToggleSelect(r.id)} className="accent-[#ffc107]" />
      </TableCell>
      <TableCell className="text-gray-500 text-sm whitespace-nowrap">{index + 1}</TableCell>
      <TableCell className="whitespace-nowrap">
        <span onClick={() => onEdit(r)}
          className="text-[#ffc107] hover:underline cursor-pointer font-medium">
          {r.name}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`text-xs px-2 py-1 rounded border ${TYPE_COLORS[r.type] ?? 'text-gray-400 border-white/10'}`}>
          {label(ROOM_TYPE_LABELS, r.type)}
        </span>
      </TableCell>
      <TableCell className="text-gray-300 whitespace-nowrap">{r.totalSeats}</TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[r.status] ?? ''}`}>
          {label(ROOM_STATUS_LABELS, r.status)}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`text-xs px-2 py-1 rounded border ${STATE_COLORS[r.storageState] ?? ''}`}>
          {label(STORAGE_STATE_LABELS, r.storageState)}
        </span>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Link to={`/admin/rooms/${r.id}/seats`}>
          <Button size="sm" variant="ghost"
            className="text-gray-400 hover:text-[#ffc107] h-8 w-8 p-0" title="Sơ đồ ghế">
            <LayoutGrid size={14} />
          </Button>
        </Link>
      </TableCell>
    </TableRow>
  )
}
