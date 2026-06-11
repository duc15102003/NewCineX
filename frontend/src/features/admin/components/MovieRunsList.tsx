import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Archive } from 'lucide-react'
import { MOVIE_RUN_STATUS_LABELS, MOVIE_RUN_TYPE_LABELS, fmtDate, label } from '@/utils/labels'
import { MOVIE_RUN_STATUS_COLORS, MOVIE_RUN_TYPE_COLORS } from '@/utils/colors'
import type { MovieRun } from '@/types/movie'

export interface MovieRunsListProps {
  runs: MovieRun[]
  isLoading: boolean
  onCreate: () => void
  onEdit: (run: MovieRun) => void
  onArchive: (run: MovieRun) => void
}

/** Bảng các đợt chiếu — list mode trong MovieRunsDialog. */
export default function MovieRunsList({ runs, isLoading, onCreate, onEdit, onArchive }: MovieRunsListProps) {
  return (
    <>
      <div className="flex justify-end mb-3">
        <Button onClick={onCreate} className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
          <Plus size={16} className="mr-1" /> Thêm đợt chiếu
        </Button>
      </div>

      <div className="rounded-xl border border-white/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Thời gian</TableHead>
              <TableHead className="text-gray-400">Loại</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
              <TableHead className="text-gray-400">Ghi chú</TableHead>
              <TableHead className="text-gray-400 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">Đang tải...</TableCell>
              </TableRow>
            )}
            {!isLoading && runs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  Chưa có đợt chiếu nào. Bấm "Thêm đợt chiếu" để bắt đầu.
                </TableCell>
              </TableRow>
            )}
            {runs.map((r, idx) => (
              <MovieRunRow key={r.id} run={r} index={idx} onEdit={onEdit} onArchive={onArchive} />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

interface MovieRunRowProps {
  run: MovieRun
  index: number
  onEdit: (run: MovieRun) => void
  onArchive: (run: MovieRun) => void
}

function MovieRunRow({ run, index, onEdit, onArchive }: MovieRunRowProps) {
  const isArchived = run.storageState === 'ARCHIVED'
  return (
    <TableRow className={`border-white/5 hover:bg-white/5 ${isArchived ? 'opacity-50' : ''}`}>
      <TableCell className="text-gray-500 text-sm">{index + 1}</TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="text-sm">
          <span className="text-white">{fmtDate(run.startDate)}</span>
          <span className="text-gray-500 mx-1">→</span>
          {run.endDate ? (
            <span className="text-white">{fmtDate(run.endDate)}</span>
          ) : (
            <span className="text-gray-400 italic">chưa định ngày ngưng</span>
          )}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`text-xs px-2 py-1 rounded-md border ${MOVIE_RUN_TYPE_COLORS[run.runType] ?? ''}`}>
          {label(MOVIE_RUN_TYPE_LABELS, run.runType)}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={`text-xs px-2 py-1 rounded-md border ${MOVIE_RUN_STATUS_COLORS[run.status] ?? ''}`}>
          {label(MOVIE_RUN_STATUS_LABELS, run.status)}
        </span>
      </TableCell>
      <TableCell className="text-gray-400 text-sm max-w-xs truncate">{run.notes}</TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Button size="sm" variant="ghost" onClick={() => onEdit(run)}
          className="text-gray-400 hover:text-[#ffc107] h-8 w-8 p-0" title="Sửa" disabled={isArchived}>
          <Pencil size={14} />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onArchive(run)}
          className="text-gray-400 hover:text-red-400 h-8 w-8 p-0" title="Lưu trữ" disabled={isArchived}>
          <Archive size={14} />
        </Button>
      </TableCell>
    </TableRow>
  )
}
