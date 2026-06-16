# RFC-001: Migrate Movie Search from SQL LIKE to Elasticsearch

**Author**: VuTuongAn
**Date**: 2026-06-12
**Status**: Draft
**Reviewers**: Tech lead (self), Future-me 6 months from now
**Decision deadline**: 2026-06-30

> **TL;DR**: CineX hiện dùng `LIKE %keyword%` cho movie search — không scale, không relevance ranking, không typo tolerance. Đề xuất add Elasticsearch + CDC sync từ Postgres để cover full-text search, autocomplete, faceted filter. Effort 3 tuần, infra cost +$30/tháng.

---

## 1. Summary

CineX search phim hiện tại dùng SQL `LIKE %keyword%` (xem `MovieSpecification.java:88-90`). Query không dùng được index, không có relevance ranking (kết quả random theo SQL order), không tolerance typo, không support search Vietnamese diacritics ("phim hành động" vs "phim hanh dong").

Đề xuất add **Elasticsearch 8** cluster (1 node dev, 3 node prod), sync data từ Postgres qua **Debezium CDC** với outbox pattern. Search API mới `GET /api/movies/search` route sang ES. SQL filter (genre, status, theaterId) vẫn dùng Postgres — chỉ keyword search dùng ES.

Outcome:
- P99 latency search keyword: 800ms → < 100ms
- Hỗ trợ tiếng Việt có dấu + bỏ dấu
- Autocomplete (search-as-you-type)
- Mở đường cho recommendation sau này

---

## 2. Motivation

### 2.1 Current state

CineX dùng JPA Specification cho search:

```java
// backend/src/main/java/com/cinex/module/movie/specification/MovieSpecification.java:88-90
public static Specification<Movie> hasTitle(String keyword) {
    return (root, q, cb) ->
        cb.like(cb.lower(root.get("title")), "%" + keyword.toLowerCase() + "%");
}
```

Tương tự cho director (line 266), cast (line 272), description.

User-facing endpoint: `GET /api/movies?keyword=...&genreId=...`

### 2.2 Problem

**P1: Performance degradation theo data growth**
- Hiện tại ~50 phim → query < 100ms OK.
- Khi scale lên 5000+ phim (5 năm runtime, 1000 phim/năm): full table scan → P99 latency tăng tuyến tính. Ước lượng ~800ms-2s.
- `LIKE %x%` (leading wildcard) KHÔNG dùng được B-tree index. Mỗi search = full scan.

**P2: Relevance ranking SAI**
- Search "iron man" → kết quả theo `createdAt DESC` (default sort).
- "Iron Man 1" có thể xuất hiện SAU "Iron Man 2" mặc dù user gõ "iron man" thường muốn part 1.
- Không có BM25 / TF-IDF ranking.

**P3: Vietnamese search broken**
- Search "phim hanh dong" KHÔNG match "phim hành động".
- Search "transformer" KHÔNG match "transformers" (no stemming).
- User VN gõ tiếng Việt KHÔNG dấu rất phổ biến trên mobile.

**P4: No autocomplete**
- Search bar phải gõ đủ rồi click button. UX kém.
- Industry standard: Netflix-style search-as-you-type.

**P5: Không faceted search**
- Query "iron man" không trả về breakdown ("Có 5 kết quả Action, 3 Sci-Fi").

### 2.3 Why now

- CineX hiện ~50 phim. Performance chưa thấy đau.
- NHƯNG dataset growth nhanh: nếu mở rộng catalog (thêm phim cũ + ngoại quốc) lên 5000+ → search sẽ thành blocker.
- **Implement TRƯỚC khi đau** (proactive) tốt hơn react khi production xuống.
- Cũng là cơ hội học CDC pattern thực tế cho user (Senior practice).

---

## 3. Goals & Non-Goals

### 3.1 Goals (in scope)

- **G1**: P99 latency search keyword < 100ms cho dataset 10k phim.
- **G2**: Vietnamese diacritics-insensitive search ("hanh dong" → "hành động").
- **G3**: Search relevance ranking BM25 (Elasticsearch default).
- **G4**: Autocomplete search-as-you-type < 50ms.
- **G5**: Zero data loss khi sync Postgres → Elasticsearch.
- **G6**: Postgres vẫn là source of truth. ES = read replica cho search.

