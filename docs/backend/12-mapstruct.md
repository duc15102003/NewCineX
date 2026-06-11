# MapStruct — Mapper Entity ↔ DTO compile-time

> Lib `org.mapstruct:mapstruct:1.6.3` — code generator chuyển Entity ↔ DTO **tại compile time**, không reflection.

---

## 1. Vấn đề: Map tay thì cồng kềnh

Mỗi controller cần Entity → Response DTO. Viết tay:

```java
public MovieResponse toResponse(Movie movie) {
    MovieResponse r = new MovieResponse();
    r.setId(movie.getId());
    r.setTitle(movie.getTitle());
    r.setDuration(movie.getDuration());
    r.setPosterUrl(movie.getPosterUrl());
    r.setAgeRating(movie.getAgeRating());
    r.setGenreNames(movie.getGenres().stream().map(Genre::getName).toList());
    // ... 20 field nữa
    return r;
}
```

10 entity × 3 DTO/entity = **30 mapper viết tay** → tốn 500-1000 dòng code, dễ sai (quên copy field mới).

---

## 2. Giải pháp: Interface + annotation, MapStruct sinh code

```java
@Mapper(componentModel = "spring")
public interface MovieMapper {
    MovieResponse toResponse(Movie movie);
    List<MovieResponse> toResponseList(List<Movie> movies);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "genres", ignore = true)  // set tay sau (vì cần repo lookup)
    Movie toEntity(MovieCreateRequest request);
}
```

Build → MapStruct sinh class `MovieMapperImpl.java`:

```java
@Component
public class MovieMapperImpl implements MovieMapper {
    @Override
    public MovieResponse toResponse(Movie movie) {
        if (movie == null) return null;
        MovieResponse r = new MovieResponse();
        r.setId(movie.getId());
        r.setTitle(movie.getTitle());
        // ... copy mọi field cùng tên/type tự động
        return r;
    }
}
```

→ Inject vào service như Spring bean bình thường.

---

## 3. Tại sao compile-time tốt hơn reflection?

| Tiêu chí | MapStruct (compile-time) | ModelMapper / BeanUtils (reflection) |
|---|---|---|
| Speed | ~3-5× nhanh hơn (no reflection) | Chậm hơn (introspect runtime) |
| Type safety | Compile error nếu sai | Runtime error |
| Debug | Step vào generated code | Black box |
| Refactor IDE | Rename field → mapper báo lỗi | Rename → runtime fail |
| Build | + 200-500ms compile | 0ms |

CineX chọn MapStruct vì 4 lý do trên + dự án production-grade.

---

## 4. Cài đặt build.gradle

```gradle
implementation 'org.mapstruct:mapstruct:1.6.3'
annotationProcessor 'org.mapstruct:mapstruct-processor:1.6.3'

// QUAN TRỌNG: nếu dùng Lombok cùng MapStruct
annotationProcessor 'org.projectlombok:lombok-mapstruct-binding:0.2.0'
```

**Lý do `lombok-mapstruct-binding`:** Lombok sinh getter/setter ở `@AnnotationProcessor` stage. MapStruct cũng chạy ở stage này. Không có binding → MapStruct chạy TRƯỚC Lombok → không thấy getter/setter → sinh code rỗng.

---

## 5. Các annotation chính

### 5.1. `@Mapper(componentModel = "spring")`

Marker class. `componentModel = "spring"` → sinh `@Component` → inject như Spring bean.

```java
@Service
public class MovieService {
    private final MovieMapper movieMapper;  // ← Spring inject
}
```

### 5.2. `@Mapping(source, target)`

Map field khác tên:

```java
@Mapper(componentModel = "spring")
public interface UserMapper {
    @Mapping(source = "fullName", target = "name")
    @Mapping(source = "createdAt", target = "registeredAt")
    UserResponse toResponse(User user);
}
```

### 5.3. `@Mapping(target, ignore = true)`

Bỏ qua field (sẽ set tay):

```java
@Mapping(target = "id", ignore = true)
@Mapping(target = "version", ignore = true)
@Mapping(target = "createdAt", ignore = true)
@Mapping(target = "genres", ignore = true)  // genres set sau qua repo lookup
Movie toEntity(MovieCreateRequest request);
```

### 5.4. `@Mapping(expression)`

Tính field dùng Java expression:

```java
@Mapping(target = "fullName",
         expression = "java(user.getFirstName() + \" \" + user.getLastName())")
UserResponse toResponse(User user);
```

### 5.5. Nested mapping

```java
@Mapping(source = "movie.title", target = "movieTitle")
@Mapping(source = "movie.posterUrl", target = "moviePosterUrl")
@Mapping(source = "room.theater.name", target = "theaterName")
ShowtimeResponse toResponse(Showtime showtime);
```

Map field con của entity con — MapStruct tự gen null-safe chain.

### 5.6. Custom converter với `@Named`

Convert đặc biệt (vd Genre → String name):

