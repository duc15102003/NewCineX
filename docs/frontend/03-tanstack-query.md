# TanStack Query (React Query) -- Giai thich chi tiet cho nguoi moi

---

## 1. TanStack Query la gi?

### Vi du doi thuong

Tuong tuong ban lam viec o van phong. Moi khi can so lieu ban hang, ban phai:
1. Di bo xuong phong ke toan (goi API)
2. Doi ho tra so lieu (loading)
3. Mang so lieu ve ban (hien thi data)
4. Neu ke toan nghi phep → bao loi (error)

Lam viec kieu nay rat **mat thoi gian**. Moi lan can so lieu la phai di xuong hoi lai.

**TanStack Query giong nhu co 1 thu ky rieng:**
- Ban noi "Lay so lieu ban hang thang 5" → thu ky tu di lay
- Thu ky **ghi nho ket qua** (cache) → lan sau ban hoi lai, thu ky tra loi ngay ma **khong can di lai**
- Neu so lieu da cu (het staleTime) → thu ky **tu dong di cap nhat** ma ban khong can nho

### Dinh nghia ky thuat

TanStack Query (truoc goi la React Query) la thu vien quan ly **server state** -- tuc la data tu API backend. No tu dong xu ly:
- **Fetching**: goi API lay data
- **Caching**: luu tam data de khong goi lai lien tuc
- **Synchronizing**: tu dong cap nhat khi data cu
- **Error handling**: bat loi tu dong
- **Loading states**: tu dong biet khi nao dang tai

---

## 2. Tai sao can TanStack Query? (So sanh truoc/sau)

### TRUOC: Viet thu cong bang useState + useEffect

```tsx
// ❌ Code XAU -- lap lai o moi trang
function MovieListPage() {
  const [movies, setMovies] = useState([])      // state chua data
  const [loading, setLoading] = useState(true)   // state loading
  const [error, setError] = useState(null)       // state error

  useEffect(() => {
    setLoading(true)
    api.get('/api/movies')
      .then(res => {
        setMovies(res.data.data.content)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])  // goi khi component mount

  if (loading) return <p>Dang tai...</p>
  if (error) return <p>Loi: {error}</p>

  return (
    <div>
      {movies.map(movie => <MovieCard key={movie.id} movie={movie} />)}
    </div>
  )
}
```

**Van de cua cach nay:**
1. **Lap code**: moi trang deu phai viet `useState` x3 + `useEffect` -- copy-paste lien tuc
2. **Khong co cache**: roi trang phim → vao lai → goi API lai tu dau (nguoi dung thay loading hoai)
3. **Khong tu retry**: API loi 1 lan → hien loi ngay, khong thu lai
4. **Race condition**: user go tim "Av" roi go tiep "Avatar" -- 2 request chay song song, response "Av" co the den SAU "Avatar" → hien sai
5. **Memory leak**: component unmount khi request chua xong → `setMovies` goi tren component da chet → warning

### SAU: Dung useQuery

```tsx
// ✅ Code TOT -- sach, gon, du tinh nang
function MovieListPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['movies'],
    queryFn: async () => {
      const res = await api.get('/api/movies')
      return res.data.data
    },
  })

  if (isLoading) return <p>Dang tai...</p>
  if (isError) return <p>Loi: {error.message}</p>

  return (
    <div>
      {data.content.map(movie => <MovieCard key={movie.id} movie={movie} />)}
    </div>
  )
}
```

**Duoc gi:**
- 1 dong thay vi 15 dong
- Tu dong co cache, retry, loading state, error state
- Khong bi race condition, khong bi memory leak
- Roi trang → vao lai → data hien ngay tu cache (khong loading)

---

## 3. useQuery -- Doc du lieu (GET)

`useQuery` la hook dung de **doc** du lieu tu server. No goi API va tra ve data + cac trang thai.

### Cu phap co ban

```tsx
const result = useQuery({
  queryKey: [...],    // khoa cache (bat buoc)
  queryFn: ...,       // ham goi API (bat buoc)
  enabled: ...,       // co nen goi hay khong (tuy chon)
  staleTime: ...,     // bao lau thi data duoc coi la "cu" (tuy chon)
})
```

### Giai thich TUNG option:

#### queryKey -- Khoa cache (BAT BUOC)