### 3.2 Non-goals (out of scope)

- Replace Postgres for non-search queries. Postgres giữ nguyên cho CRUD, transactions.
- Search trong booking, payment, review. Chỉ scope movie search.
- Recommendation engine (next RFC).
- Multi-language search (English vs Vietnamese). Chỉ Vietnamese trước.
- Search analytics dashboard.

---

## 4. Background

### 4.1 Current architecture

```
[Browser] → [Spring Boot] → [Postgres]
                ↑
            MovieController.list()
                ↓
            MovieService.list()
                ↓
            MovieSpecification (build WHERE)
                ↓
            JpaRepository.findAll(spec, pageable)
```

### 4.2 Why Elasticsearch (not alternatives)

- Industry standard cho full-text search.
- Mature Vietnamese support (ICU analyzer).
- Aggregation cho faceted search.
- Mature operational tooling (Kibana, monitoring).
- Adoption cao → dễ hire/transfer skill.

→ Detailed alternatives ở Section 6.

### 4.3 Why CDC (not dual write)

Dual write pattern (app ghi Postgres + ES trong cùng transaction) gặp:
- Khó atomic — ES không support 2PC với Postgres.
- ES outage → app fail. Coupling chặt.
- Code duplication mỗi save method.

CDC + Outbox pattern (xem [docs/advanced/backend/02-cdc-debezium.md](../../advanced/backend/02-cdc-debezium.md)):
- App chỉ ghi Postgres (current behavior).
- Debezium tail WAL → push event ra Kafka.
- Indexer consume Kafka → update ES.
- ES outage → indexer queue, eventually catch up.

---

## 5. Proposal

### 5.1 High-level architecture

```
[Browser]
   │
   ├─ search ─▶ [Spring Boot] ──▶ [Elasticsearch] (read only)
   │              │
   │ filter/CRUD ─┴──▶ [Postgres] (source of truth)
   │                     │
   │                     │ WAL
   │                     ▼
   │              [Debezium connector]
   │                     │
   │                     ▼
   │              [Kafka topic: movies.cdc]
   │                     │
   │                     ▼
   │              [Indexer service]
   │                     │
   │                     ▼
   │              [Elasticsearch] (write)
```

### 5.2 Detailed design

#### 5.2.1 Elasticsearch index

```json
PUT /movies_v1
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1,
    "analysis": {
      "filter": {
        "vi_stop": { "type": "stop", "stopwords": ["và", "là", "của", "các"] },
        "vi_ascii_folding": { "type": "asciifolding", "preserve_original": true }
      },
      "analyzer": {
        "vi_analyzer": {
          "tokenizer": "icu_tokenizer",
          "filter": ["lowercase", "vi_ascii_folding", "vi_stop"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "id":          { "type": "long" },
      "title":       { "type": "text", "analyzer": "vi_analyzer",
                       "fields": {
                         "raw":    { "type": "keyword" },
                         "autocomplete": { "type": "search_as_you_type" }
                       } },
      "description": { "type": "text", "analyzer": "vi_analyzer" },
      "director":    { "type": "text", "analyzer": "vi_analyzer",
                       "fields": { "raw": { "type": "keyword" } } },
      "cast":        { "type": "text", "analyzer": "vi_analyzer" },
      "genres":      { "type": "keyword" },
      "status":      { "type": "keyword" },
      "ageRating":   { "type": "keyword" },
      "rating":      { "type": "float" },
      "releaseDate": { "type": "date" },
      "theaterIds":  { "type": "long" },
      "_updatedAt":  { "type": "date" }
    }
  }
}
```

Index name `movies_v1` (versioned) + alias `movies` → enable zero-downtime reindex.

#### 5.2.2 Outbox table

```sql
CREATE TABLE outbox (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL,    -- 'Movie', 'Theater', ...
    aggregate_id   BIGINT NOT NULL,
    event_type     VARCHAR(64) NOT NULL,    -- 'MovieUpsert', 'MovieDelete'
    payload        JSONB,                    -- denormalized movie doc
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outbox_created_at ON outbox(created_at);
```

App code thay đổi:

