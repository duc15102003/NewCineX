import type { PricingRuleType } from '@/hooks/useAdminPricingRules'

export type ScopeChoice = 'GLOBAL' | 'THEATER'

export interface FormData {
  scope: ScopeChoice
  theaterId: number | ''
  code: string
  name: string
  description: string
  ruleType: PricingRuleType
  multiplierPercent: string
  dayOfWeek: string
  hourStart: string
  hourEnd: string
  dateStart: string
  dateEnd: string
  active: boolean
  priority: string
}

export const RULE_TYPE_LABELS: Record<PricingRuleType, string> = {
  DAY_OF_WEEK: 'Theo thứ trong tuần',
  HOUR_RANGE: 'Theo khung giờ',
  DATE_RANGE: 'Theo khoảng ngày',
  COMPOSITE: 'Nhiều điều kiện cùng lúc',
}

/** Hint giải thích cho từng loại — dùng làm tooltip + helper text trong form. */
export const RULE_TYPE_HINTS: Record<PricingRuleType, string> = {
  DAY_OF_WEEK: 'Áp dụng vào các ngày cụ thể trong tuần (vd: T7, CN)',
  HOUR_RANGE: 'Áp dụng trong 1 khung giờ trong ngày (vd: 19h-22h "giờ vàng")',
  DATE_RANGE: 'Áp dụng trong khoảng ngày cố định (vd: dịp Tết, Halloween)',
  COMPOSITE: 'Phải thoả MỌI điều kiện cùng lúc (vd: T7 + khung 19h-22h)',
}

export const DAY_OPTIONS = [
  { value: 'MONDAY', label: 'T2' },
  { value: 'TUESDAY', label: 'T3' },
  { value: 'WEDNESDAY', label: 'T4' },
  { value: 'THURSDAY', label: 'T5' },
  { value: 'FRIDAY', label: 'T6' },
  { value: 'SATURDAY', label: 'T7' },
  { value: 'SUNDAY', label: 'CN' },
]

export const SELECT_CLS =
  'w-full h-10 rounded-md border border-white/10 bg-[#2a2317] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#ffc107]'