```tsx
queryKey: ['movies']                    // danh sach phim
queryKey: ['movie', 42]                 // chi tiet phim id=42
queryKey: ['movies', { keyword: 'a' }]  // danh sach phim co search "a"
queryKey: ['admin', 'movies', params]   // danh sach phim trang admin
```

**queryKey la gi?** La mot mang dung de **dinh danh duy nhat** cho 1 query. Giong nhu so CMND cua moi request.

**Tai sao quan trong?**
- TanStack Query dung queryKey de **luu cache** va **tim cache**
- 2 component khac nhau cung `queryKey: ['movies']` → chia se **cung 1 data** (khong goi API 2 lan)
- Khi queryKey thay doi (VD: user go search) → **tu dong goi lai API** voi params moi

**Vi du thuc te tu CineX** (`useAdminMovies.ts` dong 20):
```tsx
export function useAdminMovies(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['admin', 'movies', params],
    //         ^^^^^^^  ^^^^^^^^  ^^^^^^
    //         nhom      module   params thay doi → goi lai API
    ...
  })
}
```

Khi `params` thay doi (user go search, chuyen trang) → queryKey khac → tu dong fetch lai.

#### queryFn -- Ham goi API (BAT BUOC)

```tsx
queryFn: async () => {
  const res = await api.get('/api/movies')
  return res.data.data  // ← CHI tra data can thiet, khong tra ca response
}
```

**queryFn la gi?** La ham **thuc su goi API**. No phai return data ma ban muon dung.

**Luu y:** queryFn phai **return** data. Data tra ve se nam trong `result.data`.

**Vi du thuc te** (`useStatistics.ts` dong 39-43):
```tsx
queryFn: async () => {
  const res = await api.get<ApiResponse<OverviewStats>>('/api/statistics/overview')
  return res.data.data  // tra ve object OverviewStats, khong tra ca ApiResponse
},
```

#### enabled -- Co nen goi API hay khong (TUY CHON)

```tsx
enabled: !!movieId   // chi goi khi movieId co gia tri (khong phai 0, null, undefined)
```

**enabled la gi?** La "cong tac on/off" cua query.
- `enabled: true` (mac dinh) → goi API ngay khi component render
- `enabled: false` → KHONG goi API, doi den khi enabled thanh true

**Khi nao can?**
- Trang chi tiet phim: doi co `id` roi moi goi API
- Thong ke: doi user chon ngay roi moi goi API

**Vi du thuc te** (`useStatistics.ts` dong 53):
```tsx
export function useRevenueStats(from: string, to: string) {
  return useQuery({
    queryKey: ['admin', 'revenue', from, to],
    queryFn: async () => { ... },
    enabled: !!from && !!to,  // chi goi khi user da chon ca 2 ngay
  })
}
```

Giai thich: `!!from` chuyen string thanh boolean.
- `!!""` → `false` (chuoi rong → chua chon ngay)
- `!!"2026-05-01"` → `true` (da chon ngay)
- Chi khi **ca 2** deu true → moi goi API

#### staleTime -- Data "tuoi" bao lau (TUY CHON)

```tsx
staleTime: 5 * 60 * 1000   // 5 phut (tinh bang millisecond)
```

**staleTime la gi?** La thoi gian data duoc coi la **con tuoi** (fresh). Trong thoi gian nay, TanStack Query se **tra cache** ma **khong goi lai API**.

- `staleTime: 0` (mac dinh) → data cu ngay luc tra ve → lan sau se goi lai API
- `staleTime: 5 * 60 * 1000` → trong 5 phut, data duoc coi la tuoi, khong goi lai

**Khi nao dat staleTime dai?**
- Data it thay doi: danh sach the loai (genre) → dat 5 phut
- Data thay doi lien tuc: trang dat ve → de mac dinh (0)

**Vi du thuc te** (`useMovies.ts` dong 54):
```tsx
export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: async () => { ... },
    staleTime: 5 * 60 * 1000, // Cache 5 phut (genres it thay doi)
  })
}
```

The loai phim (Hanh dong, Tinh cam, Kinh di...) rat it khi thay doi → cache 5 phut la hop ly.

---

## 4. useMutation -- Tao/Sua/Xoa du lieu (POST, PUT, DELETE)

`useQuery` dung de **doc** (GET). `useMutation` dung de **ghi** (POST, PUT, DELETE).

### Cu phap co ban

