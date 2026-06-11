/**
 * Helper gom data theo chi nhánh — dùng cho admin tables khi SUPER_ADMIN
 * chọn "Tất cả chi nhánh" → list phải group rows theo theater.
 *
 * <p>Item phải có 3 field (đã expose từ BE): theaterId / theaterName / theaterCity.
 * Item không có theaterId (vd booking POS không thuộc chi nhánh) sẽ bị skip.
 *
 * <p>Result sort theo theaterName để UI ổn định giữa các lần render.
 */

export interface TheaterGroup<T> {
  theaterId: number
  theaterName: string
  theaterCity: string
  items: T[]
}

type TheaterAware = {
  theaterId?: number | null
  theaterName?: string | null
  theaterCity?: string | null
}

export function groupByTheater<T extends TheaterAware>(items: T[]): TheaterGroup<T>[] {
  const map = new Map<number, TheaterGroup<T>>()
  for (const it of items) {
    if (it.theaterId == null) continue
    const tid = it.theaterId
    if (!map.has(tid)) {
      map.set(tid, {
        theaterId: tid,
        theaterName: it.theaterName ?? `Chi nhánh #${tid}`,
        theaterCity: it.theaterCity ?? '',
        items: [],
      })
    }
    map.get(tid)!.items.push(it)
  }
  return Array.from(map.values()).sort((a, b) =>
      a.theaterName.localeCompare(b.theaterName),
  )
}