```java
@Mapper(componentModel = "spring")
public interface MovieMapper {

    @Mapping(target = "genreNames", source = "genres", qualifiedByName = "genresToNames")
    MovieResponse toResponse(Movie movie);

    @Named("genresToNames")
    default List<String> genresToNames(Set<Genre> genres) {
        return genres == null ? List.of() : genres.stream().map(Genre::getName).toList();
    }
}
```

---

## 6. CineX mapper thực tế

### 6.1. `MovieMapper.java`

```java
@Mapper(componentModel = "spring")
public interface MovieMapper {

    // List/detail response — có genres list
    @Mapping(target = "genreIds", source = "genres", qualifiedByName = "genresToIds")
    @Mapping(target = "genreNames", source = "genres", qualifiedByName = "genresToNames")
    @Mapping(target = "languageNames", source = "languages", qualifiedByName = "languagesToNames")
    MovieResponse toResponse(Movie movie);

    // Create request → entity (genres/languages set tay)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "version", ignore = true)
    @Mapping(target = "genres", ignore = true)
    @Mapping(target = "languages", ignore = true)
    @Mapping(target = "storageState", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    Movie toEntity(MovieCreateRequest request);

    // Update — chỉ update field non-null từ request
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "genres", ignore = true)
    @Mapping(target = "languages", ignore = true)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateEntity(@MappingTarget Movie movie, MovieUpdateRequest request);

    @Named("genresToIds")
    default List<Long> genresToIds(Set<Genre> genres) {
        return genres == null ? List.of() : genres.stream().map(Genre::getId).toList();
    }

    @Named("genresToNames")
    default List<String> genresToNames(Set<Genre> genres) {
        return genres == null ? List.of() : genres.stream().map(Genre::getName).toList();
    }

    @Named("languagesToNames")
    default List<String> languagesToNames(Set<Language> languages) {
        return languages == null ? List.of() : languages.stream().map(Language::getName).toList();
    }
}
```

### 6.2. `updateEntity` với `@MappingTarget` + `NullValuePropertyMappingStrategy.IGNORE`

Pattern partial update — chỉ overwrite field có giá trị trong request, giữ nguyên field NULL.

```java
@BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
void updateEntity(@MappingTarget Movie movie, MovieUpdateRequest request);
```

Service gọi:
```java
movieMapper.updateEntity(existingMovie, request);  // mutate in-place
movieRepository.save(existingMovie);
```

→ Client gửi `{ "title": "New Title" }` → chỉ title đổi, duration/poster/etc giữ nguyên.

---

## 7. Generated code ở đâu?

`backend/build/generated/sources/annotationProcessor/java/main/com/cinex/.../MovieMapperImpl.java`

Mở file này để xem MapStruct sinh gì → debug khi mapper sai.

---

## 8. Anti-pattern tránh

### 8.1. ❌ Map Entity ↔ Entity

```java
public Movie copyMovie(Movie source) { return movieMapper.toEntity(source); }  // SAI
```

MapStruct dành cho Entity ↔ DTO. Copy Entity → SQL JPA persist 2 lần, conflict ID.

### 8.2. ❌ Inject Repo trong Mapper

```java
@Mapper
public abstract class MovieMapper {
    @Autowired MovieRepository repo;  // SAI
    public Movie idToMovie(Long id) { return repo.findById(id).orElse(null); }
}
```

Mapper nên là pure function. Lookup ID → entity là việc của Service.

### 8.3. ❌ Quên `@Mapping(target = "id", ignore = true)` khi map Request → Entity

Request có id (vd request body cũ leak), entity bị set id → conflict ID khi save → DB throw.

---

## 9. Tham khảo code CineX

| File | Vai trò |
|---|---|
| `module/movie/mapper/MovieMapper.java` | Map Movie + nested Genre/Language |
| `module/user/mapper/UserMapper.java` | Map User profile |
| `module/booking/mapper/BookingMapper.java` | Map Booking + BookingSeat list |
| `module/showtime/mapper/ShowtimeMapper.java` | Map Showtime + nested movie/room/theater |
| `backend/build.gradle` | `annotationProcessor` config |

---

## 10. Câu hỏi tự kiểm tra

1. **Tại sao MapStruct cần `lombok-mapstruct-binding`?**
   → Lombok và MapStruct cùng chạy ở annotationProcessor stage. Không có binding → MapStruct chạy trước → không thấy getter/setter Lombok sinh.

2. **`componentModel = "spring"` làm gì?**
   → Sinh `@Component` cho generated class → inject vào service như Spring bean.

3. **Khác gì giữa `@Mapping(source, target)` và `@Mapping(target, ignore = true)`?**
   → `source/target` map field; `ignore = true` bỏ qua field (sẽ set tay sau).

4. **Generated code nằm ở đâu?**
   → `build/generated/sources/annotationProcessor/java/main/...`

5. **Tại sao update DTO → entity cần `NullValuePropertyMappingStrategy.IGNORE`?**
   → Để partial update — field NULL trong request không overwrite field cũ trong entity.
