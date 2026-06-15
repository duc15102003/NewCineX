import type { SeatTypeKey, SeatTypeMeta } from '@/types/seatEditor'

export interface SeatEditorToolPanelProps {
  types: SeatTypeMeta[]
  activeTool: SeatTypeKey
  onSelectTool: (key: SeatTypeKey) => void
}

/**
 * Left sidebar editor: chọn loại ghế (tool picker).
 *
 * <p>Stats panel đã tách ra component {@link SeatStatsStrip} đặt ở top
 * (cạnh resize bar) — khi tăng/giảm số hàng/cột thấy tổng update inline,
 * không phải đảo mắt xuống sidebar.
 *
 * <p>Bỏ Instructions panel + Preview mode — tool button đã có tooltip hint,
 * visual cues (ring vàng pending, ring đỏ orphan) đã chỉ rõ hành vi.
 */
export default function SeatEditorToolPanel(props: SeatEditorToolPanelProps) {
  return (
    <div className="w-56 shrink-0">
      <ToolPicker
        types={props.types}
        activeTool={props.activeTool}
        onSelectTool={props.onSelectTool}
      />
    </div>
  )
}

interface ToolPickerProps {
  types: SeatTypeMeta[]
  activeTool: SeatTypeKey
  onSelectTool: (key: SeatTypeKey) => void
}

/** Group tools theo nhóm: 6 SeatType + 3 special (AISLE/BROKEN/BLOCKED) */
function ToolPicker({ types, activeTool, onSelectTool }: ToolPickerProps) {
  const seatTypes = types.filter(t => !['AISLE', 'BROKEN', 'BLOCKED'].includes(t.key))
  const specialTypes = types.filter(t => ['AISLE', 'BROKEN', 'BLOCKED'].includes(t.key))

  return (
    <div className="bg-[#201b11] border border-[#3f382d] rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Công cụ vẽ</h3>

      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Loại ghế</p>
      <div className="space-y-1.5 mb-4">
        {seatTypes.map((t) => (
          <ToolButton key={t.key} meta={t} active={activeTool === t.key}
            onClick={() => onSelectTool(t.key)} />
        ))}
      </div>

      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Đặc biệt</p>
      <div className="space-y-1.5">
        {specialTypes.map((t) => (
          <ToolButton key={t.key} meta={t} active={activeTool === t.key}
            onClick={() => onSelectTool(t.key)} />
        ))}
      </div>
    </div>
  )
}

interface ToolButtonProps { meta: SeatTypeMeta; active: boolean; onClick: () => void }

function ToolButton({ meta, active, onClick }: ToolButtonProps) {
  const isDouble = meta.width === 2
  return (
    <button
      onClick={onClick}
      title={meta.hint}
      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${
        active
          ? 'bg-white/10 ring-1 ring-[#ffc107] text-white'
          : 'text-gray-400 hover:bg-white/5'
      }`}
    >
      <span className={`${isDouble ? 'w-10' : 'w-5'} h-5 rounded ${meta.bgClass} shrink-0`} />
      <div className="flex-1 text-left">
        <div className="font-medium">{meta.label}</div>
        {meta.hint && <div className="text-[9px] text-gray-500 leading-tight mt-0.5">{meta.hint}</div>}
      </div>
    </button>
  )
}

