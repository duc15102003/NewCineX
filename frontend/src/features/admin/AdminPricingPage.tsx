import React, { useMemo, useState } from 'react'
import { Plus, Globe2, Building2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import StatusDropdown from '@/components/common/StatusDropdown'
import FilterDrawer, { FilterTrigger, FilterField } from '@/components/common/FilterDrawer'
import TheaterGroupHeaderRow from '@/components/admin/TheaterGroupHeaderRow'

import PricingRuleFormDialog from './components/PricingRuleFormDialog'

import {
  useAdminPricingRules, useBulkArchivePricingRules, useBulkRestorePricingRules,
} from '@/hooks/useAdminPricingRules'
import type { PricingRule, PricingRuleType } from '@/hooks/useAdminPricingRules'
import { fmtDate } from '@/utils/labels'
import { PRICING_RULE_TYPE_COLORS as RULE_TYPE_COLORS } from '@/utils/colors'
import { ADMIN_LIST_PAGE_SIZE } from '@/utils/constants'
import { useAdminTheaterStore } from '@/store/adminTheaterStore'
import { useAuthStore } from '@/store/authStore'
import { groupByTheater } from '@/utils/groupByTheater'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

const RULE_TYPE_LABELS: Record<PricingRuleType, string> = {
  DAY_OF_WEEK: 'Theo thứ trong tuần',
  HOUR_RANGE: 'Theo khung giờ',
  DATE_RANGE: 'Theo khoảng ngày',
  COMPOSITE: 'Kết hợp (AND)',
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'T2', TUESDAY: 'T3', WEDNESDAY: 'T4', THURSDAY: 'T5',
  FRIDAY: 'T6', SATURDAY: 'T7', SUNDAY: 'CN',
}

type ScopeFilter = '' | 'GLOBAL' | 'THEATER'
type ActiveFilter = '' | 'true' | 'false'

interface DraftFilter {
  ruleType: PricingRuleType | ''
  scope: ScopeFilter
  active: ActiveFilter
}

const EMPTY_FILTER: DraftFilter = { ruleType: '', scope: '', active: '' }

/** Summarize điều kiện rule (CSV days, hour range, date range) cho cột "Điều kiện" trong table. */
function summarizeRule(r: PricingRule): string {
  const parts: string[] = []
  if (r.dayOfWeek) {
    const days = r.dayOfWeek.split(',').map(s => s.trim())
    parts.push(days.map(d => DAY_LABELS[d] ?? d).join(', '))
  }
  if (r.hourStart != null && r.hourEnd != null) {
    parts.push(`${r.hourStart}h - ${r.hourEnd}h`)
  }
  if (r.dateStart && r.dateEnd) {
    parts.push(`${fmtDate(r.dateStart)} → ${fmtDate(r.dateEnd)}`)
  }
  return parts.join(' · ')
}

/** Format multiplier % → "+10%" / "-20%" / "Giữ nguyên" cho UI. */
function formatMultiplier(m: number): string {
  const diff = m - 100
  if (diff > 0) return `+${diff.toFixed(0)}%`
  if (diff < 0) return `${diff.toFixed(0)}%`
  return 'Giữ nguyên'
}

export default function AdminPricingPage() {
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PricingRule | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [appliedFilter, setAppliedFilter] = useState<DraftFilter>(EMPTY_FILTER)
  const [draftFilter, setDraftFilter] = useState<DraftFilter>(EMPTY_FILTER)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Theater scope
  const { currentTheater: adminTheater } = useAdminTheaterStore()
  const { user, isBranchAdmin } = useAuthStore()
  const userTheaterId = user?.theaterId ?? null
  const scopedTheaterId = adminTheater?.id ?? (isBranchAdmin() ? userTheaterId : null)
  const branchLocked = isBranchAdmin()

  // Dep stable: adminTheater?.id (number) thay vì adminTheater (object reference đổi
  // mỗi render từ store) — tránh useMemo invalidate vô tận → infinite refetch.
  const queryParams = useMemo(() => ({
    size: ADMIN_LIST_PAGE_SIZE,
    theaterId: adminTheater?.id,
  }), [adminTheater?.id])

  const { data: pageData } = useAdminPricingRules(queryParams)
  const allRules = pageData?.content ?? []

  // Filter client-side: keyword + ruleType + scope + active (BE chưa support search)
  const rules = useMemo(() => {
    let list = allRules
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      list = list.filter(r =>
        r.code.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw),
      )
    }
    if (appliedFilter.ruleType) {
      list = list.filter(r => r.ruleType === appliedFilter.ruleType)
    }
    if (appliedFilter.scope === 'GLOBAL') {
      list = list.filter(r => r.theaterId == null)
    } else if (appliedFilter.scope === 'THEATER') {
      list = list.filter(r => r.theaterId != null)
    }
    if (appliedFilter.active === 'true') {
      list = list.filter(r => r.active)
    } else if (appliedFilter.active === 'false') {
      list = list.filter(r => !r.active)
    }
    return list
  }, [allRules, keyword, appliedFilter])

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (appliedFilter.ruleType) n++
    if (appliedFilter.scope) n++
    if (appliedFilter.active) n++
    return n
  }, [appliedFilter])

  // Grouped view khi SUPER_ADMIN xem "Tất cả chi nhánh"
  const showGrouped = !adminTheater && !branchLocked
  const globalRules = useMemo(
    () => (showGrouped ? rules.filter(r => r.theaterId == null) : []),
    [rules, showGrouped],
  )
  const groupedRules = useMemo(
    () => (showGrouped ? groupByTheater(rules.filter(r => r.theaterId != null)) : null),
    [rules, showGrouped],
  )
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const [globalCollapsed, setGlobalCollapsed] = useState(false)
  const toggleGroup = (theaterId: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      next.has(theaterId) ? next.delete(theaterId) : next.add(theaterId)
      return next
    })
  }

  const bulkArchiveMut = useBulkArchivePricingRules()
  const bulkRestoreMut = useBulkRestorePricingRules()

  function openCreate() {
    setEditingItem(null)
    setDialogOpen(true)
  }
  function openEdit(rule: PricingRule) {
    setEditingItem(rule)
    setDialogOpen(true)
  }

  function openFilter() {
    setDraftFilter(appliedFilter)
    setDrawerOpen(true)
  }
  function applyFilter() {
    setAppliedFilter(draftFilter)
    setDrawerOpen(false)
  }
  function resetFilter() {
    setDraftFilter(EMPTY_FILTER)
    setAppliedFilter(EMPTY_FILTER)
  }

  function handleBulkArchive() {
    if (selectedIds.size === 0) { toast.error('Hãy chọn ít nhất 1 mục'); return }
    setConfirmOpen(true)
  }
  function handleBulkRestore() {
    if (selectedIds.size === 0) { toast.error('Hãy chọn ít nhất 1 mục'); return }
    bulkRestoreMut.mutate([...selectedIds], { onSuccess: () => setSelectedIds(new Set()) })
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    if (selectedIds.size === rules.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rules.map((r) => r.id)))
    }
  }

  const renderRuleRow = (r: PricingRule, idx: number) => {
    const isArchived = r.storageState === 'ARCHIVED'
    return (
      <TableRow key={r.id} className={`border-[#3f382d] hover:bg-white/5 group ${isArchived ? 'opacity-50' : ''}`}>
        <TableCell className="whitespace-nowrap">
          <input type="checkbox" checked={selectedIds.has(r.id)}
            onChange={() => toggleSelect(r.id)} className="accent-[#ffc107]" />
        </TableCell>
        <TableCell className="text-gray-500 text-sm whitespace-nowrap">{idx + 1}</TableCell>
        <TableCell className="whitespace-nowrap">
          <span onClick={() => openEdit(r)} className="text-[#ffc107] hover:underline cursor-pointer font-medium font-mono text-sm block">
            {r.code}
          </span>
          <span className="text-xs text-gray-400">{r.name}</span>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {r.theaterId == null ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30">
              <Globe2 size={12} /> Toàn hệ
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border bg-blue-500/10 text-blue-400 border-blue-500/30">
              <Building2 size={12} /> {r.theaterName}
            </span>
          )}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <span className={`text-xs px-2 py-1 rounded-md border ${RULE_TYPE_COLORS[r.ruleType]}`}>
            {RULE_TYPE_LABELS[r.ruleType]}
          </span>
        </TableCell>
        <TableCell className="text-gray-300 text-sm whitespace-nowrap">{summarizeRule(r)}</TableCell>
        <TableCell className="whitespace-nowrap">
          <span className={`text-sm font-semibold ${r.multiplierPercent > 100 ? 'text-orange-400' : r.multiplierPercent < 100 ? 'text-green-400' : 'text-gray-400'}`}>
            {formatMultiplier(r.multiplierPercent)}
          </span>
          <span className="text-gray-500 text-xs ml-1">({Number(r.multiplierPercent).toFixed(0)}%)</span>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {r.active ? (
            <span className="text-xs px-2 py-1 rounded border bg-green-500/10 text-green-400 border-green-500/30">Bật</span>
          ) : (
            <span className="text-xs px-2 py-1 rounded border bg-gray-500/10 text-gray-400 border-gray-500/30">Tắt</span>
          )}
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — pattern đồng bộ AdminSnackPage/AdminComboPage */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Tìm theo mã hoặc tên rule..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <FilterTrigger onClick={openFilter} activeCount={activeFilterCount} />
          {activeFilterCount > 0 && (
            <Button type="button" variant="ghost" onClick={resetFilter}
              className="text-gray-400 hover:text-white hover:bg-white/5 h-9 px-2"
              title="Xóa filter">
              <X size={14} />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
            <Plus size={16} className="mr-1" /> Thêm mới
          </Button>
          <StatusDropdown
            onArchive={handleBulkArchive}
            onRestore={handleBulkRestore}
            archiveLoading={bulkArchiveMut.isPending}
            restoreLoading={bulkRestoreMut.isPending}
          />
        </div>
      </div>

      {/* Filter Drawer */}
      <FilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Lọc rule nâng cao"
        onApply={applyFilter}
        onReset={resetFilter}
      >
        <FilterField label="Loại rule">
          <select className={SELECT_CLS} value={draftFilter.ruleType}
            onChange={(e) => setDraftFilter(d => ({ ...d, ruleType: e.target.value as PricingRuleType | '' }))}>
            <option value="">— Tất cả —</option>
            {Object.entries(RULE_TYPE_LABELS).map(([v, lbl]) => (
              <option key={v} value={v}>{lbl}</option>
            ))}
          </select>
        </FilterField>

        {!branchLocked && (
          <FilterField label="Phạm vi">
            <select className={SELECT_CLS} value={draftFilter.scope}
              onChange={(e) => setDraftFilter(d => ({ ...d, scope: e.target.value as ScopeFilter }))}>
              <option value="">— Tất cả —</option>
              <option value="GLOBAL">Toàn hệ thống</option>
              <option value="THEATER">Chi nhánh cụ thể</option>
            </select>
          </FilterField>
        )}

        <FilterField label="Trạng thái">
          <select className={SELECT_CLS} value={draftFilter.active}
            onChange={(e) => setDraftFilter(d => ({ ...d, active: e.target.value as ActiveFilter }))}>
            <option value="">— Tất cả —</option>
            <option value="true">Đang bật</option>
            <option value="false">Đã tắt</option>
          </select>
        </FilterField>
      </FilterDrawer>

      {/* Table */}
      <div className="rounded-2xl border border-[#3f382d] overflow-clip">
        <Table>
          <TableHeader>
            <TableRow className="border-[#3f382d] hover:bg-transparent">
              <TableHead className="w-10">
                <input type="checkbox" checked={rules.length > 0 && selectedIds.size === rules.length}
                  onChange={toggleAll} className="accent-[#ffc107]" />
              </TableHead>
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Mã / Tên</TableHead>
              <TableHead className="text-gray-400">Phạm vi</TableHead>
              <TableHead className="text-gray-400">Loại</TableHead>
              <TableHead className="text-gray-400">Điều kiện</TableHead>
              <TableHead className="text-gray-400">Hệ số</TableHead>
              <TableHead className="text-gray-400">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-10">
                  {keyword || activeFilterCount > 0 ? 'Không tìm thấy rule nào' : 'Chưa có rule nào'}
                </TableCell>
              </TableRow>
            )}
            {showGrouped ? (
              <>
                {globalRules.length > 0 && (
                  <React.Fragment key="group-global">
                    <TheaterGroupHeaderRow
                      collapsed={globalCollapsed}
                      onToggle={() => setGlobalCollapsed(c => !c)}
                      theaterName="Rule toàn hệ thống"
                      theaterCity="Áp dụng mặc định mọi rạp"
                      itemCount={globalRules.length}
                      itemLabel="rule"
                      colSpan={8}
                    />
                    {!globalCollapsed && globalRules.map((r, idx) => renderRuleRow(r, idx))}
                  </React.Fragment>
                )}
                {groupedRules && groupedRules.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.theaterId)
                  return (
                    <React.Fragment key={`group-${group.theaterId}`}>
                      <TheaterGroupHeaderRow
                        collapsed={isCollapsed}
                        onToggle={() => toggleGroup(group.theaterId)}
                        theaterName={group.theaterName}
                        theaterCity={group.theaterCity}
                        itemCount={group.items.length}
                        itemLabel="rule"
                        colSpan={8}
                      />
                      {!isCollapsed && group.items.map((r, idx) => renderRuleRow(r, idx))}
                    </React.Fragment>
                  )
                })}
              </>
            ) : (
              rules.map((r, idx) => renderRuleRow(r, idx))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => bulkArchiveMut.mutate([...selectedIds], {
          onSuccess: () => { setSelectedIds(new Set()); setConfirmOpen(false) },
        })}
        message={`Bạn có chắc muốn lưu trữ ${selectedIds.size} rule đã chọn? Booking mới sẽ không còn áp dụng các rule này.`}
        loading={bulkArchiveMut.isPending}
      />

      <PricingRuleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        scopedTheaterId={scopedTheaterId}
        branchLocked={branchLocked}
        userTheaterId={userTheaterId}
      />
    </div>
  )
}
