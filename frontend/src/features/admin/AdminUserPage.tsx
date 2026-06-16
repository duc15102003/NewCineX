import { useEffect, useMemo, useState } from 'react'
import { Building2, Globe2, X, Users, Plus } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilterTrigger } from '@/components/common/FilterDrawer'

import UserFormDialog from './components/UserFormDialog'
import UserFilterDrawer from './components/UserFilterDrawer'
import { FEATURES } from '@/config/featureFlags'

import { useAdminUsers } from '@/hooks/useAdmin'
import type { AdminUser, AdminUserFilter } from '@/hooks/useAdminUsers'
import { label, ROLE_LABELS, STORAGE_STATE_LABELS } from '@/utils/labels'
import { ROLE_COLORS, STORAGE_STATE_COLORS as STATE_COLORS } from '@/utils/colors'
import { usePageTitle } from '@/hooks/usePageTitle'

const PAGE_SIZE = 15

const EMPTY_FILTER: AdminUserFilter = {
  keyword: '',
  role: '',
  enabled: undefined,
  createdFrom: '',
  createdTo: '',
  includeDeleted: false,
}

/**
 * Render cell "Chi nhánh" theo role — sync với pattern badge của
 * AdminBookingPage/AdminPricingPage:
 *
 * <ul>
 *   <li><b>SUPER_ADMIN</b>: badge gold "Toàn hệ" — không thuộc CN nào, xem mọi CN</li>
 *   <li><b>ADMIN / STAFF</b>: badge neutral + icon + tên CN + city</li>
 *   <li><b>USER</b>: "—" gray vì khách không thuộc CN</li>
 * </ul>
 */
function renderTheaterCell(u: AdminUser) {
  if (u.role === 'SUPER_ADMIN') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30">
        <Globe2 size={12} /> Toàn hệ
      </span>
    )
  }
  if (u.theaterName) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-200">
        <Building2 size={12} className="text-[#ffc107]" />
        <span>{u.theaterName}</span>
        {u.theaterCity && <span className="text-gray-500">— {u.theaterCity}</span>}
      </span>
    )
  }
  return <span className="text-xs text-gray-500">—</span>
}

export default function AdminUserPage() {
  usePageTitle('Quản lý người dùng')
  const [page, setPage] = useState(0)
  const [appliedFilter, setAppliedFilter] = useState<AdminUserFilter>(EMPTY_FILTER)
  const [draftFilter, setDraftFilter] = useState<AdminUserFilter>(EMPTY_FILTER)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [keywordInput, setKeywordInput] = useState('')
  const debouncedKw = useDebouncedValue(keywordInput, 400)
  useEffect(() => {
    setAppliedFilter(f => ({ ...f, keyword: debouncedKw }))
    setPage(0)
  }, [debouncedKw])

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

  const currentUserRole = useAuthStore(s => s.user?.role)
  const canCreate = currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'ADMIN'

  function openEdit(u: AdminUser) {
    setEditingItem(u)
    setDialogOpen(true)
  }
  function openCreate() {
    setEditingItem(null)
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
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
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
        {/* RBAC: chỉ SUPER_ADMIN + ADMIN branch tạo được user.
            STAFF/USER ẩn nút (defense in depth — BE cũng chặn). */}
        {canCreate && (
          <div className="flex items-center gap-2">
            <Button onClick={openCreate} className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
              <Plus size={16} className="mr-1" /> Thêm mới
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#3f382d] overflow-clip">
        <Table>
          <TableHeader>
            <TableRow className="border-[#3f382d] hover:bg-transparent">
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Username</TableHead>
              <TableHead className="text-gray-400">Email</TableHead>
              <TableHead className="text-gray-400">Họ tên</TableHead>
              <TableHead className="text-gray-400">SĐT</TableHead>
              <TableHead className="text-gray-400">Vai trò</TableHead>
              {FEATURES.multiTheater && <TableHead className="text-gray-400">Chi nhánh</TableHead>}
              <TableHead className="text-gray-400">Trạng thái</TableHead>
              <TableHead className="text-gray-400">Lưu trữ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={FEATURES.multiTheater ? 9 : 8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Users size={32} className="text-gray-600" />
                    <p className="text-sm">{keywordInput ? `Không tìm thấy người dùng khớp "${keywordInput}"` : 'Chưa có người dùng nào'}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {users.map((u, index) => {
              const isArchived = u.storageState === 'ARCHIVED'
              return (
              <TableRow key={u.id} className={`border-[#3f382d] hover:bg-white/5 group ${isArchived ? 'opacity-50' : ''}`}>
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
                {FEATURES.multiTheater && (
                  <TableCell className="whitespace-nowrap">
                    {renderTheaterCell(u)}
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap">
                  <span className={`text-xs px-2 py-1 rounded border ${u.enabled
                    ? 'bg-green-500/10 text-green-400 border-green-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                    {u.enabled ? 'Hoạt động' : 'Bị khóa'}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {u.storageState && (
                    <span className={`text-xs px-2 py-1 rounded border ${STATE_COLORS[u.storageState] ?? ''}`}>
                      {label(STORAGE_STATE_LABELS, u.storageState)}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )})}
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
