# shadcn/ui — Thư viện UI component chuẩn 2025-2026

---

## shadcn/ui là gì?

Không phải thư viện cài bằng `npm install`. Nó là bộ **component copy vào project**, bạn sở hữu code, tùy chỉnh thoải mái.

### Tại sao không tự build component?

| Tự build (cũ) | shadcn-style (CineX) |
|---|---|
| Phải viết 37+ components từ đầu | Copy/adapt component chuẩn, đã test kỹ |
| Thiếu accessibility (screen reader) | Dùng semantic HTML + ARIA attributes |
| Style tự viết, dễ inconsistent | Tailwind CSS chuẩn, nhất quán |
| Mất 2-3 ngày | 10 phút |
| Chỉ mình dùng, chưa ai test | Pattern chuẩn industry, triệu dev đã dùng |

> **Lưu ý:** CineX KHÔNG cài `@radix-ui/*`. Components viết bằng HTML native + Tailwind + cva.
> Lấy cảm hứng từ shadcn/ui nhưng đơn giản hơn (phù hợp học).

### Ai dùng?
Vercel, Netflix, và hầu hết startup/project mới trong 2025-2026.

---

## Cài đặt trong CineX

### Dependencies đã cài

```bash
npm install class-variance-authority clsx tailwind-merge lucide-react sonner
```

| Package | Tác dụng |
|---|---|
| `class-variance-authority` (cva) | Tạo variants cho component (VD: Button có variant primary/secondary/danger) |
| `clsx` | Nối className có điều kiện: `clsx('btn', isActive && 'active')` |
| `tailwind-merge` | Merge Tailwind classes thông minh: `twMerge('px-2 px-4')` → `'px-4'` (không bị trùng) |
| `lucide-react` | 1000+ icons SVG dạng React component |
| `sonner` | Toast notification (thông báo góc phải) |

### Hàm `cn()` — Utility gốc

```tsx
// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Sử dụng:
cn('px-4 py-2', isActive && 'bg-blue-500', className)
// → merge class thông minh, bỏ class trùng
```

### Path alias `@/`

```tsx
// Thay vì:
import { Button } from '../../../components/ui/button'

// Dùng:
import { Button } from '@/components/ui/button'
// @/ = src/ (cấu hình trong tsconfig.app.json + vite.config.ts)
```

---

## Components có sẵn trong CineX

### Button — Nút bấm

```tsx
import { Button } from '@/components/ui/button'

<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><PlusIcon /></Button>

<Button loading>Saving...</Button>
<Button disabled>Disabled</Button>
```

### Input — Ô nhập liệu

```tsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="you@example.com" />
</div>
```

### Input + react-hook-form + zod

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const schema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

function RegisterForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    await api.post('/api/auth/register', data)
    toast.success('Registration successful!')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="username">Username *</Label>
        <Input id="username" {...register('username')} placeholder="Enter username" />
        {errors.username && <p className="text-sm text-red-500 mt-1">{errors.username.message}</p>}
      </div>

      <div>
        <Label htmlFor="email">Email *</Label>
        <Input id="email" type="email" {...register('email')} placeholder="you@example.com" />
        {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <Label htmlFor="password">Password *</Label>
        <Input id="password" type="password" {...register('password')} placeholder="••••••" />
        {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>}
      </div>

      <Button type="submit" loading={isSubmitting} className="w-full">
        Register
      </Button>
    </form>
  )
}
```

### Card — Khung chứa nội dung

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Avengers: Endgame</CardTitle>
    <CardDescription>Action, Sci-Fi | 150 min</CardDescription>
  </CardHeader>
  <CardContent>
    <p>The epic conclusion to the Infinity Saga...</p>
  </CardContent>
  <CardFooter>
    <Button>Book Now</Button>
  </CardFooter>
</Card>
```

### Badge — Nhãn trạng thái

```tsx
import { Badge } from '@/components/ui/badge'

<Badge>Default</Badge>
<Badge variant="success">Now Showing</Badge>
<Badge variant="warning">Coming Soon</Badge>
<Badge variant="destructive">Ended</Badge>
<Badge variant="secondary">2D</Badge>
<Badge variant="outline">IMAX</Badge>
```

### Dialog — Modal popup

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

const [open, setOpen] = useState(false)

<Button onClick={() => setOpen(true)}>Open</Button>

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent onClose={() => setOpen(false)}>
    <DialogHeader>
      <DialogTitle>Confirm Booking</DialogTitle>
      <DialogDescription>Are you sure you want to book these seats?</DialogDescription>
    </DialogHeader>
    <p>Seats: E5, E6 | Total: 200,000 VND</p>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={handleConfirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Table — Bảng dữ liệu

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Movie</TableHead>
      <TableHead>Duration</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {movies.map(movie => (
      <TableRow key={movie.id}>
        <TableCell>{movie.title}</TableCell>
        <TableCell>{movie.duration} min</TableCell>
        <TableCell><Badge variant="success">{movie.status}</Badge></TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Tabs — Tab panels

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

<Tabs defaultValue="now-showing">
  <TabsList>
    <TabsTrigger value="now-showing">Now Showing</TabsTrigger>
    <TabsTrigger value="coming-soon">Coming Soon</TabsTrigger>
  </TabsList>
  <TabsContent value="now-showing">
    {/* Danh sách phim đang chiếu */}
  </TabsContent>
  <TabsContent value="coming-soon">
    {/* Danh sách phim sắp chiếu */}
  </TabsContent>
</Tabs>
```

### Skeleton — Loading placeholder

```tsx
import { Skeleton } from '@/components/ui/skeleton'

// Loading movie card
<div className="space-y-3">
  <Skeleton className="h-48 w-full rounded-lg" />
  <Skeleton className="h-4 w-2/3" />
  <Skeleton className="h-4 w-1/3" />
</div>
```

### Toast — Thông báo (sonner)

```tsx
import { toast } from 'sonner'

// Gọi ở bất kỳ đâu (không cần import component)
toast.success('Booking confirmed!')
toast.error('Payment failed')
toast.warning('Seat E5 is no longer available')
toast.info('Your session will expire in 2 minutes')

// Toast với action
toast('Movie added', {
  description: 'Avengers has been added successfully',
  action: {
    label: 'View',
    onClick: () => navigate('/movies/1'),
  },
})
```

### Icons — lucide-react

```tsx
import { Plus, Trash2, Search, Eye, Download, X, Check, AlertCircle } from 'lucide-react'

<Button><Plus className="h-4 w-4" /> Add Movie</Button>
<Button variant="destructive"><Trash2 className="h-4 w-4" /> Delete</Button>

// Danh sách icons: https://lucide.dev/icons
```

---

## Thêm component mới

Vào https://ui.shadcn.com → chọn component → copy code → paste vào `src/components/ui/`.

Hoặc tự tạo component mới theo cùng pattern:

```tsx
// src/components/ui/my-component.tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

interface MyComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary'
}

const MyComponent = React.forwardRef<HTMLDivElement, MyComponentProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'base-classes',
        variant === 'primary' && 'primary-classes',
        className,
      )}
      {...props}
    />
  ),
)
MyComponent.displayName = 'MyComponent'

export { MyComponent }
```
