import { useMemo, useState } from 'react'
import { Bell, Ticket, Tag, Settings, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Loading from '@/components/common/Loading'
import EmptyState from '@/components/common/EmptyState'
import FilterDrawer, { FilterTrigger, FilterField } from '@/components/common/FilterDrawer'
import DateRangePicker from '@/components/common/DateRangePicker'
import { fmtDateTime } from '@/utils/labels'
import {
  useNotificationsPage,
  useMarkAsRead,
  useMarkAllAsRead,
  useUnreadCount,
  type NotificationListFilter,
  type Notification,
} from '@/hooks/useNotifications'

const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'

const TYPE_LABELS: Record<string, string> = {
  BOOKING: 'Đặt vé',
  PROMOTION: 'Khuyến mãi',
  SYSTEM: 'Hệ thống',
}

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  BOOKING: Ticket,
  PROMOTION: Tag,
  SYSTEM: Settings,
}

const TYPE_ICON_COLORS: Record<string, string> = {
  BOOKING: 'text-blue-400 bg-blue-400/10',
  PROMOTION: 'text-[#ffc107] bg-[#ffc107]/10',
  SYSTEM: 'text-purple-400 bg-purple-400/10',
}

/**
 * Status filter:
 *  - 'all'   → đem theo isRead = undefined
 *  - 'unread' → isRead = false
 *  - 'read'   → isRead = true
 */
type StatusKey = 'all' | 'unread' | 'read'

interface DraftFilter {
  type: string  // '' = all
  status: StatusKey
  createdFrom: string
  createdTo: string
}

const EMPTY_DRAFT: DraftFilter = {
  type: '',
  status: 'all',
  createdFrom: '',
  createdTo: '',
}

function draftToApiFilter(d: DraftFilter, page: number): NotificationListFilter {
  return {
    type: d.type || undefined,
    isRead: d.status === 'unread' ? false : d.status === 'read' ? true : undefined,
    createdFrom: d.createdFrom || undefined,
    createdTo: d.createdTo || undefined,
    page,
    size: 20,
  }
}

export default function NotificationListPage() {
  const [page, setPage] = useState(0)
  const [applied, setApplied] = useState<DraftFilter>(EMPTY_DRAFT)
  const [draft, setDraft] = useState<DraftFilter>(EMPTY_DRAFT)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data, isLoading } = useNotificationsPage(draftToApiFilter(applied, page))
  const { data: unreadCount = 0 } = useUnreadCount()
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()

  const items = data?.content ?? []
  const totalPages = data?.totalPages ?? 0

  const activeCount = useMemo(() => {
    let n = 0
    if (applied.type) n++
    if (applied.status !== 'all') n++
    if (applied.createdFrom) n++
    if (applied.createdTo) n++
    return n
  }, [applied])

  function applyDraft() {
    setApplied({ ...draft })
    setPage(0)
    setDrawerOpen(false)
  }

  function resetDraft() {
    setDraft(EMPTY_DRAFT)
    setApplied(EMPTY_DRAFT)
    setPage(0)
  }

  function handleCardClick(n: Notification) {
    if (!n.read) {
      markAsRead.mutate(n.id)
    }
    // (Tương lai có thể navigate theo loại notification — VD: BOOKING → /my-tickets/:id)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Bell size={22} className="text-[#ffc107]" />
            Thông báo của tôi
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Đã đọc tất cả'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FilterTrigger
            onClick={() => {
              setDraft(applied)
              setDrawerOpen(true)
            }}
            activeCount={activeCount}
            label="Lọc"
          />
          {unreadCount > 0 && (
            <Button
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
              className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg"
            >
              <CheckCheck size={16} className="mr-1.5" />
              Đánh dấu tất cả đã đọc
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading && !data ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          message="Không có thông báo nào"
          description="Khi có ưu đãi mới hoặc cập nhật về vé đã đặt, thông báo sẽ hiện ở đây."
        />
      ) : (
        <div className="space-y-3">
          {items.map((n) => {
            const Icon = TYPE_ICONS[n.type] ?? Bell
            const iconColor = TYPE_ICON_COLORS[n.type] ?? 'text-gray-400 bg-white/5'
            return (
              <div
                key={n.id}
                onClick={() => handleCardClick(n)}
                className={`bg-[#201b11] border border-[#3f382d] hover:bg-white/5 rounded-2xl p-4 cursor-pointer transition-colors ${
                  !n.read ? 'border-l-4 border-l-[#ffc107]' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon theo type */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconColor}`}>
                    <Icon size={18} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-white font-semibold text-sm truncate">{n.title}</h3>
                      {!n.read && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ffc107] text-black shrink-0">
                          MỚI
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1 leading-relaxed">{n.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[11px] text-gray-500">{fmtDateTime(n.createdAt)}</span>
                      <span className="text-[11px] text-gray-500">·</span>
                      <span className="text-[11px] text-gray-400">{TYPE_LABELS[n.type] ?? n.type}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="border-white/10 text-gray-300 hover:bg-white/5"
          >
            Trước
          </Button>
          <span className="text-gray-400 text-sm px-2 py-1">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            className="border-white/10 text-gray-300 hover:bg-white/5"
          >
            Sau
          </Button>
        </div>
      )}

      {/* Filter Drawer */}
      <FilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Lọc thông báo"
        onApply={applyDraft}
        onReset={resetDraft}
      >
        <FilterField label="Loại thông báo">
          <select
            className={SELECT_CLS}
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
          >
            <option value="">— Tất cả —</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Trạng thái đọc">
          <div className="space-y-2">
            {(['all', 'unread', 'read'] as StatusKey[]).map((k) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={draft.status === k}
                  onChange={() => setDraft((d) => ({ ...d, status: k }))}
                  className="accent-[#ffc107]"
                />
                <span className="text-sm text-gray-300">
                  {k === 'all' ? 'Tất cả' : k === 'unread' ? 'Chưa đọc' : 'Đã đọc'}
                </span>
              </label>
            ))}
          </div>
        </FilterField>

        <FilterField label="Khoảng thời gian">
          <DateRangePicker
            type="datetime-local"
            from={draft.createdFrom}
            to={draft.createdTo}
            onChange={(from, to) =>
              setDraft((d) => ({ ...d, createdFrom: from, createdTo: to }))
            }
          />
        </FilterField>
      </FilterDrawer>
    </div>
  )
}
