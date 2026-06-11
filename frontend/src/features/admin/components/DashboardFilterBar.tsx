import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Filter, FileDown } from 'lucide-react'

const QUICK_RANGES = [
  { label: '7 ngày', days: 7 },
  { label: '14 ngày', days: 14 },
  { label: '30 ngày', days: 30 },
]

export interface DashboardFilterBarProps {
  from: string
  to: string
  activeDays: number
  onDateChange: (field: 'from' | 'to', value: string) => void
  onQuickRange: (days: number) => void
  onExportPdf: () => void
  onExportExcel: () => void
}

/** Filter bar: date range picker + quick range buttons + export PDF/Excel. */
export default function DashboardFilterBar(props: DashboardFilterBarProps) {
  const { from, to, activeDays, onDateChange, onQuickRange, onExportPdf, onExportExcel } = props
  return (
    <Card className="bg-[#201b11] border border-white/5 rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter size={16} className="text-[#ffc107]" />
            <span className="text-white/60 text-sm font-medium">Thời gian:</span>
            <div className="flex items-center gap-2">
              <Input type="date" value={from}
                onChange={(e) => onDateChange('from', e.target.value)}
                className="h-8 text-xs w-36" />
              <span className="text-gray-500 text-xs">đến</span>
              <Input type="date" value={to}
                onChange={(e) => onDateChange('to', e.target.value)}
                className="h-8 text-xs w-36" />
            </div>
            <div className="flex items-center gap-1.5">
              {QUICK_RANGES.map(q => (
                <button key={q.days} onClick={() => onQuickRange(q.days)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeDays === q.days
                      ? 'bg-[#ffc107] text-black'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-white/10 text-gray-300 hover:bg-white/5"
              onClick={onExportPdf}>
              <FileDown size={14} className="mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="border-white/10 text-gray-300 hover:bg-white/5"
              onClick={onExportExcel}>
              <FileDown size={14} className="mr-1" /> Excel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