```tsx
const mutation = useMutation({
  mutationFn: ...,   // ham goi API (bat buoc)
  onSuccess: ...,    // chay khi thanh cong (tuy chon)
  onError: ...,      // chay khi that bai (tuy chon)
})

// Goi mutation
mutation.mutate(data)
```

### Giai thich tung option:

#### mutationFn -- Ham goi API ghi du lieu

```tsx
mutationFn: async (data: Record<string, unknown>) => {
  const res = await api.post('/api/movies', data)
  return res.data.data
}
```

**Khac gi queryFn?**
- `queryFn`: khong nhan tham so (data lay tu queryKey/closure)
- `mutationFn`: nhan tham so tu `mutation.mutate(data)` -- data la form user dien

#### onSuccess -- Chay khi API thanh cong

```tsx
onSuccess: () => {
  toast.success('Tao phim thanh cong')  // hien thong bao
  qc.invalidateQueries({ queryKey: ['admin', 'movies'] })  // fetch lai danh sach
}
```

Day la noi ban **phan ung** sau khi tao/sua/xoa thanh cong:
- Hien thong bao cho user
- Lam moi danh sach (invalidateQueries -- giai thich o phan 5)
- Dong dialog
- Chuyen trang

#### onError -- Chay khi API that bai

```tsx
onError: (e) => toast.error(getErrorMessage(e, 'Loi'))
```

Bat loi va hien thong bao cho user. Vi du: "Ten phim da ton tai", "Khong co quyen".

### Vi du day du tu CineX

**Tao phim** (`useAdminMovies.ts` dong 28-38):
```tsx
export function useCreateMovie() {
  const qc = useQueryClient()     // lay queryClient de invalidate cache
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post<ApiResponse<unknown>>('/api/movies', data)
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Tao phim thanh cong')
      qc.invalidateQueries({ queryKey: ['admin', 'movies'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Loi')),
  })
}
```

**Xoa phim** (`useAdminMovies.ts` dong 68-74):
```tsx
export function useDeleteMovie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/movies/${id}`)
    },
    onSuccess: () => {
      toast.success('Da xoa')
      qc.invalidateQueries({ queryKey: ['admin', 'movies'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Loi')),
  })
}
```

**Upload poster** (`useAdminMovies.ts` dong 52-66):
```tsx
export function useUploadPoster() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post(`/api/movies/${id}/poster`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Upload poster thanh cong')
      qc.invalidateQueries({ queryKey: ['admin', 'movies'] })
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Upload that bai')),
  })
}
```

### Cach su dung mutation trong component

```tsx
function AdminMoviePage() {
  const createMovie = useCreateMovie()   // lay mutation
  const deleteMovie = useDeleteMovie()

  const handleCreate = (formData) => {
    createMovie.mutate(formData)         // goi API tao phim
  }

  const handleDelete = (id: number) => {
    deleteMovie.mutate(id)               // goi API xoa phim
  }

  return (
    <div>
      <button
        onClick={() => handleCreate({ title: 'Avatar 3', duration: 180 })}
        disabled={createMovie.isPending}  // disable nut khi dang goi API
      >
        {createMovie.isPending ? 'Dang tao...' : 'Tao phim'}
      </button>
    </div>
  )
}
```

**isPending** la state cho biet mutation dang chay. Dung de:
- Disable nut (tranh user bam 2 lan)
- Hien loading spinner tren nut

---

## 5. QueryClient + invalidateQueries -- Tu dong cap nhat danh sach

### Van de

User tao phim moi → API tra ve thanh cong → nhung **danh sach phim van hien phim cu**!

Tai sao? Vi danh sach phim dang dung data tu **cache**. Cache chua biet co phim moi.

### Giai phap: invalidateQueries

```
Tao phim → API thanh cong → invalidateQueries(['admin', 'movies']) → cache bi "vo hieu hoa"
→ TanStack Query tu dong goi lai GET /api/movies → danh sach cap nhat voi phim moi
```

**invalidateQueries** co nghia la "danh dau cache nay la CU, hay goi lai API".

### Cach hoat dong

```tsx
// Buoc 1: Lay queryClient
const qc = useQueryClient()

