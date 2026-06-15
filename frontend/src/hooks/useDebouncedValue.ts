import { useEffect, useState } from 'react'

/**
 * Debounce 1 value — return value mới sau khoảng `delayMs` kể từ lần update
 * cuối. Dùng cho search input để tránh fire API mỗi keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(t)
  }, [value, delayMs])
  return debounced
}
