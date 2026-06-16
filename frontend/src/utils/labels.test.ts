import { describe, it, expect } from 'vitest'
import {
  fmtVnd,
  fmtRating,
  label,
  ROLE_LABELS,
  LOYALTY_TIER_LABELS,
  BOOKING_STATUS_LABELS,
  needsAgeConfirm,
  AGE_RATING_MIN_AGE,
} from './labels'

describe('fmtVnd — format tiền VNĐ', () => {
  it('format số > 0 với dấu chấm ngăn cách + đơn vị đ', () => {
    expect(fmtVnd(100000)).toBe('100.000đ')
    expect(fmtVnd(1000000)).toBe('1.000.000đ')
  })

  it('format 0 = "0đ" (không phải dấu —)', () => {
    expect(fmtVnd(0)).toBe('0đ')
  })

  it('null/undefined → chuỗi rỗng (FE quyết định fallback)', () => {
    expect(fmtVnd(null)).toBe('')
    expect(fmtVnd(undefined)).toBe('')
  })
})

describe('fmtRating — rating phim 1 chữ số thập phân', () => {
  it('format rating > 0', () => {
    expect(fmtRating(7.5)).toBe('7.5')
    expect(fmtRating(10)).toBe('10.0')
  })

  it('null/undefined/0 → "0.0" (phim chưa có rating)', () => {
    expect(fmtRating(null)).toBe('0.0')
    expect(fmtRating(undefined)).toBe('0.0')
    expect(fmtRating(0)).toBe('0.0')
  })
})

describe('label — map enum → tiếng Việt', () => {
  it('hit key có sẵn', () => {
    expect(label(ROLE_LABELS, 'ADMIN')).toBe('QTV chi nhánh')
    expect(label(LOYALTY_TIER_LABELS, 'GOLD')).toBe('Vàng')
    expect(label(BOOKING_STATUS_LABELS, 'CHECKED_IN')).toBe('Đã check-in')
  })

  it('miss key → fallback về value gốc (không crash)', () => {
    expect(label(ROLE_LABELS, 'UNKNOWN_ROLE')).toBe('UNKNOWN_ROLE')
  })

  it('null/undefined/empty → chuỗi rỗng', () => {
    expect(label(ROLE_LABELS, null)).toBe('')
    expect(label(ROLE_LABELS, undefined)).toBe('')
    expect(label(ROLE_LABELS, '')).toBe('')
  })
})

describe('needsAgeConfirm — confirm tuổi cho rating T13+', () => {
  it('T13/T16/T18 → cần confirm', () => {
    expect(needsAgeConfirm('T13')).toBe(true)
    expect(needsAgeConfirm('T16')).toBe(true)
    expect(needsAgeConfirm('T18')).toBe(true)
  })

  it('P/K → KHÔNG cần confirm', () => {
    expect(needsAgeConfirm('P')).toBe(false)
    expect(needsAgeConfirm('K')).toBe(false)
  })

  it('null/undefined → false (defensive)', () => {
    expect(needsAgeConfirm(null)).toBe(false)
    expect(needsAgeConfirm(undefined)).toBe(false)
  })
})

describe('AGE_RATING_MIN_AGE — tuổi tối thiểu', () => {
  it('khớp TT 25/2024/BVHTTDL', () => {
    expect(AGE_RATING_MIN_AGE.P).toBe(0)
    expect(AGE_RATING_MIN_AGE.K).toBe(0)
    expect(AGE_RATING_MIN_AGE.T13).toBe(13)
    expect(AGE_RATING_MIN_AGE.T16).toBe(16)
    expect(AGE_RATING_MIN_AGE.T18).toBe(18)
  })
})
