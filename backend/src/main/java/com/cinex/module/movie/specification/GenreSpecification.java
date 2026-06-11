package com.cinex.module.movie.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.movie.dto.GenreFilter;
import com.cinex.module.movie.entity.Genre;
import com.cinex.module.movie.entity.Movie;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

public class GenreSpecification {

    private GenreSpecification() {}

    public static Specification<Genre> fromFilter(GenreFilter filter) {
        Specification<Genre> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(keywordLike(filter.getKeyword()));
        }
        if (filter.getHasMovies() != null) {
            spec = spec.and(hasMovies(filter.getHasMovies()));
        }
        return spec;
    }

    /**
     * LIKE trên name OR description (case-insensitive).
     * Description có thể null → coalesce sang chuỗi rỗng để tránh predicate null.
     */
    public static Specification<Genre> keywordLike(String keyword) {
        return (root, query, cb) -> {
            String pattern = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("name")), pattern),
                    cb.like(cb.lower(cb.coalesce(root.get("description"), "")), pattern)
            );
        };
    }

    /**
     * Alias cũ giữ tương thích — search chỉ trên name.
     */
    public static Specification<Genre> hasName(String keyword) {
        return (root, query, cb) ->
                cb.like(cb.lower(root.get("name")), "%" + keyword.toLowerCase() + "%");
    }

    /**
     * Genre đang/chưa được dùng trong movie nào.
     *
     * Owning side là Movie ({@code @ManyToMany ... @JoinTable(name="movie_genres")}),
     * nên không thể join từ Genre trực tiếp — phải dùng subquery EXISTS chạy ngược
     * từ Movie sang Genre.
     *
     * @param hasMovies true = genre có ít nhất 1 movie; false = genre không có movie nào
     */
    public static Specification<Genre> hasMovies(boolean hasMovies) {
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<Movie> movieRoot = sub.from(Movie.class);
            sub.select(movieRoot.get("id"))
               .where(cb.isMember(root, movieRoot.<java.util.Set<Genre>>get("genres")));
            return hasMovies ? cb.exists(sub) : cb.not(cb.exists(sub));
        };
    }

    public static Specification<Genre> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }
}
