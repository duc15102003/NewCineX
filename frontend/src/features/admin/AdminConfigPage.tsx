import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Settings, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import api, { getErrorMessage } from '@/api/axios'
import Loading from '@/components/common/Loading'

// Mô tả + loại dữ liệu cho từng config key
const CONFIG_META: Record<string, { desc: string; type: 'number' | 'text'; min?: number }> = {
  'booking.hold_minutes': { desc: 'Thời gian giữ ghế (phút)', type: 'number', min: 1 },
  'booking.max_seats': { desc: 'Số ghế tối đa mỗi lần đặt', type: 'number', min: 1 },
}

export default function AdminConfigPage() {
  const qc = useQueryClient()
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const { data: configs, isLoading } = useQuery({
    queryKey: ['admin', 'configs'],
    queryFn: async () => {
      const res = await api.get('/api/configs')
      return res.data.data as { id: number; configKey: string; configValue: string; description?: string }[]
    },
  })

  const updateMut = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await api.put(`/api/configs/${key}`, { value })
    },
    onSuccess: () => {
      toast.success('Cập nhật thành công')
      setEditingKey(null)
      qc.invalidateQueries({ queryKey: ['admin', 'configs'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Lỗi cập nhật cấu hình')),
  })

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
    updateMut.mutate({ key, value: editValue.trim() })
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#eab308]/10 flex items-center justify-center">
          <Settings size={20} className="text-[#eab308]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Cấu hình hệ thống</h1>
          <p className="text-xs text-gray-400">Quản lý các thông số cấu hình động</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Tên cấu hình</TableHead>
              <TableHead className="text-gray-400">Mô tả</TableHead>
              <TableHead className="text-gray-400">Giá trị</TableHead>
              <TableHead className="text-gray-400 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(configs ?? []).map((c, index) => (
              <TableRow key={c.configKey} className="border-white/5 hover:bg-white/5">
                <TableCell className="text-gray-500 text-sm">{index + 1}</TableCell>
                <TableCell className="font-mono text-[#eab308] text-sm">{c.configKey}</TableCell>
                <TableCell className="text-gray-400 text-sm">
                  {CONFIG_META[c.configKey]?.desc ?? c.description ?? '—'}
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
                <TableCell className="text-right">
                  {editingKey === c.configKey ? (
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveEdit(c.configKey)}
                        disabled={updateMut.isPending}
                        className="h-7 w-7 p-0 text-green-400 hover:text-green-300 hover:bg-green-400/10"
                      >
                        <Check size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelEdit}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-white/10"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(c.configKey, c.configValue)}
                      className="text-gray-400 hover:text-[#eab308] text-xs hover:bg-[#eab308]/10"
                    >
                      Sửa
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {/* Empty state */}
            {(configs ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-10 text-sm">
                  Chưa có cấu hình nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
