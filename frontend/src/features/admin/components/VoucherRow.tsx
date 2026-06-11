import { TableCell, TableRow } from '@/components/ui/table'
import { Percent, Banknote, Globe2, Building2 } from 'lucide-react'
import { label, DISCOUNT_TYPE_LABELS, STORAGE_STATE_LABELS, fmtDate, fmtVnd } from '@/utils/labels'
import { STORAGE_STATE_COLORS as STATE_COLORS } from '@/utils/colors'
import type { AdminVoucher } from '@/hooks/useAdminVouchers'

function formatUsage(v: AdminVoucher): string {
  const used = v.usedCount ?? 0
  return v.usageLimit ? `${used}/${v.usageLimit}` : `${used}/∞`
}

export interface VoucherRowProps {
  voucher: AdminVoucher
  index: number
  selected: boolean
  onToggleSelect: (id: number) => void
  onEdit: (v: AdminVoucher) => void
}

/** Row trong bảng AdminVoucherPage — code, scope, discount, usage, expiry. */
export default function VoucherRow({ voucher: v, index, selected, onToggleSelect, onEdit }: VoucherRowProps) {
  return (
    <TableRow className="border-[#3f382d] hover:bg-white/5 group">
      <TableCell className="whitespace-nowrap">
        <input type="checkbox" checked={selected}
          onChange={() => onToggleSelect(v.id)} className="accent-[#ffc107]" />
      </TableCell>
      <TableCell className="text-gray-500 text-sm whitespace-nowrap">{index + 1}</TableCell>
      <TableCell className="whitespace-nowrap">
        <span onClick={() => onEdit(v)}
          className="text-[#ffc107] hover:underline cursor-pointer font-medium">
          {v.code}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {v.theaterId == null ? (
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30">
            <Globe2 size={12} /> Toàn hệ thống
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border bg-blue-500/10 text-blue-400 border-blue-500/30">
            <Building2 size={12} /> {v.theaterName}
          </span>
        )}
      </TableCell>
      <TableCell className="text-gray-400 text-sm whitespace-nowrap">{v.description}</TableCell>
      <TableCell className="whitespace-nowrap">
        {v.discountType === 'PERCENTAGE' ? (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border bg-blue-500/10 text-blue-400 border-blue-500/30">
            <Percent size={12} />
            {label(DISCOUNT_TYPE_LABELS, v.discountType)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30">
            <Banknote size={12} />
            {label(DISCOUNT_TYPE_LABELS, v.discountType)}
          </span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="text-sm font-semibold text-[#ffc107]">
          {v.discountType === 'PERCENTAGE'
            ? `${v.discountValue}%`
            : fmtVnd(v.discountValue ?? 0)}
        </span>
      </TableCell>
      <TableCell className="text-gray-300 text-sm whitespace-nowrap">{formatUsage(v)}</TableCell>
      <TableCell className="text-gray-400 text-sm whitespace-nowrap">{fmtDate(v.endDate)}</TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`text-xs px-2 py-1 rounded border ${STATE_COLORS[v.storageState] ?? ''}`}>
          {label(STORAGE_STATE_LABELS, v.storageState)}
        </span>
      </TableCell>
    </TableRow>
  )
}
