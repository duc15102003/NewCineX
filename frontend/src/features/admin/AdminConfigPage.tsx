import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import TableSkeleton from '@/components/common/TableSkeleton'
import { useAdminConfigs, useUpdateConfig } from '@/hooks/useConfig'
import { usePageTitle } from '@/hooks/usePageTitle'

// Mô tả + loại dữ liệu cho từng config key
const CONFIG_META: Record<string, { desc: string; type: 'number' | 'text'; min?: number }> = {
  'booking.hold_minutes': { desc: 'Thời gian giữ ghế (phút)', type: 'number', min: 1 },
  'booking.max_seats': { desc: 'Số ghế tối đa mỗi lần đặt', type: 'number', min: 1 },
}

export default function AdminConfigPage() {
  usePageTitle('Cấu hình hệ thống')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const { data: configs = [], isLoading } = useAdminConfigs()
  const updateMut = useUpdateConfig()

  function startEdit(key: string, value: string) {
    setEditingKey(key)
    setEditValue(value)
  }

  function cancelEdit() {
    setEditingKey(null)
    setEditValue('')
  }

  function saveEdit(key: string) {
    const meta = CONFIG_META[key]
    if (meta?.type === 'number') {
      const num = Number(editValue)
      if (isNaN(num) || !Number.isInteger(num)) {
        toast.error('Giá trị phải là số nguyên')
        return
      }
      if (meta.min !== undefined && num < meta.min) {
        toast.error(`Giá trị tối thiểu là ${meta.min}`)
        return
      }
    }
    if (!editValue.trim()) {
      toast.error('Giá trị không được để trống')
      return
    }
    updateMut.mutate({ key, value: editValue.trim() }, {
      onSuccess: () => setEditingKey(null),
    })
  }

  return (
    <div className="space-y-4">
      {/* Table — bỏ heading rườm rà, đồng bộ pattern các trang admin khác */}
      <div className="rounded-2xl border border-[#3f382d] overflow-clip">
        <Table>
          <TableHeader>
            <TableRow className="border-[#3f382d] hover:bg-transparent">
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Tên cấu hình</TableHead>
              <TableHead className="text-gray-400">Mô tả</TableHead>
              <TableHead className="text-gray-400">Giá trị</TableHead>
              <TableHead className="text-gray-400 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          {isLoading ? <TableSkeleton rows={8} columns={5} /> : (
          <TableBody>
            {configs.map((c, index) => (
              <TableRow key={c.configKey} className="border-[#3f382d] hover:bg-white/5 group">
                <TableCell className="text-gray-500 text-sm">{index + 1}</TableCell>
                <TableCell className="font-mono text-[#ffc107] text-sm">{c.configKey}</TableCell>
                <TableCell className="text-gray-400 text-sm">
                  {CONFIG_META[c.configKey]?.desc ?? c.description ?? ''}
                </TableCell>
                <TableCell>
                  {editingKey === c.configKey ? (
                    <Input
                      type={CONFIG_META[c.configKey]?.type === 'number' ? 'number' : 'text'}
                      min={CONFIG_META[c.configKey]?.min}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="w-36 h-8 text-sm"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit(c.configKey)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                    />
                  ) : (
                    <span className="text-white font-medium">{c.configValue}</span>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {editingKey === c.configKey ? (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => saveEdit(c.configKey)}
                        disabled={updateMut.isPending} title="Lưu"
                        className="h-8 w-8 p-0 text-green-400 hover:text-green-300 hover:bg-green-400/10">
                        <Check size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} title="Hủy"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-white/10">
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(c.configKey, c.configValue)}
                      className="text-gray-400 hover:text-[#ffc107] h-8 w-8 p-0" title="Sửa">
                      <Pencil size={14} />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {configs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-10 text-sm">
                  Chưa có cấu hình nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          )}
        </Table>
      </div>
    </div>
  )
}
