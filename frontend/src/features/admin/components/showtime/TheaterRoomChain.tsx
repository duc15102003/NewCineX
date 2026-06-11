import type { useForm } from 'react-hook-form'
import { label, ROOM_TYPE_LABELS } from '@/utils/labels'
import type { Theater } from '@/hooks/useAdminTheaters'
import type { AdminRoom } from '@/hooks/useAdminRooms'
import type { ShowtimeFormData } from './types'
import { SELECT_CLS } from './types'

export interface TheaterRoomChainProps {
  register: ReturnType<typeof useForm<ShowtimeFormData>>['register']
  errors: ReturnType<typeof useForm<ShowtimeFormData>>['formState']['errors']
  theaterLocked: boolean
  isBranchAdminUser: boolean
  theaters: Theater[]
  filteredRooms: AdminRoom[]
  selectedTheaterId: number | '' | undefined
  onTheaterChange: () => void
}

/**
 * Chained dropdown chi nhánh → phòng. Đổi chi nhánh tự reset roomId.
 * Locked: ẩn dropdown chi nhánh (chỉ hiện badge), phòng full width.
 */
export default function TheaterRoomChain({
  register, errors, theaterLocked, isBranchAdminUser, theaters, filteredRooms,
  selectedTheaterId, onTheaterChange,
}: TheaterRoomChainProps) {
  if (theaterLocked) {
    const theater = theaters.find(t => t.id === selectedTheaterId)
    const display = theater ? `${theater.name} — ${theater.city}` : `Chi nhánh #${selectedTheaterId}`
    return (
      <>
        <div className="col-span-6">
          <label className="text-sm text-gray-400 mb-1.5 block">
            Chi nhánh <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center gap-2 p-2.5 rounded-md border border-white/10 bg-[#2a2317]/40 h-10">
            <span className="text-white text-sm font-medium truncate">{display}</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">
            {isBranchAdminUser
              ? 'Chi nhánh được gán theo tài khoản.'
              : 'Đổi ở dropdown trên cùng nếu cần.'}
          </p>
          <input type="hidden" {...register('theaterId', { onChange: onTheaterChange })} />
        </div>
        <div className="col-span-6">
          <label className="text-sm text-gray-400 mb-1.5 block">Phòng chiếu <span className="text-red-400">*</span></label>
          <select {...register('roomId', { required: 'Vui lòng chọn phòng' })}
            className={SELECT_CLS}>
            <option value="">-- Chọn phòng --</option>
            {filteredRooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name} ({label(ROOM_TYPE_LABELS, r.type)})</option>
            ))}
          </select>
          {errors.roomId && <p className="text-red-400 text-xs mt-1">{String(errors.roomId.message)}</p>}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">
          Chi nhánh <span className="text-red-400">*</span>
        </label>
        <select {...register('theaterId', {
          required: 'Vui lòng chọn chi nhánh',
          onChange: onTheaterChange,
        })}
          className={SELECT_CLS}>
          <option value="">-- Chọn chi nhánh --</option>
          {theaters.map((t) => (
            <option key={t.id} value={t.id}>{t.name} — {t.city}</option>
          ))}
        </select>
        {errors.theaterId && <p className="text-red-400 text-xs mt-1">{String(errors.theaterId.message)}</p>}
      </div>
      <div className="col-span-6">
        <label className="text-sm text-gray-400 mb-1.5 block">Phòng chiếu <span className="text-red-400">*</span></label>
        <select {...register('roomId', { required: 'Vui lòng chọn phòng' })}
          disabled={!selectedTheaterId}
          className={`${SELECT_CLS} disabled:opacity-60 disabled:cursor-not-allowed`}>
          <option value="">{!selectedTheaterId ? '-- Chọn chi nhánh trước --' : '-- Chọn phòng --'}</option>
          {filteredRooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name} ({label(ROOM_TYPE_LABELS, r.type)})</option>
          ))}
        </select>
        {errors.roomId && <p className="text-red-400 text-xs mt-1">{String(errors.roomId.message)}</p>}
      </div>
    </>
  )
}
