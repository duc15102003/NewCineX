import { TableBody, TableCell, TableRow } from '@/components/ui/table'

interface Props {
  rows?: number
  columns: number
}

/**
 * Skeleton rows cho admin tables — hiển thị khi data đang load lần đầu.
 *
 * <p>Trước đó list trống → user tưởng "không có data". Chuẩn UX
 * Linear/Salesforce/GitHub: skeleton row xám nhấp nháy → user biết là
 * "đang load, chưa biết có data hay không".
 *
 * <p>Cell width random để nhìn tự nhiên giống nội dung thật.
 */
export default function TableSkeleton({ rows = 10, columns }: Props) {
  // Width pattern lặp lại — giữ deterministic, tránh shifting layout giữa các re-render.
  const widths = ['w-12', 'w-32', 'w-24', 'w-40', 'w-20', 'w-28', 'w-16', 'w-36', 'w-24', 'w-20', 'w-32']
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className="border-[#3f382d]">
          {Array.from({ length: columns }).map((_, c) => (
            <TableCell key={c} className="whitespace-nowrap">
              <div className={`h-4 ${widths[(r + c) % widths.length]} max-w-full rounded bg-[#2a2317] animate-pulse`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  )
}
