import type { Genre } from '@/types/movie'

interface GenreFilterProps {
  genres: Genre[]
  selected: number | null
  onSelect: (genreId: number | null) => void
}

export default function GenreFilter({ genres, selected, onSelect }: GenreFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          selected === null
            ? 'bg-[#eab308] text-black'
            : 'bg-white/5 text-gray-400 hover:bg-white/10'
        }`}
      >
        Tất cả
      </button>
      {genres.map((genre) => (
        <button
          key={genre.id}
          onClick={() => onSelect(genre.id === selected ? null : genre.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selected === genre.id
              ? 'bg-[#eab308] text-black'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          {genre.name}
        </button>
      ))}
    </div>
  )
}
