import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { ImagePlus, Popcorn, CupSoda, Package, MoreHorizontal } from 'lucide-react'
import { label, STORAGE_STATE_LABELS, fmtVnd } from '@/utils/labels'
import { STORAGE_STATE_COLORS as STATE_COLORS } from '@/utils/colors'
import type { AdminSnack } from '@/hooks/useAdminSnacks'

/** Icon + màu cho mỗi danh mục snack — tách const để tránh re-create mỗi render. */
const CATEGORY_BADGE_CONFIG: Record<string, { icon: typeof Popcorn; color: string }> = {
  'Bắp rang': { icon: Popcorn, color: 'bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/20' },
  'Nước uống': { icon: CupSoda, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  'Combo': { icon: Package, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  'Khác': { icon: MoreHorizontal, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
}

export interface SnackRowProps {
  snack: AdminSnack
  index: number
  selected: boolean
  onToggleSelect: (id: number) => void
  onEdit: (snack: AdminSnack) => void
  onUpload: (id: number) => void
}

/** Row trong bảng AdminSnackPage. Tách để page < 300 dòng và testable độc lập. */
export default function SnackRow({ snack: s, index, selected, onToggleSelect, onEdit, onUpload }: SnackRowProps) {
  return (
    <TableRow className="border-white/5 hover:bg-white/5 group">
      <TableCell className="whitespace-nowrap">
        <input type="checkbox" checked={selected}
          onChange={() => onToggleSelect(s.id)} className="accent-[#ffc107]" />
      </TableCell>
      <TableCell className="text-gray-500 text-sm whitespace-nowrap">{index + 1}</TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onEdit(s)}>
          {s.imageUrl ? (
            <img src={s.imageUrl} alt={s.name} className="w-9 h-9 object-cover rounded-lg shrink-0" />
          ) : (
            <div className="w-9 h-9 bg-[#2a2317] rounded-lg flex items-center justify-center shrink-0">
              <ImagePlus size={12} className="text-gray-600" />
            </div>
          )}
          <span className="text-[#ffc107] hover:underline font-medium">{s.name}</span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {s.category && <CategoryBadge category={s.category} />}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="text-sm font-semibold text-[#ffc107]">
          {fmtVnd(s.price)}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {s.available
          ? <span className="text-xs px-2 py-1 rounded border bg-green-500/10 text-green-400 border-green-500/30">Có</span>
          : <span className="text-xs px-2 py-1 rounded border bg-red-500/10 text-red-400 border-red-500/30">Hết</span>
        }
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`text-xs px-2 py-1 rounded border ${STATE_COLORS[s.storageState] ?? ''}`}>
          {label(STORAGE_STATE_LABELS, s.storageState)}
        </span>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Button size="sm" variant="ghost" onClick={() => onUpload(s.id)}
          className="text-gray-400 hover:text-[#ffc107] h-8 w-8 p-0">
          <ImagePlus size={14} />
        </Button>
      </TableCell>
    </TableRow>
  )
}

function CategoryBadge({ category }: { category: string }) {
  const cfg = CATEGORY_BADGE_CONFIG[category] ?? CATEGORY_BADGE_CONFIG['Khác']
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${cfg.color}`}>
      <Icon size={12} /> {category}
    </span>
  )
}