// Buoc 2: Sau khi mutation thanh cong, invalidate cache
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ['admin', 'movies'] })
  //                                 ^^^^^^^^^^^^^^^^^
  //  Tat ca query co key BAT DAU bang ['admin', 'movies'] se bi invalidate
  //  Vi du: ['admin', 'movies', { page: 0 }]
  //         ['admin', 'movies', { page: 1, keyword: 'a' }]
  //  → TAT CA deu bi invalidate → goi lai API
}
```

**Luu y quan trong:** `queryKey` match theo **prefix** (tien to).
- Invalidate `['admin', 'movies']` → invalidate CA:
  - `['admin', 'movies']`
  - `['admin', 'movies', { page: 0 }]`
  - `['admin', 'movies', { page: 1, keyword: 'abc' }]`

### Vi du thuc te -- Tao review cho phim

```tsx
// useReviews.ts dong 31-44
export function useCreateReview(movieId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { rating: number; comment: string }) => {
      const res = await api.post(`/api/movies/${movieId}/reviews`, data)
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Da gui danh gia')
      qc.invalidateQueries({ queryKey: ['reviews', movieId] })
      //  ↑ Cap nhat danh sach review cua phim nay
      qc.invalidateQueries({ queryKey: ['movie', movieId] })
      //  ↑ Cap nhat chi tiet phim (vi rating trung binh thay doi)
    },
  })
}
```

Khi user gui review → can cap nhat **2 cho**:
1. Danh sach review (co them review moi)
2. Chi tiet phim (rating trung binh thay doi)

---

## 6. Loading / Error states

useQuery va useMutation tra ve cac trang thai de ban xu ly UI:

### useQuery states

```tsx
const {
  data,         // du lieu tra ve tu queryFn (undefined khi chua co)
  isLoading,    // true khi dang goi API LAN DAU (chua co cache)
  isFetching,   // true khi dang goi API (ke ca khi da co cache, dang refetch)
  isError,      // true khi API tra loi hoac throw error
  error,        // object error chi tiet
  isSuccess,    // true khi co data thanh cong
} = useQuery({ ... })
```

**isLoading vs isFetching -- khac nhau the nao?**
- `isLoading`: chi true khi **chua co data nao** (lan dau load). Hien skeleton/spinner
- `isFetching`: true khi dang goi API, **ke ca khi da co cache**. Hien indicator nho
- Vi du: lan 1 vao trang → `isLoading = true, isFetching = true`
- Roi trang → vao lai → `isLoading = false (co cache), isFetching = true (dang refetch)`

### Su dung trong component

```tsx
function MovieListPage() {
  const { data, isLoading, isError, error } = useMovies({ page: 0 })

  // Truong hop 1: Dang tai lan dau
  if (isLoading) return <Skeleton />

  // Truong hop 2: Loi
  if (isError) return <p>Loi: {error.message}</p>

  // Truong hop 3: Co data
  return (
    <div>
      {data.content.map(movie => (
        <MovieCard key={movie.id} movie={movie} />
      ))}
    </div>
  )
}
```

### useMutation states

```tsx
const mutation = useMutation({ ... })

mutation.isPending   // true khi dang goi API (dung de disable nut)
mutation.isSuccess   // true khi thanh cong
mutation.isError     // true khi that bai
mutation.error       // object error
```

---

## 7. Code thuc te tu CineX

### 7.1 useAdminMovies -- CRUD phim cho trang admin

File: `frontend/src/hooks/useAdminMovies.ts`

| Hook | Loai | Lam gi |
|---|---|---|
| `useAdminMovies(params)` | useQuery | Lay danh sach phim (co search, phan trang) |
| `useCreateMovie()` | useMutation | Tao phim moi |
| `useUpdateMovie()` | useMutation | Cap nhat phim |
| `useUploadPoster()` | useMutation | Upload anh poster |
| `useDeleteMovie()` | useMutation | Xoa 1 phim |
| `useBulkDeleteMovies()` | useMutation | Xoa nhieu phim cung luc |
| `useBulkRestoreMovies()` | useMutation | Khoi phuc nhieu phim da xoa |

**Pattern chung:** Moi useMutation deu:
1. Lay `useQueryClient()` de invalidate cache sau khi thanh cong
2. `onSuccess`: hien toast + invalidate `['admin', 'movies']`
3. `onError`: hien toast loi

### 7.2 useTopMovies -- Thong ke phim ban chay

File: `frontend/src/hooks/useStatistics.ts`

```tsx
export function useTopMovies(from: string, to: string) {
  return useQuery({
    queryKey: ['admin', 'topMovies', from, to],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TopMovie[]>>('/api/statistics/top-movies', {
        params: { limit: 100, from, to },
      })
      return res.data.data
    },
    enabled: !!from && !!to,  // chi goi khi user chon khoang thoi gian
  })
}
```

**Diem hay:**
- `queryKey` chua `from` va `to` → doi ngay → key doi → tu dong fetch lai
- `enabled: !!from && !!to` → khong goi API khi chua chon ngay

### 7.3 useReviews -- Danh gia phim

File: `frontend/src/hooks/useReviews.ts`

```tsx
// Doc danh sach review
export function useReviews(movieId: number) {
  return useQuery({
    queryKey: ['reviews', movieId],
    queryFn: async () => {
      const res = await api.get(`/api/movies/${movieId}/reviews`, {
        params: { size: 20 },
      })
      return res.data.data
    },
    enabled: !!movieId,  // doi co movieId moi goi
  })
}