```java
// MovieService.java — sau khi save Movie
@Transactional
public Movie save(Movie movie) {
    movieRepo.save(movie);
    outboxRepo.save(OutboxEvent.builder()
        .aggregateType("Movie")
        .aggregateId(movie.getId())
        .eventType(movie.isDeleted() ? "MovieDelete" : "MovieUpsert")
        .payload(toEsDocument(movie))   // denormalize: include genres, theaterIds
        .build());
    return movie;
}
```

→ Atomic. Hoặc cả 2 INSERT đều OK, hoặc cả 2 fail.

#### 5.2.3 Debezium configuration

```json
{
  "name": "cinex-outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres",
    "database.dbname": "cinex",
    "table.include.list": "public.outbox",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.route.by.field": "aggregate_type",
    "transforms.outbox.route.topic.replacement": "${routedByValue}.cdc"
  }
}
```

→ Outbox row với `aggregate_type='Movie'` → push vào Kafka topic `Movie.cdc`.

#### 5.2.4 Indexer service

Spring Boot consumer:

```java
@KafkaListener(topics = "Movie.cdc", groupId = "movie-indexer")
@Transactional
public void onMovieEvent(MovieEvent event) {
    // Idempotency guard
    try {
        processedEventRepo.save(new ProcessedEvent(event.getId()));
    } catch (DataIntegrityViolationException e) {
        return;  // already processed
    }

    if ("MovieDelete".equals(event.getType())) {
        esClient.delete(d -> d.index("movies").id(event.getAggregateId().toString()));
    } else {
        esClient.index(i -> i.index("movies")
            .id(event.getAggregateId().toString())
            .document(event.getPayload()));
    }
}
```

#### 5.2.5 Search API

```java
@GetMapping("/api/movies/search")
public PageResponse<MovieSearchResult> search(
        @RequestParam String q,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {

    SearchResponse<MovieDocument> response = esClient.search(s -> s
        .index("movies")
        .from(page * size)
        .size(size)
        .query(query -> query
            .multiMatch(m -> m
                .query(q)
                .fields("title^3", "director^2", "cast", "description")
                .type(TextQueryType.BestFields)
                .fuzziness("AUTO")  // typo tolerance
            )
        ), MovieDocument.class);

    return PageResponse.from(response);
}
```

`title^3` = title field weighted 3x in scoring.

#### 5.2.6 Autocomplete endpoint

```java
@GetMapping("/api/movies/autocomplete")
public List<MovieAutocompleteResult> autocomplete(@RequestParam String q) {
    return esClient.search(s -> s
        .index("movies")
        .size(10)
        .query(query -> query
            .multiMatch(m -> m
                .query(q)
                .fields("title.autocomplete", "title.autocomplete._2gram", "title.autocomplete._3gram")
                .type(TextQueryType.BoolPrefix)
            )
        ), MovieDocument.class).hits().hits().stream()
            .map(hit -> new MovieAutocompleteResult(hit.source().getId(), hit.source().getTitle()))
            .toList();
}
```

### 5.3 Migration strategy

Phase-based, expand-contract style. Xem section 8 Rollout Plan.

---

## 6. Alternatives Considered

### Alternative A: Postgres full-text search (`tsvector`)

Postgres native: `CREATE INDEX idx_movies_fts ON movies USING gin(to_tsvector('english', title || ' ' || description));`

**Pros**:
- Không cần infra mới.
- Cùng DB → ACID tự nhiên.
- Cheaper.

**Cons**:
- Postgres FTS yếu hơn ES (ranking, fuzzy, suggestion).
- Vietnamese support: phải custom dictionary + setup phức tạp.
- Autocomplete: phải dùng trigram extension (`pg_trgm`) — performance hạn chế.
- Khi data > 1M record + heavy search QPS, Postgres FTS performance drop nhanh.

**Verdict**: Tốt cho < 100k records + tiếng Anh thuần. Không phù hợp khi Vietnamese + 5k+ movies scale.

### Alternative B: Algolia (managed search)

SaaS managed search.

**Pros**:
- Zero ops.
- Excellent UX (autocomplete, typo, ranking).
- Vietnamese support built-in.

**Cons**:
- Pricing: $50+/month cho small dataset, scale lên rất nhanh ($500+ ở 100k records).
- Vendor lock.
- Data residency: data ở US/EU server (compliance concern cho user VN).
- Không control fine-tune ranking algorithm.

