import { useMemo, useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilterTrigger } from '@/components/common/FilterDrawer'

import UserFormDialog from './components/UserFormDialog'
import UserFilterDrawer from './components/UserFilterDrawer'

import { useAdminUsers } from '@/hooks/useAdmin'
import type { AdminUser, AdminUserFilter } from '@/hooks/useAdminUsers'
import { label, ROLE_LABELS } from '@/utils/labels'
import { ROLE_COLORS } from '@/utils/colors'

const PAGE_SIZE = 15

const EMPTY_FILTER: AdminUserFilter = {
  keyword: '',
  role: '',
  enabled: undefined,
  createdFrom: '',
  createdTo: '',
  includeDeleted: false,
}

export default function AdminUserPage() {
  const [page, setPage] = useState(0)
  const [appliedFilter, setAppliedFilter] = useState<AdminUserFilter>(EMPTY_FILTER)
  const [draftFilter, setDraftFilter] = useState<AdminUserFilter>(EMPTY_FILTER)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminUser | null>(null)

  const { data: pageData } = useAdminUsers({ ...appliedFilter, page, size: PAGE_SIZE })
  const users = pageData?.content ?? []
  const totalPages = pageData?.totalPages ?? 0

  /**
   * Đếm số filter đang bật (không tính keyword) → hiển thị badge trên trigger.
   * Keyword nằm trên search bar luôn visible nên không tính active filter.
   */
  const activeCount = useMemo(() => {
    let n = 0
    if (appliedFilter.role) n++
    if (appliedFilter.enabled !== undefined) n++
    if (appliedFilter.createdFrom) n++
    if (appliedFilter.createdTo) n++
    if (appliedFilter.includeDeleted) n++
    return n
  }, [appliedFilter])

  function openEdit(u: AdminUser) {
    setEditingItem(u)
    setDialogOpen(true)
  }

  function openDrawer() {
    setDraftFilter(appliedFilter)
    setDrawerOpen(true)
  }
  function patchDraft(patch: Partial<AdminUserFilter>) {
    setDraftFilter(f => ({ ...f, ...patch }))
  }
  function applyDraft() {
    setAppliedFilter({ ...draftFilter, keyword: appliedFilter.keyword })
    setPage(0)
    setDrawerOpen(false)
  }
  function resetDraft() {
    const cleared = { ...EMPTY_FILTER, keyword: appliedFilter.keyword }
    setDraftFilter(cleared)
    setAppliedFilter(cleared)
    setPage(0)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Tìm theo username/email/họ tên/SĐT..."
              value={appliedFilter.keyword ?? ''}
              onChange={(e) => { setAppliedFilter(f => ({ ...f, keyword: e.target.value })); setPage(0) }}
            />
          </div>
          <FilterTrigger onClick={openDrawer} activeCount={activeCount} />
          {activeCount > 0 && (
            <Button type="button" variant="ghost" onClick={resetDraft}
              className="text-gray-400 hover:text-white hover:bg-white/5 h-9 px-2"
              title="Xóa filter">
              <X size={14} />
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Username</TableHead>
              <TableHead className="text-gray-400">Email</TableHead>
              <TableHead className="text-gray-400">Họ tên</TableHead>
              <TableHead className="text-gray-400">SĐT</TableHead>
              <TableHead className="text-gray-400">Vai trò</TableHead>
              <TableHead className="text-gray-400">Chi nhánh</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-10">Không có dữ liệu</TableCell>
              </TableRow>
            )}
            {users.map((u, index) => (
              <TableRow key={u.id} className="border-white/5 hover:bg-white/5 group">
                <TableCell className="text-gray-500 text-sm whitespace-nowrap">{page * PAGE_SIZE + index + 1}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span onClick={() => openEdit(u)}
                    className="text-[#ffc107] hover:underline cursor-pointer font-medium">
                    {u.username}
                  </span>
                </TableCell>
                <TableCell className="text-gray-300 whitespace-nowrap">{u.email}</TableCell>
                <TableCell className="text-gray-300 whitespace-nowrap">{u.fullName}</TableCell>
                <TableCell className="text-gray-300 whitespace-nowrap">{u.phone}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={`text-xs px-2 py-1 rounded border ${ROLE_COLORS[u.role] ?? 'text-gray-400 border-gray-600'}`}>
                    {label(ROLE_LABELS, u.role)}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-gray-300 text-sm">
                  {u.theaterName ? <span>{u.theaterName}</span> : <span className="text-gray-600">—</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={`text-xs px-2 py-1 rounded border ${u.enabled
                    ? 'bg-green-500/10 text-green-400 border-green-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                    {u.enabled ? 'Hoạt động' : 'Bị khóa'}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}
            className="border-white/10 text-gray-300 hover:bg-white/5">Trước</Button>
          <span className="text-gray-400 text-sm px-2 py-1">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
            className="border-white/10 text-gray-300 hover:bg-white/5">Sau</Button>
        </div>
      )}

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
      />

      <UserFilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        draftFilter={draftFilter}
        onPatchDraft={patchDraft}
        onApply={applyDraft}
        onReset={resetDraft}
      />
    </div>
  )
}