// Tao review moi
export function useCreateReview(movieId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { rating: number; comment: string }) => {
      const res = await api.post(`/api/movies/${movieId}/reviews`, data)
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Da gui danh gia')
      qc.invalidateQueries({ queryKey: ['reviews', movieId] })  // cap nhat list review
      qc.invalidateQueries({ queryKey: ['movie', movieId] })    // cap nhat rating phim
    },
  })
}
```

### 7.4 useGenres -- Vi du ve staleTime

```tsx
export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: async () => {
      const res = await api.get('/api/genres', { params: { size: 50 } })
      return res.data.data.content
    },
    staleTime: 5 * 60 * 1000, // 5 phut
  })
}
```

The loai phim it thay doi → cache 5 phut. Trong 5 phut do, bat ky component nao goi `useGenres()` deu nhan data tu cache ma khong goi API.

---

## 8. Cache hoat dong the nao?

### So do luong xu ly

```
Lan 1: User vao trang Phim
┌─────────────────────────────────────────────────────────┐
│  Component goi useQuery({ queryKey: ['movies'] })       │
│         ↓                                                │
│  TanStack Query: "Co cache cho ['movies'] khong?"       │
│         ↓                                                │
│     KHONG CO  →  Goi queryFn()  →  GET /api/movies      │
│         ↓                                                │
│  API tra ve data  →  Luu vao cache  →  Tra cho component│
│         ↓                                                │
│  Component hien danh sach phim                           │
└─────────────────────────────────────────────────────────┘

Lan 2: User roi trang → quay lai trang Phim
┌─────────────────────────────────────────────────────────┐
│  Component goi useQuery({ queryKey: ['movies'] })       │
│         ↓                                                │
│  TanStack Query: "Co cache cho ['movies'] khong?"       │
│         ↓                                                │
│     CO CACHE  →  Tra data tu cache NGAY LAP TUC         │
│         ↓              (khong loading)                   │
│  Component hien danh sach phim (tu cache)                │
│         ↓                                                │
│  Dong thoi: Check staleTime                              │
│    - Neu data con "tuoi" → khong lam gi                  │
│    - Neu data da "cu" → goi lai API ngam → cap nhat UI   │
└─────────────────────────────────────────────────────────┘
```

### Vi du cu the

1. **09:00** - User mo trang quan ly phim
   - Cache rong → goi `GET /api/movies` → hien loading → hien data
   - Data duoc luu cache voi key `['admin', 'movies', { page: 0 }]`

2. **09:01** - User chuyen sang trang Phong chieu
   - Component phim unmount, nhung **cache van ton tai**

3. **09:02** - User quay lai trang Phim
   - TanStack Query thay da co cache → **hien data ngay** (khong loading!)
   - Dong thoi goi lai API ngam (background refetch) → neu data moi khac → cap nhat UI

4. **09:03** - User tao phim moi
   - `useCreateMovie` goi API POST → thanh cong
   - `invalidateQueries(['admin', 'movies'])` → danh dau cache la cu
   - TanStack Query tu dong goi lai `GET /api/movies` → danh sach cap nhat

### staleTime anh huong the nao?

```
staleTime: 0 (mac dinh)
├── Lan 1: fetch API → luu cache
├── Lan 2: tra cache NGAY + fetch lai ngam (vi data da "cu" ngay luc tra ve)
└── → User thay data ngay, nhung API van duoc goi lai de cap nhat