**Verdict**: Tốt cho startup không có ops team. CineX có goal học CDC + ES pattern → reject.

### Alternative C: Meilisearch (self-host alternative)

**Pros**:
- Open source, simpler than ES.
- Type-safe ranking.
- Fast.

**Cons**:
- Newer, smaller ecosystem.
- Operational tooling less mature.
- Vietnamese support OK nhưng kém ES.

**Verdict**: Worth considering. Reject vì ES skill transfer giá trị hơn trong career (industry standard).

### Alternative D: Do nothing

**Pros**:
- Zero effort.
- Zero cost.

**Cons**:
- Pain accumulate. Will become blocker when scale.
- User experience degrade over time.
- No autocomplete = lose to competition.

**Verdict**: Reject. Plan now, easier than crisis later.

---

## 7. Trade-offs

Chấp nhận:

| Trade-off | Mức độ | Mitigation |
|---|---|---|
| **+1 infrastructure** (ES cluster) | Medium | Docker compose local dev. Managed ES Cloud cho prod. |
| **+1 messaging system** (Kafka) | Medium | Single broker dev. Hoặc Redpanda (Kafka-compatible, lighter). |
| **Eventual consistency** giữa Postgres và ES | Low | Lag thường < 1s. Search KHÔNG cần real-time. CRUD vẫn Postgres = strong. |
| **Ops complexity** (cluster health, lag monitor) | Medium | Đầu tư observability từ đầu (Prometheus + Grafana). |
| **+$30-50/tháng** cost | Low | Justify với business value (better UX → retention). |
| **CDC connector outage** → search stale | Low | Health check + alert. Search dùng cached doc vẫn OK. |
| **Reindex required** khi schema change | Low | Versioned index + alias swap. Documented runbook. |

KHÔNG chấp nhận:

- Data loss: outbox pattern + idempotent consumer = at-least-once + dedupe = effectively exactly-once.
- Postgres as primary fail: ES failure → search degrade, không ảnh hưởng CRUD/booking critical path.

---

## 8. Rollout Plan

### Phase 0 — Preparation (1 tuần)

- Setup Docker compose: Postgres + Kafka + Debezium + ES + Kibana.
- Create `outbox` table + Debezium connector.
- Define ES mapping + test indexing manually.
- Documentation runbook.

**Exit criteria**: local dev environment hoàn toàn function.

### Phase 1 — Dual write + backfill (3 ngày)

- Deploy outbox writes (app side).
- Run backfill script: scan toàn bộ `movies` table → push vào outbox → CDC sync → ES indexed.
- Verify count: ES doc count = Postgres movie count.
- ES query NOT served to user yet (silent indexing).

**Exit criteria**: 100% movies in ES, lag < 10s.

### Phase 2 — Shadow read (1 tuần)

- Add new `/api/movies/search` endpoint serving from ES.
- Old `/api/movies?keyword=` still uses Postgres.
- Mobile/web app KHÔNG sử dụng new endpoint yet.
- Internal team test new endpoint manually + automated tests.

**Exit criteria**: 100% test pass. Latency P99 < 100ms confirmed.

### Phase 3 — Canary release (1 tuần)

- Feature flag `search.use_elasticsearch` default false.
- Frontend code:
```typescript
const useEs = await featureFlag.get('search.use_elasticsearch');
const url = useEs ? '/api/movies/search' : '/api/movies';
```
- Roll out 1% → 10% → 50% → 100% theo monitoring data.
- Compare metrics: latency, click-through rate, zero-result rate.

**Exit criteria**: 100% traffic on ES, no regression in business metrics.

### Phase 4 — Deprecate old (1 tuần)

- Remove SQL keyword search code (`MovieSpecification.hasTitle`).
- Mark old endpoint deprecated.
- Update API docs.

**Exit criteria**: Old code removed, no callers.

### Total timeline

**~3 tuần** end-to-end (assuming part-time work, real Senior practice).

### Rollback plan

Tại bất kỳ phase nào:
- Phase 1-2: just stop indexer. Postgres still source of truth.
- Phase 3: flip feature flag back to false. Instant rollback.
- Phase 4: hardest (code removed). Need git revert + redeploy.

