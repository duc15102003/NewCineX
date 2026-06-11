import { useQuery } from '@tanstack/react-query'
import api from '@/api/axios'
import type { ApiResponse } from '@/types/auth'
import type { PageResponse } from '@/types/movie'

export type LoyaltyTier = 'STANDARD' | 'SILVER' | 'GOLD' | 'PLATINUM'
export type LoyaltyTransactionType = 'EARN' | 'REDEEM' | 'ADJUST'

export interface LoyaltyAccount {
  loyaltyPoints: number
  lifetimePoints: number
  tier: LoyaltyTier
  nextTier: LoyaltyTier | null
  nextTierThreshold: number | null
  pointsToNextTier: number | null
}

export interface LoyaltyTransaction {
  id: number
  transactionType: LoyaltyTransactionType
  points: number
  balanceAfter: number
  reason: string | null
  bookingCode: string | null
  createdAt: string
}

export function useMyLoyalty() {
  return useQuery({
    queryKey: ['loyalty', 'me'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<LoyaltyAccount>>('/api/loyalty/me')
      return res.data.data
    },
  })
}

export function useMyLoyaltyTransactions(page = 0, size = 20) {
  return useQuery({
    queryKey: ['loyalty', 'transactions', page, size],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PageResponse<LoyaltyTransaction>>>(
        '/api/loyalty/me/transactions', { params: { page, size } },
      )
      return res.data.data
    },
  })
}
