# Zustand — Quản lý state phía client

---

## Zustand là gì?

Zustand quản lý **state dùng chung** giữa nhiều component. Nhẹ hơn Redux rất nhiều.

### Khi nào cần Zustand?

| State | Dùng gì | Ví dụ |
|---|---|---|
| State của 1 component | `useState` | Mở/đóng dropdown |
| Data từ server | TanStack Query | Danh sách phim, vé |
| **State dùng chung nhiều component** | **Zustand** | Token, user info, ghế đang chọn |

---

## Auth Store — Quản lý đăng nhập

```tsx
// src/store/authStore.ts
import { create } from 'zustand';

interface AuthState {
    token: string | null;
    username: string | null;
    role: string | null;
    setAuth: (token: string, username: string, role: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    // State ban đầu: đọc từ localStorage (giữ login khi refresh trang)
    token: localStorage.getItem('token'),
    username: localStorage.getItem('username'),
    role: localStorage.getItem('role'),

    // Action: lưu thông tin đăng nhập
    setAuth: (token, username, role) => {
        localStorage.setItem('token', token);
        localStorage.setItem('username', username);
        localStorage.setItem('role', role);
        set({ token, username, role });
    },

    // Action: đăng xuất
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('role');
        set({ token: null, username: null, role: null });
    },
}));
```

### Sử dụng ở bất kỳ đâu

```tsx
// Header.tsx — hiện tên user
function Header() {
    const { username, logout } = useAuthStore();

    return (
        <nav>
            {username ? (
                <>
                    <span>Xin chào, {username}</span>
                    <button onClick={logout}>Đăng xuất</button>
                </>
            ) : (
                <Link to="/login">Đăng nhập</Link>
            )}
        </nav>
    );
}

// LoginPage.tsx — lưu token sau khi login
function LoginPage() {
    const { setAuth } = useAuthStore();

    const handleLogin = async (data) => {
        const res = await api.post('/api/auth/login', data);
        setAuth(res.data.data.accessToken, data.username, 'USER');
        navigate('/');
    };
}

// ProtectedRoute.tsx — kiểm tra đã login chưa
function ProtectedRoute() {
    const token = useAuthStore(state => state.token);
    if (!token) return <Navigate to="/login" />;
    return <Outlet />;
}
```

---

## Seat Selection Store — Quản lý ghế đang chọn

```tsx
// src/store/seatStore.ts
interface SeatState {
    selectedSeats: string[];      // ["E5", "E6", "F5"]
    totalPrice: number;
    addSeat: (seatId: string, price: number) => void;
    removeSeat: (seatId: string, price: number) => void;
    clearSeats: () => void;
}

export const useSeatStore = create<SeatState>((set) => ({
    selectedSeats: [],
    totalPrice: 0,

    addSeat: (seatId, price) => set(state => ({
        selectedSeats: [...state.selectedSeats, seatId],
        totalPrice: state.totalPrice + price,
    })),

    removeSeat: (seatId, price) => set(state => ({
        selectedSeats: state.selectedSeats.filter(id => id !== seatId),
        totalPrice: state.totalPrice - price,
    })),

    clearSeats: () => set({ selectedSeats: [], totalPrice: 0 }),
}));

// SeatMap.tsx — chọn/bỏ ghế
function SeatButton({ seat }) {
    const { selectedSeats, addSeat, removeSeat } = useSeatStore();
    const isSelected = selectedSeats.includes(seat.id);

    return (
        <button
            className={isSelected ? 'bg-green-500' : 'bg-gray-300'}
            onClick={() => isSelected
                ? removeSeat(seat.id, seat.price)
                : addSeat(seat.id, seat.price)
            }
        >
            {seat.seatNumber}
        </button>
    );
}

// BookingSummary.tsx — hiện tổng tiền (component KHÁC nhưng CÙNG state)
function BookingSummary() {
    const { selectedSeats, totalPrice } = useSeatStore();
    return (
        <div>
            <p>Ghế: {selectedSeats.join(', ')}</p>
            <p>Tổng: {totalPrice.toLocaleString()} ₫</p>
        </div>
    );
}
```
