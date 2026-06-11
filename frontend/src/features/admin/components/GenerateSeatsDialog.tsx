import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Film, Layers, Sparkles, Wind, LayoutGrid, Eraser } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import CinemaScreen from '@/components/common/CinemaScreen'

import { useGenerateSeats } from '@/hooks/useAdmin'
import { SEAT_TYPES, SEAT_BG, type SeatTypeKey } from '@/types/seatEditor'

type RoomType = 'TWO_D' | 'THREE_D' | 'IMAX' | 'FOUR_DX'
type Mode = 'preset' | 'custom'

interface PresetInfo {
  key: RoomType
  icon: React.ReactNode
  label: string
  size: string
  totalSeats: number
  features: string[]
  iconBg: string
}

const PRESETS: PresetInfo[] = [
  { key: 'TWO_D',   icon: <Film size={28} />,     iconBg: 'bg-blue-500/20 text-blue-400',     label: 'Phòng 2D',   size: '10 hàng × 12 cột', totalSeats: 100, features: ['20 ghế VIP giữa rạp', '5 cặp ghế đôi hàng J', '2 ghế ♿ khuyết tật', '2 lối đi (cột 4, 9)'] },
  { key: 'THREE_D', icon: <Layers size={28} />,   iconBg: 'bg-purple-500/20 text-purple-400', label: 'Phòng 3D',   size: '10 hàng × 12 cột', totalSeats: 100, features: ['Vùng VIP RỘNG hơn (kính 3D)', '5 cặp ghế đôi hàng J', '2 ghế ♿ khuyết tật', '2 lối đi (cột 4, 9)'] },
  { key: 'IMAX',    icon: <Sparkles size={28} />, iconBg: 'bg-[#ffc107]/20 text-[#ffc107]',   label: 'Phòng IMAX', size: '14 hàng × 18 cột', totalSeats: 240, features: ['Vùng VIP cực lớn', '2 hàng Deluxe (recliner)', '2 ghế ♿ khuyết tật', '2 lối đi (cột 5, 14)'] },
  { key: 'FOUR_DX', icon: <Wind size={28} />,     iconBg: 'bg-pink-500/20 text-pink-400',     label: 'Phòng 4DX',  size: '8 hàng × 10 cột',  totalSeats: 76,  features: ['Ghế đặc biệt rung + gió', 'Vùng VIP giữa', '2 ghế ♿ khuyết tật', '1 lối đi (cột 5)'] },
]

export interface GenerateSeatsDialogProps {
  roomId: number | null
  roomType?: RoomType
  onClose: () => void
}

