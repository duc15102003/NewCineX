interface EmptyStateProps {
  message?: string
}

export default function EmptyState({ message = 'Không có dữ liệu' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
      <p className="text-lg">{message}</p>
    </div>
  )
}
