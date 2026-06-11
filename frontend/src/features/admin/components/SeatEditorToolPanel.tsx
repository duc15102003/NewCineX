import type { SeatTypeKey, SeatTypeMeta } from '@/types/seatEditor'
import type { SeatItem } from '@/hooks/useAdmin'

export interface SeatEditorToolPanelProps {
  types: SeatTypeMeta[]
  activeTool: SeatTypeKey
  onSelectTool: (key: SeatTypeKey) => void
  rows: [string, SeatItem[]][]
  totalSeats: number
  getDisplayType: (seat: SeatItem) => SeatTypeKey
  /** Preview = đang xem giao diện khách hàng → disable tool, vẫn show stats. */
  previewMode: boolean
}

/** Left sidebar editor: chọn loại ghế + hướng dẫn + thống kê. */
export default function SeatEditorToolPanel(props: SeatEditorToolPanelProps) {
  return (
    <div className="w-64 shrink-0 space-y-4">
      <ToolPicker
        types={props.types}
        activeTool={props.activeTool}
        onSelectTool={props.onSelectTool}
        previewMode={props.previewMode}
      />
      {!props.previewMode && <Instructions />}
      <Stats
        types={props.types}
        rows={props.rows}
        totalSeats={props.totalSeats}
        getDisplayType={props.getDisplayType}
      />
    </div>
  )
}

interface ToolPickerProps {
  types: SeatTypeMeta[]
  activeTool: SeatTypeKey
  onSelectTool: (key: SeatTypeKey) => void
  previewMode: boolean
}

/** Group tools theo nhóm: 6 SeatType + 3 special (AISLE/BROKEN/BLOCKED) */
function ToolPicker({ types, activeTool, onSelectTool, previewMode }: ToolPickerProps) {
  const seatTypes = types.filter(t => !['AISLE', 'BROKEN', 'BLOCKED'].includes(t.key))
  const specialTypes = types.filter(t => ['AISLE', 'BROKEN', 'BLOCKED'].includes(t.key))

  return (
    <div className="bg-[#201b11] border border-[#3f382d] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Công cụ vẽ</h3>
        {previewMode && (
          <span className="text-[10px] px-2 py-0.5 rounded-md border bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30">
            Đang xem trước
          </span>
        )}
      </div>

      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Loại ghế</p>
      <div className="space-y-1.5 mb-4">
        {seatTypes.map((t) => (
          <ToolButton key={t.key} meta={t} active={activeTool === t.key}
            disabled={previewMode} onClick={() => onSelectTool(t.key)} />
        ))}
      </div>

      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Đặc biệt</p>
      <div className="space-y-1.5">
        {specialTypes.map((t) => (
          <ToolButton key={t.key} meta={t} active={activeTool === t.key}
            disabled={previewMode} onClick={() => onSelectTool(t.key)} />
        ))}
      </div>
    </div>
  )
}

interface ToolButtonProps { meta: SeatTypeMeta; active: boolean; disabled: boolean; onClick: () => void }

function ToolButton({ meta, active, disabled, onClick }: ToolButtonProps) {
  const isDouble = meta.width === 2
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={meta.hint}
      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${
        active
          ? 'bg-white/10 ring-1 ring-[#ffc107] text-white'
          : 'text-gray-400 hover:bg-white/5'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className={`${isDouble ? 'w-10' : 'w-5'} h-5 rounded ${meta.bgClass} shrink-0`} />
      <div className="flex-1 text-left">
        <div className="font-medium">{meta.label}</div>
        {meta.hint && <div className="text-[9px] text-gray-500 leading-tight mt-0.5">{meta.hint}</div>}
      </div>
    </button>
  )
}

function Instructions() {
  return (
    <div className="bg-[#201b11] border border-[#3f382d] rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Hướng dẫn</h3>
      <ul className="space-y-1.5 text-xs text-gray-400">
        <li><strong className="text-white">Click</strong> hoặc <strong className="text-white">kéo chuột</strong> để vẽ</li>
        <li><strong className="text-pink-400">Đôi / Sweetbox</strong> tự ghép 2 ô liền kề</li>
        <li><strong className="text-gray-300">Lối đi</strong> không bán được</li>
        <li>Nhấn <strong className="text-[#ffc107]">Lưu</strong> để áp dụng</li>
      </ul>
    </div>
  )
}

interface StatsProps {
  types: SeatTypeMeta[]
  rows: [string, SeatItem[]][]
  totalSeats: number
  getDisplayType: (seat: SeatItem) => SeatTypeKey
}

function Stats({ types, rows, totalSeats, getDisplayType }: StatsProps) {
  return (
    <div className="bg-[#201b11] border border-[#3f382d] rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Thống kê</h3>
      {types.map(({ key, label, bgClass, width }) => {
        const count = rows.reduce(
          (sum, [, seats]) => sum + seats.filter(s => getDisplayType(s) === key).length,
          0,
        )
        if (count === 0) return null  // ẩn các loại đang không có
        const isDouble = width === 2
        const displayCount = isDouble ? `${count} (${Math.floor(count / 2)} đôi)` : String(count)
        return (
          <div key={key} className="flex items-center justify-between py-1 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded ${bgClass}`} />
              <span className="text-gray-400">{label}</span>
            </div>
            <span className="text-white font-medium">{displayCount}</span>
          </div>
        )
      })}
      <div className="border-t border-white/5 mt-2 pt-2 flex justify-between text-xs">
        <span className="text-gray-400">Tổng (bán được)</span>
        <span className="text-white font-bold">{totalSeats}</span>
      </div>
    </div>
  )
}
