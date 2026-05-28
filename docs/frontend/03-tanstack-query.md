# TanStack Query — Quản lý data từ server

---

## Vấn đề cần giải quyết

Mỗi trang cần gọi API → phải xử lý: loading, error, cache, refetch, retry.
Viết thủ công bằng useState + useEffect → **lặp lại rất nhiều code**.

---

## useQuery — Đọc dữ liệu (GET)

### Cơ bản

```tsx
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

function MovieListPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['movies'],                        // ← key cache (unique)
        queryFn: () => api.get('/api/movies'),       // ← hàm gọi API
    });

    if (isLoading) return <Loading />;               // loading state
    if (error) return <p>Lỗi: {error.message}</p>;  // error state

    return (
        <div>
            {data?.data.content.map(movie => (
                <MovieCard key={movie.id} movie={movie} />
            ))}
        </div>
    );
}
```

### Với tham số (search, filter, pagination)

```tsx
function MovieListPage() {
    const [keyword, setKeyword] = useState('');
    const [genreId, setGenreId] = useState<number | null>(null);
    const [page, setPage] = useState(0);

    const debouncedKeyword = useDebounce(keyword, 300);

    const { data, isLoading } = useQuery({
        queryKey: ['movies', debouncedKeyword, genreId, page],
        // ↑ key thay đổi → tự gọi lại API
        queryFn: () => api.get('/api/movies', {
            params: { search: debouncedKeyword, genreId, page, size: 10 }
        }),
    });

    return (
        <div>
            <input value={keyword} onChange={e => setKeyword(e.target.value)} />
            {/* keyword thay đổi → debounce → queryKey đổi → tự gọi API */}
        </div>
    );
}
```

### Chi tiết 1 record

```tsx
function MovieDetailPage() {
    const { id } = useParams();

    const { data: movie, isLoading } = useQuery({
        queryKey: ['movie', id],              // cache theo id
        queryFn: () => api.get(`/api/movies/${id}`),
        enabled: !!id,                        // chỉ gọi khi có id
    });
}
```

---

## useMutation — Ghi dữ liệu (POST, PUT, DELETE)

### Cơ bản

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function LoginPage() {
    const navigate = useNavigate();
    const { setToken } = useAuthStore();

    const loginMutation = useMutation({
        mutationFn: (data: LoginRequest) => api.post('/api/auth/login', data),
        onSuccess: (response) => {
            setToken(response.data.data.accessToken);
            navigate('/');
        },
        onError: (error) => {
            alert('Sai tài khoản hoặc mật khẩu');
        },
    });

    const handleSubmit = (data: LoginRequest) => {
        loginMutation.mutate(data);
    };

    return (
        <form onSubmit={handleSubmit}>
            {/* ... form fields ... */}
            <button disabled={loginMutation.isPending}>
                {loginMutation.isPending ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
        </form>
    );
}
```

### Invalidate cache sau khi mutation

```tsx
function AdminMovieForm() {
    const queryClient = useQueryClient();

    const createMovie = useMutation({
        mutationFn: (data) => api.post('/api/movies', data),
        onSuccess: () => {
            // Xóa cache danh sách phim → tự gọi lại API lấy danh sách mới
            queryClient.invalidateQueries({ queryKey: ['movies'] });
            navigate('/admin/movies');
        },
    });
}
```

---

## Custom Hooks — Tách API logic ra khỏi component

```tsx
// src/hooks/useMovies.ts
export function useMovies(params: MovieSearchParams) {
    return useQuery({
        queryKey: ['movies', params],
        queryFn: () => api.get('/api/movies', { params }),
    });
}

export function useMovie(id: string) {
    return useQuery({
        queryKey: ['movie', id],
        queryFn: () => api.get(`/api/movies/${id}`),
        enabled: !!id,
    });
}

export function useCreateMovie() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: MovieRequest) => api.post('/api/movies', data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['movies'] }),
    });
}

// Component — sạch sẽ, chỉ lo UI
function MovieListPage() {
    const { data, isLoading } = useMovies({ page: 0, size: 10 });
    // 1 dòng lấy data, không cần biết API gọi thế nào
}
```

---

## QueryClient Config — Cấu hình chung

```tsx
// App.tsx
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,                    // Lỗi → thử lại 1 lần
            refetchOnWindowFocus: false,  // Không gọi lại khi quay lại tab
            staleTime: 5 * 60 * 1000,    // Cache 5 phút mới coi là "cũ"
        },
    },
});

<QueryClientProvider client={queryClient}>
    <App />
</QueryClientProvider>
```