staleTime: 5 phut
├── Lan 1: fetch API → luu cache
├── Lan 2 (trong vong 5 phut): tra cache NGAY, KHONG fetch lai
├── Lan 3 (sau 5 phut): tra cache NGAY + fetch lai ngam
└── → Giam so lan goi API, phu hop data it thay doi (genres, config)
```

---

## 9. QueryClient -- Cau hinh chung

File: `frontend/src/App.tsx`

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,                    // API loi → thu lai 1 lan roi moi bao loi
      refetchOnWindowFocus: false,  // Khong goi lai API khi user chuyen tab quay lai
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/*  ↑ Cung cap queryClient cho TOAN BO ung dung */}
      <AppRouter />
      <Toaster />
    </QueryClientProvider>
  )
}
```

**Giai thich tung option:**

| Option | Gia tri | Y nghia |
|---|---|---|
| `retry: 1` | Thu lai 1 lan | API loi (mat mang, server 500) → doi vai giay → thu lai 1 lan. Neu van loi → bao loi |
| `refetchOnWindowFocus: false` | Tat | Mac dinh TanStack Query se goi lai API khi user chuyen tab roi quay lai. CineX tat tinh nang nay de tranh goi API khong can thiet |

**QueryClientProvider** giong nhu "o cam dien" -- ban cam vao la tat ca component con deu su dung duoc `useQuery`, `useMutation`, `useQueryClient`.

---

## 10. Tom tat bang so sanh

| Tinh nang | useState + useEffect | TanStack Query |
|---|---|---|
| Code can viet | 15-20 dong moi trang | 5-7 dong (hook) |
| Cache | Khong co | Tu dong |
| Loading state | Tu viet | Co san (isLoading) |
| Error handling | Tu viet try/catch | Co san (isError) |
| Retry khi loi | Tu viet | Tu dong (retry: 1) |
| Refetch khi data cu | Tu viet setInterval | Tu dong (staleTime) |
| Invalidate sau mutation | Tu viet fetchMovies() lai | 1 dong invalidateQueries |
| Race condition | De bi loi | Xu ly tu dong |
| Memory leak | Phai cleanup | Xu ly tu dong |

---

## 11. Cau hoi tu kiem tra

**Cau 1:** Neu 2 component khac nhau cung goi `useQuery({ queryKey: ['movies'] })`, TanStack Query se goi API may lan?

> Tra loi: Chi **1 lan**. Vi cung queryKey nen chia se cache. Component thu 2 nhan data tu cache.

**Cau 2:** Trong `useCreateReview`, tai sao phai invalidate **2 query** (`['reviews', movieId]` va `['movie', movieId]`)?

> Tra loi: Vi khi tao review moi, **2 data** bi thay doi: (1) danh sach review co them review moi, (2) rating trung binh cua phim thay doi. Nen can invalidate ca 2 de cap nhat.

**Cau 3:** Neu bo `enabled: !!from && !!to` trong `useRevenueStats`, dieu gi se xay ra?

> Tra loi: API se duoc goi ngay khi component render, voi `from=""` va `to=""` → backend tra loi hoac tra data rong → UX xau (hien loading roi hien rong). Them enabled de **doi user chon ngay roi moi goi API**.

**Cau 4:** `staleTime: 5 * 60 * 1000` dat cho `useGenres()` nhung khong dat cho `useAdminMovies()`. Tai sao?

> Tra loi: The loai phim (genres) **rat it thay doi** (them/xoa the loai la hanh dong hiem) → cache 5 phut hoan toan hop ly, giam API call. Danh sach phim trang admin **thay doi lien tuc** (tao/sua/xoa phim) → can data moi nhat, khong nen cache lau.

**Cau 5:** Sau khi goi `invalidateQueries({ queryKey: ['admin', 'movies'] })`, cac query nao bi anh huong?

> Tra loi: **Tat ca** query co key **bat dau** bang `['admin', 'movies']`, vi du:
> - `['admin', 'movies']`
> - `['admin', 'movies', { page: 0 }]`
> - `['admin', 'movies', { page: 1, keyword: 'avatar' }]`
>
> Tat ca deu bi danh dau la "cu" va se duoc fetch lai. Day la **prefix matching**.