export default function GenerateSeatsDialog({ roomId, roomType, onClose }: GenerateSeatsDialogProps) {
  const [mode, setMode] = useState<Mode>('preset')
  const [selectedPreset, setSelectedPreset] = useState<RoomType>(roomType ?? 'TWO_D')
  const generateMut = useGenerateSeats()

  useEffect(() => {
    if (roomId != null) {
      setMode('preset')
      setSelectedPreset(roomType ?? 'TWO_D')
    }
  }, [roomId, roomType])

  const presetInfo = PRESETS.find(p => p.key === selectedPreset)!

  return (
    <Dialog open={roomId !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent size="lg" className="bg-[#201b11] border-white/5 text-white rounded-2xl max-w-5xl">
        <DialogHeader>
          <DialogTitle>Tạo sơ đồ ghế</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <ModeTabs mode={mode} onChange={setMode} />

          {mode === 'preset' ? (
            <PresetPanel selected={selectedPreset} onSelect={setSelectedPreset} info={presetInfo} />
          ) : (
            <CustomPanel
              roomId={roomId!}
              onClose={onClose}
              generateMut={generateMut}
            />
          )}
        </DialogBody>
        {mode === 'preset' && (
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}
              className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
            <Button onClick={() => handlePresetSubmit(roomId, selectedPreset, generateMut, onClose)}
              disabled={generateMut.isPending}
              className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
              {generateMut.isPending ? 'Đang tạo...' : `Tạo ${presetInfo.totalSeats} ghế`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function handlePresetSubmit(roomId: number | null, preset: RoomType, mut: ReturnType<typeof useGenerateSeats>, onClose: () => void) {
  if (roomId == null) return
  mut.mutate({
    roomId,
    data: { totalRows: 1, totalCols: 1, applyPresetForRoomType: true, roomTypeOverride: preset },
  }, {
    onSuccess: () => {
      toast.success('Đã tạo sơ đồ ghế. Bấm "Chỉnh sửa từng ghế" để tinh chỉnh.')
      onClose()
    }
  })
}

// ============================================================
//  Mode Tabs
// ============================================================

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 bg-[#2a2317] p-1 rounded-lg">
      <TabBtn active={mode === 'preset'} onClick={() => onChange('preset')}
        icon={<Sparkles size={16} />} label="Chọn Preset" />
      <TabBtn active={mode === 'custom'} onClick={() => onChange('custom')}
        icon={<LayoutGrid size={16} />} label="Vẽ tự do" />
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
        active ? 'bg-[#ffc107] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}>
      {icon} {label}
    </button>
  )
}

// ============================================================
//  Preset Panel
// ============================================================

function PresetPanel({ selected, onSelect, info }: {
  selected: RoomType; onSelect: (t: RoomType) => void; info: PresetInfo;
}) {
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

type MiniCell = 'S' | 'V' | 'C' | 'D' | 'H' | 'A'
const MINI_CELL_COLORS: Record<MiniCell, string> = {
  S: 'bg-green-600', V: 'bg-yellow-600', C: 'bg-pink-600',
  D: 'bg-blue-600', H: 'bg-cyan-600', A: 'bg-transparent border border-dashed border-gray-500',
}
const MINI_CELL_NAMES: Record<MiniCell, string> = {
  S: 'Thường', V: 'VIP', C: 'Đôi', D: 'Deluxe', H: '♿ Khuyết tật', A: 'Lối đi',
}
const MINI_LAYOUTS: Record<RoomType, MiniCell[][]> = {
  TWO_D: [
    ['S','S','S','A','S','S','S','S','S','A','S','S'],['H','S','S','A','S','S','S','S','S','A','S','H'],
    ['S','S','S','A','V','V','V','V','V','A','S','S'],['S','S','S','A','V','V','V','V','V','A','S','S'],
    ['S','S','S','A','V','V','V','V','V','A','S','S'],['S','S','S','A','V','V','V','V','V','A','S','S'],
    ['S','S','S','A','V','V','V','V','V','A','S','S'],['S','S','S','A','S','S','S','S','S','A','S','S'],
    ['S','S','S','A','S','S','S','S','S','A','S','S'],['C','C','C','A','C','C','C','C','C','A','C','C'],
  ],
  THREE_D: [
    ['S','S','S','A','S','S','S','S','S','A','S','S'],['H','S','S','A','S','S','S','S','S','A','S','H'],
    ['S','S','V','A','V','V','V','V','V','A','V','S'],['S','S','V','A','V','V','V','V','V','A','V','S'],
    ['S','S','V','A','V','V','V','V','V','A','V','S'],['S','S','V','A','V','V','V','V','V','A','V','S'],
    ['S','S','V','A','V','V','V','V','V','A','V','S'],['S','S','V','A','V','V','V','V','V','A','V','S'],
    ['S','S','S','A','S','S','S','S','S','A','S','S'],['C','C','C','A','C','C','C','C','C','A','C','C'],
  ],
  IMAX: [
    ['S','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','S'],['S','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','S'],
    ['H','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','H'],['S','S','S','S','A','V','V','V','V','V','V','V','V','V','A','S','S','S'],
    ['S','S','S','S','A','V','V','V','V','V','V','V','V','V','A','S','S','S'],['S','S','S','S','A','D','D','D','D','D','D','D','D','D','A','S','S','S'],
    ['S','S','S','S','A','D','D','D','D','D','D','D','D','D','A','S','S','S'],['S','S','S','S','A','V','V','V','V','V','V','V','V','V','A','S','S','S'],
    ['S','S','S','S','A','V','V','V','V','V','V','V','V','V','A','S','S','S'],['S','S','S','S','A','V','V','V','V','V','V','V','V','V','A','S','S','S'],
    ['S','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','S'],['S','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','S'],
    ['S','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','S'],['S','S','S','S','A','S','S','S','S','S','S','S','S','S','A','S','S','S'],
  ],
  FOUR_DX: [
    ['S','S','S','S','A','S','S','S','S','S'],['H','S','S','S','A','S','S','S','S','H'],
    ['S','S','V','V','A','V','V','V','S','S'],['S','S','V','V','A','V','V','V','S','S'],
    ['S','S','V','V','A','V','V','V','S','S'],['S','S','V','V','A','V','V','V','S','S'],
    ['S','S','S','S','A','S','S','S','S','S'],['S','S','S','S','A','S','S','S','S','S'],
  ],
}

// ============================================================
//  Custom Panel — Visual grid editor
// ============================================================

const TOOL_KEYS_TYPES: SeatTypeKey[] = ['STANDARD', 'VIP', 'COUPLE', 'SWEETBOX', 'DELUXE', 'HANDICAP']
const TOOL_KEYS_SPECIAL: SeatTypeKey[] = ['AISLE', 'BROKEN', 'BLOCKED']

function CustomPanel({ roomId, onClose, generateMut }: {
  roomId: number; onClose: () => void;
  generateMut: ReturnType<typeof useGenerateSeats>;
}) {
  const [rows, setRows] = useState(10)
  const [cols, setCols] = useState(12)
  const [tool, setTool] = useState<SeatTypeKey>('STANDARD')
  const [cells, setCells] = useState<Map<string, SeatTypeKey>>(() => initCells(10, 12))
  const [isDragging, setIsDragging] = useState(false)

  // Re-init khi rows/cols đổi (giữ lại data của cells trùng vị trí)
  useEffect(() => {
    setCells(prev => {
      const next = new Map<string, SeatTypeKey>()
      for (let r = 0; r < rows; r++) {
        const rowLabel = String.fromCharCode(65 + r)
        for (let c = 1; c <= cols; c++) {
          const key = `${rowLabel}:${c}`
          next.set(key, prev.get(key) ?? 'STANDARD')
        }
      }
      return next
    })
  }, [rows, cols])

  function applyTool(rowLabel: string, col: number) {
    const key = `${rowLabel}:${col}`
    const isDouble = tool === 'COUPLE' || tool === 'SWEETBOX'

    // Check validation NGOÀI setCells — tránh React StrictMode chạy updater 2 lần → toast 2 lần
    if (isDouble) {
      const partnerCol = findPartnerInBlock(rowLabel, col, cells, cols)
      if (partnerCol === null) {
        toast.warning(
          `${rowLabel}${col} không thể đặt ${tool === 'SWEETBOX' ? 'Sweetbox' : 'ghế đôi'} ` +
          `— ghế lẻ cuối dải không có cặp (ghế đôi không vắt qua lối đi).`
        )
        return  // skip state update
      }
    }

    setCells(prev => {
      const next = new Map(prev)

      if (isDouble) {
        const partnerCol = findPartnerInBlock(rowLabel, col, prev, cols)
        if (partnerCol === null) return prev // race-condition guard: block đổi giữa check & apply
        next.set(key, tool)
        next.set(`${rowLabel}:${partnerCol}`, tool)
      } else {
        // Tool khác: nếu cell đang là COUPLE/SWEETBOX → un-pair partner cùng type trong cùng block
        const current = prev.get(key)
        if (current === 'COUPLE' || current === 'SWEETBOX') {
          const partnerCol = findPartnerInBlock(rowLabel, col, prev, cols)
          if (partnerCol !== null && prev.get(`${rowLabel}:${partnerCol}`) === current) {
            next.set(`${rowLabel}:${partnerCol}`, tool)
          }
        }
        next.set(key, tool)
      }
      return next
    })
  }

  function handleReset() {
    setCells(initCells(rows, cols))
    toast.info('Đã reset toàn bộ về STANDARD')
  }

  function handleSubmit() {
    const customLayout: Array<{ row: string; col: number; seatType?: string; status?: string; aisle?: boolean }> = []
    for (let r = 0; r < rows; r++) {
      const rowLabel = String.fromCharCode(65 + r)
      for (let c = 1; c <= cols; c++) {
        const tk = cells.get(`${rowLabel}:${c}`) ?? 'STANDARD'
        const cell: typeof customLayout[number] = { row: rowLabel, col: c }
        if (tk === 'AISLE') {
          cell.aisle = true
          cell.seatType = 'STANDARD'
          cell.status = 'AVAILABLE'
        } else if (tk === 'BROKEN' || tk === 'BLOCKED') {
          cell.seatType = 'STANDARD'
          cell.status = tk
          cell.aisle = false
        } else {
          cell.seatType = tk
          cell.status = 'AVAILABLE'
          cell.aisle = false
        }
        customLayout.push(cell)
      }
    }
    generateMut.mutate({ roomId, data: { totalRows: rows, totalCols: cols, customLayout } }, {
      onSuccess: () => {
        toast.success(`Đã tạo ${customLayout.length} vị trí.`)
        onClose()
      }
    })
  }

  // Stats
  const stats = useMemo(() => countByType(cells), [cells])
  const bookableCount = Array.from(cells.values()).filter(t => t !== 'AISLE' && t !== 'BLOCKED').length

  return (
    <div className="space-y-3" onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}>
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Số hàng" value={rows} min={1} max={26} onChange={setRows} />
        <NumField label="Số cột" value={cols} min={1} max={30} onChange={setCols} />
      </div>

      <div className="flex gap-4">
        {/* Tool palette */}
        <div className="w-44 shrink-0 space-y-3">
          <div className="bg-[#2a2317] border border-white/5 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Loại ghế</p>
            <div className="space-y-1">
              {TOOL_KEYS_TYPES.map(k => (
                <ToolBtn key={k} toolKey={k} active={tool === k} onClick={() => setTool(k)} />
              ))}
            </div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-3 mb-2">Đặc biệt</p>
            <div className="space-y-1">
              {TOOL_KEYS_SPECIAL.map(k => (
                <ToolBtn key={k} toolKey={k} active={tool === k} onClick={() => setTool(k)} />
              ))}
            </div>
          </div>

          <Button type="button" variant="outline" onClick={handleReset}
            className="w-full border-white/10 text-gray-300 hover:bg-white/5 text-xs">
            <Eraser size={12} className="mr-1" /> Reset tất cả
          </Button>

          <div className="bg-[#2a2317] border border-white/5 rounded-lg p-3 text-xs">
            <p className="text-gray-400 mb-1">Tổng vị trí: <strong className="text-white">{cells.size}</strong></p>
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

        {/* Visual grid */}
        <div className="flex-1 overflow-auto bg-[#181309] border border-white/5 rounded-lg p-4">
          <CinemaScreen size="sm" />

          <div className="flex justify-center">
            <div className="select-none inline-block">
              {/* Col header — căn giữa với 2 cột row label (5px mỗi bên + gap-1) */}
              <div className="flex gap-0.5 mb-1 justify-center">
                <span className="w-5 shrink-0" aria-hidden="true" />
                <span className="w-1 shrink-0" aria-hidden="true" />
                {Array.from({ length: cols }).map((_, i) => (
                  <div key={i} className="w-5 text-center text-[9px] text-gray-500 font-mono">{i + 1}</div>
                ))}
                <span className="w-1 shrink-0" aria-hidden="true" />
                <span className="w-5 shrink-0" aria-hidden="true" />
              </div>
              {Array.from({ length: rows }).map((_, rIdx) => {
                const rowLabel = String.fromCharCode(65 + rIdx)
                return (
                  <div key={rowLabel} className="flex items-center gap-1 mb-0.5 justify-center">
                    <span className="w-5 text-center text-[10px] text-gray-500 font-mono shrink-0">{rowLabel}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: cols }).map((_, cIdx) => {
                        const col = cIdx + 1
                        const cellKey = `${rowLabel}:${col}`
                        const tk = cells.get(cellKey) ?? 'STANDARD'
                        return (
                          <button
                            key={cellKey}
                            type="button"
                            onMouseDown={() => { setIsDragging(true); applyTool(rowLabel, col) }}
                            onMouseEnter={() => { if (isDragging) applyTool(rowLabel, col) }}
                            title={`${cellKey} — ${SEAT_TYPES.find(t => t.key === tk)?.label}`}
                            className={`w-5 h-5 rounded-sm transition-colors ${SEAT_BG[tk]}`}
                          />
                        )
                      })}
                    </div>
                    <span className="w-5 text-center text-[10px] text-gray-500 font-mono shrink-0">{rowLabel}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <p className="text-[10px] text-gray-500 italic mt-3 text-center">
            Click hoặc kéo chuột để vẽ. Đôi/Sweetbox tự ghép cặp 2 ô liền kề trong cùng dải — không vắt qua lối đi.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
        <Button type="button" variant="outline" onClick={onClose}
          className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
        <Button onClick={handleSubmit} disabled={generateMut.isPending}
          className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
          {generateMut.isPending ? 'Đang tạo...' : `Tạo ${bookableCount} ghế bán được`}
        </Button>
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

function NumField({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <Input type="number" min={min} max={max} value={value || ''}
        onChange={e => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)))
        }} className="h-9 text-sm" />
    </div>
  )
}

/**
 * Tìm cột partner cho ghế đôi/sweetbox theo block (giữa các lối đi).
 *
 * <p>Mở rộng trái-phải từ {@code col} đến khi gặp AISLE hoặc biên grid → xác định block.
 * Trong block, vị trí lẻ → partner = col+1; vị trí chẵn → partner = col-1.
 * Nếu partner ra ngoài block (block lẻ ghế, col đứng cuối) → null (UI báo không thể đặt).
 *
 * <p>Mô phỏng thực tế rạp: ghế đôi vật lý chiếm 2 chỗ liền nhau, KHÔNG vắt qua lối đi.
 */
function findPartnerInBlock(
  rowLabel: string,
  col: number,
  cells: Map<string, SeatTypeKey>,
  totalCols: number,
): number | null {
  let leftBound = col
  while (leftBound > 1 && cells.get(`${rowLabel}:${leftBound - 1}`) !== 'AISLE') {
    leftBound--
  }
  let rightBound = col
  while (rightBound < totalCols && cells.get(`${rowLabel}:${rightBound + 1}`) !== 'AISLE') {
    rightBound++
  }
  const posInBlock = col - leftBound + 1
  const isOddInBlock = posInBlock % 2 === 1
  const partnerCol = isOddInBlock ? col + 1 : col - 1
  if (partnerCol < leftBound || partnerCol > rightBound) return null
  return partnerCol
}

function initCells(rows: number, cols: number): Map<string, SeatTypeKey> {
  const m = new Map<string, SeatTypeKey>()
  for (let r = 0; r < rows; r++) {
    const rowLabel = String.fromCharCode(65 + r)
    for (let c = 1; c <= cols; c++) m.set(`${rowLabel}:${c}`, 'STANDARD')
  }
  return m
}

function countByType(cells: Map<string, SeatTypeKey>): Record<string, number> {
  const result: Record<string, number> = {}
  cells.forEach(v => { result[v] = (result[v] ?? 0) + 1 })
  return result
}
