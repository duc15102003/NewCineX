import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { Trash2, RotateCcw, Star } from 'lucide-react'
import { fmtDateTime, fmtRating, label, STORAGE_STATE_LABELS } from '@/utils/labels'
import { STORAGE_STATE_COLORS } from '@/utils/colors'

export interface AdminReview {
  id: number
  username: string
  avatarUrl: string | null
  movieTitle: string
  rating: number
  comment: string | null
  storageState: string
  createdAt: string
}

export interface ReviewRowProps {
  review: AdminReview
  index: number
  selected: boolean
  onToggleSelect: () => void
  onRequestDelete: () => void
  onRequestRestore: () => void
}

function truncate(text: string | null | undefined, max = 80): string {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '…' : text
}

/** Row trong bảng AdminReviewPage — user info, movie, rating, comment, status. */
export default function ReviewRow({
  review, index, selected, onToggleSelect, onRequestDelete, onRequestRestore,
}: ReviewRowProps) {
  const isArchived = review.storageState === 'ARCHIVED'
  return (
    <TableRow className="border-[#3f382d] hover:bg-white/5 group">
      <TableCell className="whitespace-nowrap">
        <input type="checkbox" checked={selected}
          onChange={onToggleSelect} className="accent-[#ffc107]" />
      </TableCell>
      <TableCell className="text-gray-500 text-sm whitespace-nowrap">{index + 1}</TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center gap-2">
          {review.avatarUrl ? (
            <img src={review.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#ffc107]/20 flex items-center justify-center text-[#ffc107] text-xs font-bold">
              {review.username.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-white text-sm">{review.username}</span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="text-[#ffc107] hover:underline cursor-pointer font-medium text-sm">
          {review.movieTitle}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center gap-1">
          <Star size={14} className="text-[#ffc107] fill-[#ffc107]" />
          <span className="text-white text-sm font-semibold">{fmtRating(review.rating)}</span>
        </div>
      </TableCell>
      <TableCell className="text-gray-400 text-sm max-w-md">
        {truncate(review.comment, 80)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`text-xs px-2 py-1 rounded border ${STORAGE_STATE_COLORS[review.storageState] ?? ''}`}>
          {label(STORAGE_STATE_LABELS, review.storageState)}
        </span>
      </TableCell>
      <TableCell className="text-gray-400 text-sm whitespace-nowrap">
        {fmtDateTime(review.createdAt)}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap pr-4">
        {isArchived ? (
          <Button variant="ghost" size="sm" onClick={onRequestRestore}
            className="text-green-400 hover:bg-green-400/10 hover:text-green-300"
            title="Khôi phục">
            <RotateCcw size={14} />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onRequestDelete}
            className="text-red-400 hover:bg-red-400/10 hover:text-red-300"
            title="Xóa mềm">
            <Trash2 size={14} />
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
