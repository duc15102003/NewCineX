import { useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Check, Eye, EyeOff, Info, Pencil, X, Settings } from 'lucide-react'
import { toast } from 'sonner'
import TableSkeleton from '@/components/common/TableSkeleton'
import { useAdminConfigs, useUpdateConfig, type AdminConfigItem } from '@/hooks/useConfig'
import { usePageTitle } from '@/hooks/usePageTitle'

/**
 * Tên nhóm hiển thị (label người dùng đọc). Key trùng với {@code category} từ BE.
 * Nhóm không khai báo ở đây sẽ rơi xuống "Khác" — fallback an toàn cho category mới
 * BE seed mà FE chưa kịp đặt label.
 */
const CATEGORY_LABELS: Record<string, string> = {
  booking: 'Đặt vé',
  showtime: 'Suất chiếu',
  loyalty: 'Tích điểm thành viên',
  security: 'Bảo mật & đăng nhập',
  dashboard: 'Báo cáo & dashboard',
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  booking: 'Quy tắc đặt vé — thời gian giữ ghế, giới hạn ghế, xử lý vé không đến.',
  showtime: 'Quy tắc xếp lịch — khoảng cách giữa các suất chiếu trong cùng phòng.',
  loyalty: 'Chương trình tích điểm thành viên — tốc độ tích, ngưỡng lên hạng.',
  security: 'Bảo vệ tài khoản — chống dò mật khẩu, giới hạn quên mật khẩu.',
  dashboard: 'Cấu hình hiển thị dashboard và cache thống kê.',
}

/** Thứ tự nhóm hiển thị từ trên xuống. */
const CATEGORY_ORDER: string[] = ['booking', 'showtime', 'loyalty', 'security', 'dashboard']

