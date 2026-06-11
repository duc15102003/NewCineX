import { useState } from 'react'
import { Star, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/store/authStore'
import { useReviews, useCreateReview, useDeleteReview } from '@/hooks/useReviews'
import { fmtDate } from '@/utils/labels'

interface ReviewSectionProps {
  movieId: number
}

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 10 }, (_, i) => i + 1).map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer'} transition-colors`}
        >
          <Star
            size={readonly ? 12 : 18}
            className={(hover || value) >= star ? 'text-[#ffc107] fill-[#ffc107]' : 'text-gray-600'}
          />
        </button>
      ))}
      {value > 0 && <span className="text-sm text-[#ffc107] font-semibold ml-1">{value}/10</span>}
    </div>
  )
}

export default function ReviewSection({ movieId }: ReviewSectionProps) {
  const { user, isLoggedIn } = useAuthStore()
  const { data: reviewsData } = useReviews(movieId)
  const createReview = useCreateReview(movieId)
  const deleteReview = useDeleteReview(movieId)

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const reviews = reviewsData?.content ?? []

  function handleSubmit() {
    if (rating === 0) return
    createReview.mutate({ rating, comment }, {
      onSuccess: () => { setRating(0); setComment('') },
    })
  }

  return (
    <div>
      <div className="mb-6">
        <div className="w-10 h-1 bg-[#ffc107] rounded-full mb-3" />
        <h2 className="text-2xl font-bold text-white">Đánh giá ({reviewsData?.totalElements ?? 0})</h2>
      </div>

      {/* Form viết review — chỉ hiện khi đã login */}
      {isLoggedIn() && (
        <div className="bg-[#201b11] border border-white/5 rounded-2xl p-5 mb-6">
          <p className="text-sm text-gray-400 mb-3">Đánh giá của bạn</p>
          <StarRating value={rating} onChange={setRating} />
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Chia sẻ cảm nhận về phim..."
            rows={3}
            className="mt-3"
            maxLength={1000}
          />
          <p className="text-xs text-gray-500 text-right mt-1">{comment.length}/1000</p>
          <div className="flex justify-end mt-3">
            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || createReview.isPending}
              className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold"
            >
              <Send size={14} className="mr-1" /> Gửi đánh giá
            </Button>
          </div>
        </div>
      )}

      {/* Danh sách reviews */}
      {reviews.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Chưa có đánh giá nào cho phim này</p>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="bg-[#201b11] border border-white/5 rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {r.avatarUrl ? (
                    <img src={r.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ffc107] to-[#e6ac06] flex items-center justify-center text-black text-xs font-bold">
                      {r.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{r.username}</p>
                    <p className="text-[10px] text-gray-500">{fmtDate(r.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StarRating value={r.rating} readonly />
                  {user?.username === r.username && (
                    <button
                      onClick={() => deleteReview.mutate(r.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors ml-2"
                      title="Xóa đánh giá"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {r.comment && (
                <p className="text-sm text-gray-300 mt-3 leading-relaxed">{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
