import CinemaScreen from '@/components/common/CinemaScreen'
import { PRESETS, MINI_CELL_COLORS, MINI_CELL_NAMES, MINI_LAYOUTS, type RoomType, type PresetInfo } from './data'

export interface PresetPanelProps {
  selected: RoomType
  onSelect: (t: RoomType) => void
  info: PresetInfo
}

/** Panel chính khi mode = 'preset': 4 card chọn loại phòng + preview layout. */
export default function PresetPanel({ selected, onSelect, info }: PresetPanelProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {PRESETS.map(p => (
          <PresetCard key={p.key} info={p} active={selected === p.key} onClick={() => onSelect(p.key)} />
        ))}
      </div>
      <PreviewBox info={info} />
    </div>
  )
}

function PresetCard({ info, active, onClick }: { info: PresetInfo; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-left p-4 rounded-xl border-2 transition-all ${
        active ? 'bg-[#ffc107]/10 border-[#ffc107] shadow-lg shadow-[#ffc107]/10' : 'bg-[#2a2317] border-white/5 hover:border-white/20'
      }`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${info.iconBg}`}>{info.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm flex items-center gap-2">
            {info.label}
            {active && <span className="text-[#ffc107] text-xs">● Đã chọn</span>}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{info.size}</div>
          <div className="text-xs text-green-400 font-medium mt-0.5">~{info.totalSeats} ghế bán được</div>
        </div>
      </div>
      <ul className="space-y-0.5 text-[11px] text-gray-400 ml-1">
        {info.features.map(f => (
          <li key={f} className="flex items-start gap-1.5">
            <span className="text-[#ffc107] mt-0.5">·</span><span>{f}</span>
          </li>
        ))}
      </ul>
    </button>
  )
}

function PreviewBox({ info }: { info: PresetInfo }) {
  return (
    <div className="p-3 bg-[#181309] rounded-lg border border-white/5">
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Xem trước layout</p>
      <PresetMiniMap roomType={info.key} />
    </div>
  )
}

function PresetMiniMap({ roomType }: { roomType: RoomType }) {
  const layout = MINI_LAYOUTS[roomType]
  return (
    <div className="flex flex-col items-center">
      <CinemaScreen size="md" />
      <div className="inline-block">
        {layout.map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-1 mb-1 justify-center">
            {row.map((cell, colIdx) => (
              <span key={colIdx} className={`w-5 h-5 rounded-sm ${MINI_CELL_COLORS[cell]}`} title={MINI_CELL_NAMES[cell]} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-400 justify-center">
        <MiniLegend color="bg-green-600" label="Thường" />
        <MiniLegend color="bg-yellow-600" label="VIP" />
        <MiniLegend color="bg-pink-600" label="Đôi" />
        <MiniLegend color="bg-blue-600" label="Deluxe" />
        <MiniLegend color="bg-cyan-600" label="♿" />
        <MiniLegend color="bg-transparent border border-dashed border-gray-500" label="Lối đi" />
      </div>
    </div>
  )
}

function MiniLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />{label}
    </span>
  )
}
