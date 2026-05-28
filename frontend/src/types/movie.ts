export interface MovieListItem {
  id: number
  storageState: string
  title: string
  posterUrl: string | null
  duration: number
  rating: number | null
  status: string
  genres: string[]
  createdAt: string
  updatedAt: string
}

export interface MovieDetail {
  id: number
  storageState: string
  title: string
  description: string | null
  duration: number
  releaseDate: string | null
  endDate: string | null
  posterUrl: string | null
  trailerUrl: string | null
  director: string | null
  cast: string | null
  language: string | null
  rating: number | null
  status: string
  genres: { id: number; name: string; description: string | null }[]
  createdAt: string
  updatedAt: string
}

export interface Genre {
  id: number
  name: string
  description: string | null
}

export interface ShowtimeItem {
  id: number
  movieTitle: string
  moviePosterUrl: string | null
  roomName: string
  roomType: string
  startTime: string
  endTime: string
  basePrice: number
  vipPrice: number | null
  couplePrice: number | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}
