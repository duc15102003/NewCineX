import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import AppRouter from './routes/AppRouter'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Giữ data cũ khi queryKey đổi (vd search keyword) — tránh data về undefined
      // làm component nháy về Loading, gây remount Input → mất focus mỗi keystroke.
      placeholderData: keepPreviousData,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      <Toaster />
    </QueryClientProvider>
  )
}