→ Risk decreases as we progress. Phase 4 only after high confidence.

---

## 9. Observability

### Metrics (Prometheus)

```
es_search_latency_seconds_bucket{endpoint="movies"}        — histogram
es_search_requests_total{endpoint, status}                  — counter
es_indexer_lag_seconds{topic="Movie.cdc"}                   — gauge
outbox_pending_count                                         — gauge
es_index_doc_count{index="movies"}                          — gauge (vs Postgres count)
postgres_movie_count                                          — gauge
```

### Alerts

- `es_indexer_lag_seconds > 60` → P2 page on-call.
- `outbox_pending_count > 1000` → P2.
- `es_search_latency_seconds_bucket{quantile="0.99"} > 0.5` → P3.
- `es_index_doc_count - postgres_movie_count > 10` → P2 (sync gap).

### Logs

- Indexer: log every event with `trace_id`, `aggregate_id`, action.
- ES queries: log slow queries > 200ms với query body.
- CDC: Debezium emit metrics built-in via JMX.

### Dashboard

`https://grafana.cinex.local/d/elasticsearch-movies` (create after impl).

Panels:
- Search QPS, latency P50/P95/P99.
- Indexer throughput + lag.
- Outbox queue depth.
- ES cluster health (yellow/green/red).

---

## 10. Security & Compliance

- ES cluster: TLS in-transit, basic auth, network isolation (private subnet).
- Outbox payload: KHÔNG chứa PII (movie data public).
- Kafka: ACL enforce — chỉ indexer consume `Movie.cdc`.
- Compliance: data public → no GDPR/CCPA implication.

→ No new attack surface beyond existing app.

---

## 11. Performance

### Capacity estimates

- Movies count: 50 hiện tại → 5k 5 năm sau.
- Doc size: ~2KB / movie → 10MB total. Tiny.
- Search QPS: ~10 QPS hiện tại → 100 QPS peak future.
- ES cluster 3 node x 8GB RAM dư thừa cho dataset này.

### Load test plan

- Use k6/Locust before Phase 3.
- Target: sustain 500 QPS, P99 < 100ms.
- Test ES failure: kill 1 node, verify replica takes over.

### SLO

- Search P99 latency < 100ms — 99.9% time.
- Indexer lag < 10s — 99% time.
- ES uptime > 99.95%.

---

## 12. Cost

### Infrastructure

| Item | Monthly |
|---|---|
| ES cluster (3 × t3.medium AWS / equivalent) | $90 |
| Kafka single broker (t3.small) | $25 |
| Debezium connect node (t3.small) | $25 |
| Storage EBS gp3 | $10 |
| **Total infra** | **~$150/month** |

OR self-host trên 1 VM duy nhất:

| Item | Monthly |
|---|---|
| 1 VPS 8GB RAM | $30 |
| (ES + Kafka + Debezium + Indexer all co-located, dev/staging ok prod scale yes) | |
| **Total** | **~$30/month** |

→ Bắt đầu với option 2 (self-host VM). Migrate sang option 1 nếu cần HA.

### Engineering effort

- ~3 weeks part-time = ~60 hours.
- Dollar value tự đánh giá theo rate cá nhân.

### Ongoing maintenance

- ~2 hours/tháng for monitoring + ad-hoc reindex.

### ROI

Khó quantify trực tiếp. Indirect:
- Better search UX → tăng booking conversion 1-3% (industry research).
- 50 booking/ngày × 100k/booking × 2% improvement × 365 ngày = ~36M VND/năm.
- Infra cost $30/tháng × 12 = $360/năm = ~9M VND/năm.
- → **Net positive ~27M VND/năm + valuable skill learned**.

---

## 13. Testing Strategy

### Unit tests

- `MovieDocumentMapper` (Movie → ES doc).
- `OutboxEventBuilder`.
- Indexer event processor.

### Integration tests

- Testcontainers: Postgres + Kafka + ES.
- E2E flow: save Movie → outbox row → Debezium → Kafka → indexer → ES doc exists.
- Time-bound: < 10s end-to-end.

### Contract tests

- ES API client matches our usage.

### Performance tests

