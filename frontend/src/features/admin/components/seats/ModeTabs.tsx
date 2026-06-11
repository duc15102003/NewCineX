import { Sparkles, LayoutGrid } from 'lucide-react'
import type { Mode } from './data'

/** Tab switcher giữa "Chọn Preset" và "Vẽ tự do". */
export default function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
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