export default function AdminConfigPage() {
  usePageTitle('Cấu hình hệ thống')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showHidden, setShowHidden] = useState(false)

  const { data: configs = [], isLoading } = useAdminConfigs(showHidden)
  const updateMut = useUpdateConfig()

  // Group theo category. BE đã sort sẵn theo category → displayOrder → label.
  const grouped = useMemo(() => {
    const map = new Map<string, AdminConfigItem[]>()
    for (const c of configs) {
      const cat = c.category || 'other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(c)
    }
    return map
  }, [configs])

  function startEdit(c: AdminConfigItem) {
    setEditingKey(c.configKey)
    setEditValue(c.configValue)
  }

  function cancelEdit() {
    setEditingKey(null)
    setEditValue('')
  }

  function saveEdit(c: AdminConfigItem) {
    // Number validate phía FE chỉ là UX nhanh — BE vẫn validate (nguồn sự thật).
    if (c.minValue != null || c.maxValue != null) {
      const num = Number(editValue)
      if (isNaN(num) || !Number.isInteger(num)) {
        toast.error('Giá trị phải là số nguyên')
        return
      }
      if (c.minValue != null && num < c.minValue) {
        toast.error(`Giá trị tối thiểu là ${c.minValue}${c.unit ? ' ' + c.unit : ''}`)
        return
      }
      if (c.maxValue != null && num > c.maxValue) {
        toast.error(`Giá trị tối đa là ${c.maxValue}${c.unit ? ' ' + c.unit : ''}`)
        return
      }
    }
    if (!editValue.trim()) {
      toast.error('Giá trị không được để trống')
      return
    }
    updateMut.mutate({ key: c.configKey, value: editValue.trim() }, {
      onSuccess: () => setEditingKey(null),
    })
  }

  function renderGroup(category: string) {
    const rows = grouped.get(category) ?? []
    if (rows.length === 0) return null

    const label = CATEGORY_LABELS[category] ?? 'Khác'
    const description = CATEGORY_DESCRIPTIONS[category]

    return (
      <div key={category} className="space-y-2">
        <div className="px-1">
          <h3 className="text-base font-semibold text-[#fffbe6]">{label}</h3>
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
        <div className="rounded-2xl border border-[#3f382d] overflow-clip">
          <Table className="table-fixed min-w-0">
            <TableHeader>
              <TableRow className="border-[#3f382d] hover:bg-transparent bg-[#201b11]">
                <TableHead className="text-gray-400 w-[15%]">Tên cấu hình</TableHead>
                <TableHead className="text-gray-400">Mô tả</TableHead>
                <TableHead className="text-gray-400 w-[180px]">Giá trị</TableHead>
                <TableHead className="text-gray-400 w-[100px] text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{rows.map(c => renderRow(c))}</TableBody>
          </Table>
        </div>
      </div>
    )
  }

  function renderRow(c: AdminConfigItem) {
    const isEditing = editingKey === c.configKey
    return (
      <TableRow key={c.configKey} className="border-[#3f382d] hover:bg-white/5 group">
        {/* Tên cấu hình — chỉ label tiếng Việt, KHÔNG lộ key kỹ thuật cho admin. */}
        <TableCell className="align-top">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium">{c.label}</span>
            {!c.visible && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded border bg-gray-500/10 text-gray-400 border-gray-500/30"
                title="Cấu hình nâng cao — tham số kỹ thuật ít khi đụng đến (rate-limit, cache, job nền). Thường dev/devops chỉnh."
              >
                nâng cao
              </span>
            )}
          </div>
        </TableCell>

        {/* Mô tả — hint chi tiết. Wrap nhiều dòng để khỏi scroll ngang. */}
        <TableCell className="text-gray-300 text-sm align-top">
          {c.hint ? (
            <div className="flex items-start gap-1.5">
              <Info size={13} className="shrink-0 mt-0.5 text-gray-500" />
              <span className="leading-relaxed whitespace-normal break-words">{c.hint}</span>
            </div>
          ) : (
            <span className="text-gray-500">—</span>
          )}
        </TableCell>

        {/* Giá trị + đơn vị */}
        <TableCell className="align-top">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                type={c.minValue != null || c.maxValue != null ? 'number' : 'text'}
                min={c.minValue ?? undefined}
                max={c.maxValue ?? undefined}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                className="w-32 h-8 text-sm"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEdit(c)
                  if (e.key === 'Escape') cancelEdit()
                }}
              />
              {c.unit && <span className="text-xs text-gray-400">{c.unit}</span>}
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-white font-medium">{c.configValue}</span>
              {c.unit && <span className="text-xs text-gray-400">{c.unit}</span>}
            </div>
          )}
        </TableCell>

        {/* Thao tác */}
        <TableCell className="text-right whitespace-nowrap align-top">
          {isEditing ? (
            <div className="flex gap-1 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => saveEdit(c)}
                disabled={updateMut.isPending}
                title="Lưu"
                className="h-8 w-8 p-0 text-green-400 hover:text-green-300 hover:bg-green-400/10"
              >
                <Check size={14} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelEdit}
                title="Hủy"
                className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X size={14} />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => startEdit(c)}
              className="text-gray-400 hover:text-[#ffc107] h-8 w-8 p-0"
              title="Sửa"
            >
              <Pencil size={14} />
            </Button>
          )}
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toolbar — toggle hiện cấu hình nâng cao */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0 max-w-2xl">
          <p className="text-sm text-gray-300 leading-relaxed">
            Tham số dùng chung cho <span className="font-medium text-white">mọi chi nhánh</span> — ví dụ:
            thời gian giữ ghế trước khi thanh toán, số ghế tối đa mỗi lần đặt,
            tốc độ tích điểm thành viên, ngưỡng giữ phiên đăng nhập…
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Đổi giá trị → áp dụng ngay cho toàn bộ web + POS, không cần restart server.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHidden(v => !v)}
          className="text-gray-300 hover:text-[#ffc107] hover:bg-white/5 shrink-0"
          title="Cấu hình nâng cao là các tham số kỹ thuật ít khi đụng đến: chống lạm dụng (rate-limit), thời gian cache, chu kỳ chạy job nền. Thường chỉ developer chỉnh."
        >
          {showHidden ? (
            <>
              <EyeOff size={14} className="mr-1.5" />
              Ẩn cấu hình nâng cao
            </>
          ) : (
            <>
              <Eye size={14} className="mr-1.5" />
              Hiện cấu hình nâng cao
            </>
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-[#3f382d] overflow-clip">
          <Table className="table-fixed min-w-0">
            <TableHeader>
              <TableRow className="border-[#3f382d] hover:bg-transparent">
                <TableHead className="text-gray-400">Tên cấu hình</TableHead>
                <TableHead className="text-gray-400">Mô tả</TableHead>
                <TableHead className="text-gray-400">Giá trị</TableHead>
                <TableHead className="text-gray-400 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableSkeleton rows={8} columns={4} />
          </Table>
        </div>
      ) : configs.length === 0 ? (
        <div className="rounded-2xl border border-[#3f382d] py-16 text-center">
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Settings size={32} className="text-gray-600" />
            <p className="text-sm">Chưa có cấu hình nào hiển thị</p>
            <p className="text-xs text-gray-600">Bật "Hiện cấu hình nâng cao" để xem toàn bộ.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORY_ORDER.map(g => renderGroup(g))}
          {/* Nhóm "Khác" — category lạ BE seed nhưng FE chưa khai báo label */}
          {Array.from(grouped.keys())
            .filter(c => !CATEGORY_ORDER.includes(c))
            .map(g => renderGroup(g))}
        </div>
      )}
    </div>
  )
}