- k6 script: 500 QPS sustained search, verify SLO.

### Chaos tests

- Phase 4 prep: kill ES master node → verify failover < 30s.
- Kill indexer → verify backlog catches up khi restart.
- Network partition Kafka ↔ indexer → verify reconnect.

### Manual testing

- Vietnamese search: "phim hành động" vs "phim hanh dong" → same result.
- Typo: "iron mna" → "iron man" suggested.
- Autocomplete: gõ "ir" → "Iron Man", "Iron Sky", ... < 50ms.

---

## 14. Open Questions

| ID | Question | Status | Decision |
|---|---|---|---|
| Q1 | Self-host ES vs managed (Elastic Cloud)? | Open | TBD before Phase 0 |
| Q2 | Index per language hay analyzer multi-field? | Open | Prefer analyzer (simpler) |
| Q3 | Backfill script: run via Kafka or direct ES bulk API? | Open | Direct bulk API (faster initial backfill) |
| Q4 | Reindex strategy khi schema change: blue-green index swap? | Open | Yes — versioned `movies_v1` + alias |
| Q5 | Cần SSO cho Kibana? | Open | Phase 4 nếu shared with team |

---

## 15. Future Work

Beyond this RFC:

- **Recommendation engine** dựa trên search history + view pattern.
- **Search analytics**: top queries, zero-result queries, click-through rate.
- **Search trong booking history, reviews** (cùng pattern).
- **Multi-language search** (English + Vietnamese cùng index hoặc separate).
- **Personalized ranking** (boost user's preferred genres).
- **Vector search** (semantic similarity, embeddings) — chuẩn bị cho AI integration.

---

## 16. References

- [docs/advanced/backend/02-cdc-debezium.md](../../advanced/backend/02-cdc-debezium.md) — CDC pattern background.
- [docs/advanced/backend/17-elasticsearch-lucene.md](../../advanced/backend/17-elasticsearch-lucene.md) — ES internals.
- [docs/advanced/backend/22-zero-downtime-migration.md](../../advanced/backend/22-zero-downtime-migration.md) — Expand-contract pattern.
- Debezium Outbox: https://debezium.io/documentation/reference/transformations/outbox-event-router.html
- ES Vietnamese analyzer: https://github.com/duydo/elasticsearch-analysis-vietnamese
- CineX current movie search: `backend/src/main/java/com/cinex/module/movie/specification/MovieSpecification.java:88`

---

## Appendix A: Sample search ranking

Query: "iron man"

Postgres LIKE result (sorted by createdAt DESC):
1. Iron Man 3 (2013) — latest record
2. Iron Man 2 (2010)
3. Iron Man (2008)

Elasticsearch BM25 result (sorted by relevance):
1. Iron Man (2008) — exact title match, highest TF-IDF
2. Iron Man 2 (2010) — exact title + suffix
3. Iron Man 3 (2013) — exact title + suffix

→ ES result match user intent better.

---

## Appendix B: Debezium connector full config

(Production-grade config với failure handling, schema registry, monitoring...)

[Detailed config omitted for brevity. Will be in implementation PR.]

---

## Author's reflection (cho self-learning)

**Tại sao tôi viết RFC này thay vì cứ code thẳng?**

1. **Forces clarity**: viết ra phải nghĩ rõ alternatives + trade-off. Khi code thẳng, dễ skip step "tại sao".
2. **Future-me trust**: 6 tháng sau tôi quên hết. RFC này remind tại sao chọn cách này.
3. **Senior signaling**: viết RFC chất lượng = chứng minh kỹ năng analytical, communication, system thinking.
4. **Team alignment**: nếu CineX có team thật, RFC này = mechanism alignment trước khi code.

**Gì tôi cần làm tiếp với RFC này?**

1. Self-critique như Senior reviewer:
   - "Cost analysis quá optimistic không?"
   - "Tôi đã consider rollback đủ chưa?"
   - "Observability có cover edge case?"
2. Để 1 tuần, đọc lại fresh perspective.
3. Implement Phase 0-1 thật (Docker compose, outbox table, backfill).
4. Document journey + bài học → blog post.

**Mục tiêu growth**: viết 3 RFC như vầy trong 6 tháng tới cho CineX, mỗi cái deeper dimension.

