import { Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SEAT_TYPES, type SeatTypeKey } from '@/types/seatEditor'

const TOOL_KEYS_TYPES: SeatTypeKey[] = ['STANDARD', 'VIP', 'COUPLE', 'SWEETBOX', 'DELUXE', 'HANDICAP']
const TOOL_KEYS_SPECIAL: SeatTypeKey[] = ['AISLE', 'BROKEN', 'BLOCKED']

export interface ToolPaletteProps {
  tool: SeatTypeKey
  onSelectTool: (t: SeatTypeKey) => void
  totalCells: number
  bookableCount: number
  stats: Record<string, number>
  onReset: () => void
}

/** Sidebar trái: chọn tool (6 loại ghế + 3 special), reset, thống kê. */
export default function ToolPalette({
  tool, onSelectTool, totalCells, bookableCount, stats, onReset,
}: ToolPaletteProps) {
  return (
    <div className="w-44 shrink-0 space-y-3">
      <div className="bg-[#2a2317] border border-white/5 rounded-lg p-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Loại ghế</p>
        <div className="space-y-1">
          {TOOL_KEYS_TYPES.map(k => (
            <ToolBtn key={k} toolKey={k} active={tool === k} onClick={() => onSelectTool(k)} />
          ))}
        </div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-3 mb-2">Đặc biệt</p>
        <div className="space-y-1">
          {TOOL_KEYS_SPECIAL.map(k => (
            <ToolBtn key={k} toolKey={k} active={tool === k} onClick={() => onSelectTool(k)} />
          ))}
        </div>
      </div>

      <Button type="button" variant="outline" onClick={onReset}
        className="w-full border-white/10 text-gray-300 hover:bg-white/5 text-xs">
        <Eraser size={12} className="mr-1" /> Reset tất cả
      </Button>

      <div className="bg-[#2a2317] border border-white/5 rounded-lg p-3 text-xs">
        <p className="text-gray-400 mb-1">Tổng vị trí: <strong className="text-white">{totalCells}</strong></p>
        <p className="text-gray-400">Bán được: <strong className="text-green-400">{bookableCount}</strong></p>
        <div className="border-t border-white/5 mt-2 pt-2 space-y-0.5">
          {Object.entries(stats).filter(([, v]) => v > 0).map(([k, v]) => (
            <div key={k} className="flex justify-between text-[11px]">
              <span className="text-gray-500">{SEAT_TYPES.find(t => t.key === k)?.label}</span>
              <span className="text-gray-300">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ToolBtn({ toolKey, active, onClick }: { toolKey: SeatTypeKey; active: boolean; onClick: () => void }) {
  const meta = SEAT_TYPES.find(t => t.key === toolKey)!
  const isDouble = meta.width === 2
  return (
    <button type="button" onClick={onClick}
      title={meta.hint}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all ${
        active ? 'bg-white/10 ring-1 ring-[#ffc107] text-white' : 'text-gray-400 hover:bg-white/5'
      }`}>
      <span className={`${isDouble ? 'w-7' : 'w-4'} h-4 rounded shrink-0 ${meta.bgClass}`} />
      <span className="font-medium">{meta.label}</span>
    </button>
  )
}
