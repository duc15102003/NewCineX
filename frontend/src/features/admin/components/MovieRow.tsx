import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { ImagePlus, Star, CalendarDays, Clock } from 'lucide-react'
import { fmtRating, label, MOVIE_STATUS_LABELS, STORAGE_STATE_LABELS, AGE_RATING_SHORT } from '@/utils/labels'
import { MOVIE_STATUS_COLORS as STATUS_COLORS, STORAGE_STATE_COLORS as STATE_COLORS, AGE_RATING_COLORS } from '@/utils/colors'
import type { MovieListItem } from '@/types/movie'

/** Format thời lượng từ phút → "1h 32p". Giúp scan nhanh hơn vs "92 phút". */
function fmtDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}p`
  if (m === 0) return `${h}h`
  return `${h}h ${m}p`
}

export interface MovieRowProps {
  movie: MovieListItem
  index: number
  selected: boolean
  onToggleSelect: (id: number) => void
  onEdit: (id: number) => void
  onUpload: (id: number) => void
  onOpenRuns: (movie: { id: number; title: string }) => void
}

/** Row trong bảng AdminMoviePage — poster, genres, status, rating, action buttons. */
export default function MovieRow({
  movie: m, index, selected, onToggleSelect, onEdit, onUpload, onOpenRuns,
}: MovieRowProps) {
  const isArchived = m.storageState === 'ARCHIVED'
  return (
    <TableRow className={`border-white/5 hover:bg-white/5 group ${isArchived ? 'opacity-50' : ''}`}>
      <TableCell className="whitespace-nowrap">
        <input type="checkbox" checked={selected}
          onChange={() => onToggleSelect(m.id)} className="accent-[#ffc107]" />
      </TableCell>
      <TableCell className="text-gray-500 text-sm whitespace-nowrap">{index + 1}</TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onEdit(m.id)}>
          {m.posterUrl ? (
            <img src={m.posterUrl} alt={m.title} className="w-9 h-13 object-cover rounded-md shrink-0" />
          ) : (
            <div className="w-9 h-13 bg-[#2a2317] rounded-md flex items-center justify-center shrink-0">
              <ImagePlus size={12} className="text-gray-600" />
            </div>
          )}
          <span className="text-[#ffc107] hover:underline font-medium">{m.title}</span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-gray-300 text-sm">
        {m.director ?? <span className="text-gray-600">—</span>}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <GenreBadges genres={m.genres} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-gray-300 text-sm">
        <span className="inline-flex items-center gap-1">
          <Clock size={12} className="text-gray-500" />
          {fmtDuration(m.duration)}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {m.ageRating ? (
          <span className={`text-xs px-2 py-1 rounded border font-mono ${AGE_RATING_COLORS[m.ageRating] ?? ''}`}>
            {label(AGE_RATING_SHORT, m.ageRating)}
          </span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex flex-col gap-1 items-start">
          <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[m.status] ?? ''}`}>
            {label(MOVIE_STATUS_LABELS, m.status)}
          </span>
          {isArchived && (
            <span className={`text-xs px-2 py-1 rounded border ${STATE_COLORS[m.storageState] ?? ''}`}>
              {label(STORAGE_STATE_LABELS, m.storageState)}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 ${m.rating ? 'text-[#ffc107]' : 'text-gray-500'}`}>
          <Star size={12} fill={m.rating ? 'currentColor' : 'none'} />
          {fmtRating(m.rating)}
        </span>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Button size="sm" variant="ghost"
          onClick={() => onOpenRuns({ id: m.id, title: m.title })}
          className="text-gray-400 hover:text-[#ffc107] h-8 w-8 p-0"
          title="Xem đợt chiếu">
          <CalendarDays size={14} />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onUpload(m.id)}
          className="text-gray-400 hover:text-[#ffc107] h-8 w-8 p-0"
          title="Upload poster">
          <ImagePlus size={14} />
        </Button>
      </TableCell>
    </TableRow>
  )
}

interface GenreBadgesProps {
  genres: MovieListItem['genres']
}

/** Render genres dưới dạng badge. Archived genre → gạch chéo + xám. */
function GenreBadges({ genres }: GenreBadgesProps) {
  if (!genres || genres.length === 0) return <>—</>
  return (
    <div className="flex flex-wrap gap-1.5">
      {genres.map(g => {
        const isArchived = g.storageState === 'ARCHIVED'
        return (
          <span key={g.id} className={`text-xs px-2 py-1 rounded-md border ${
            isArchived
              ? 'bg-white/5 text-gray-500 border-white/10 line-through'
              : 'bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/20'
          }`}>
            {g.name}
          </span>
        )
      })}
    </div>
  )
}
