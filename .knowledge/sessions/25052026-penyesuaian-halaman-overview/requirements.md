# Requirements: Penyesuaian Kartu Halaman Overview

## Context

Pengguna ingin mengubah perhitungan dan tampilan beberapa kartu metrik di halaman Overview dashboard opencode. Saat ini, `cache_tokens` menggabungkan `tokens_cache_read` + `tokens_cache_write` menjadi satu field di seluruh data pipeline (sync script → JSON → frontend). Pengguna ingin memisahkan dan hanya menampilkan `tokens_cache_read`, serta menambahkan kartu baru `Output Tokens`.

## Functional Requirements

### FR-01: Card "Total Tokens" — formula baru
- **Saat ini:** menampilkan `sum(input + output + cache)` di mana `cache` = cache_read + cache_write.
- **Target:** menampilkan `sum(input + output + cache_read)` saja. Cache write tidak diikutsertakan.
- **Sumber data:** aggregasi `byDay` dari `TokenUsageData` dengan field `cache` yang sudah diubah menjadi `cache_read` only.
- **SubLabel / trend:** perbandingan 7 hari tetap ada, menggunakan formula yang sama dengan card Total Tokens yang baru.

### FR-02: Card "Input Tokens" — tidak berubah
- **Tetap menampilkan:** `sum(input)` dari token usage.
- **Tidak ada perubahan kode yang dibutuhkan** pada perhitungan card ini.

### FR-03: Card "Cache" — ganti nama + isi
- **Nama baru:** `Cache Read`
- **Isi baru:** `sum(cache_read)` saja (sebelumnya cache_read + cache_write).
- **Sumber data:** field `cache` pada aggregasi (yang setelah perubahan hanya berisi cache_read).
- **SubLabel / trend:** perbandingan 7 hari menggunakan `cache_read` saja.

### FR-04: Card "Output Tokens" — baru
- **Nama:** `Output Tokens`
- **Isi:** `sum(output)` — total seluruh token output yang di-generate model (`tokens_output`).
- **Tidak termasuk reasoning tokens.**
- **SubLabel / trend:** perbandingan 7 hari untuk output tokens.
- **Penempatan:** di antara card `Input Tokens` dan `Cache Read` (atau sesudah `Cache Read` — fleksibel).

### FR-05: Data pipeline — sync script
- **Session objects:** field `cache_tokens` diubah dari `(tokens_cache_read + tokens_cache_write)` menjadi `tokens_cache_read` saja.
- **Message objects:** field `cache_tokens` diubah dari `(cache.read + cache.write)` menjadi `cache.read` saja.
- **Semua aggregasi** (`byDay`, `byWeek`, `byMonth`, `byModel`, `byProvider`, `byProject`): field `cache` diubah dari sum(cache_read + cache_write) menjadi sum(cache_read) saja.
- **Overview stats:** `totalCacheTokens` diubah menjadi sum(tokens_cache_read) saja.

### FR-06: Token Composition chart (donut)
- **Segmen saat ini:** Input, Output, Cache (combined read+write).
- **Segmen target:** Input, Output, Cache Read (hanya cache_read).
- **Warna tetap:** `var(--chart-1)` untuk Input, `var(--chart-2)` untuk Output, `var(--chart-4)` untuk Cache.

### FR-07: Konsistensi di seluruh dashboard
- **Daily Activity Chart:** `cache` series tetap ada tetapi hanya menampilkan cache_read.
- **Top Models Chart:** `cache` bar tetap ada tetapi hanya menampilkan cache_read.
- **Project Activity Chart:** `cache` bar tetap ada tetapi hanya menampilkan cache_read.
- **Token Chart (generic):** bar chart, line chart, area chart — `cache` series hanya menampilkan cache_read.
- **TokenUsage page:** summary (Total, Average, Peak) menggunakan `cache_read` saja.
- **SessionsList / SessionDetail:** `cache_tokens` pada session hanya menampilkan cache_read.

### FR-08: Data regenerasi
- Setelah perubahan sync script, pengguna harus menjalankan `npm run sync` ulang untuk meregenerasi file JSON di `public/data/`.
- File JSON yang diregenerasi akan memiliki nilai `cache_tokens` / `cache` yang baru (cache_read only).

## Non-Functional Requirements

- **NFR-01: Backward compatibility data JSON** — perubahan hanya pada sync script dan frontend. Tidak ada perubahan format file JSON eksternal (tetap nama file dan struktur yang sama, hanya nilai field `cache` yang berubah).
- **NFR-02: Tidak ada perubahan pada reasoning_tokens** — field `reasoning_tokens` dan `tokens_reasoning` tetap tidak tersentuh di seluruh data pipeline.
- **NFR-03: Build tidak terpengaruh** — `tsc -b` dan `npm run build` harus tetap berjalan tanpa error setelah perubahan.
- **NFR-04: Tidak ada dependensi baru** — tidak menambah package npm baru.
- **NFR-05: Card layout responsif tetap** — penambahan satu card `Output Tokens` tetap masuk dalam grid `auto-fit` yang sudah ada.

## Constraints

- **C-01:** `public/data/` tetap di `.gitignore`, tidak boleh commit file JSON hasil sync.
- **C-02:** Tidak menambah server-side code — dashboard tetap client-side only.
- **C-03:** Sync script tetap membaca dari SQLite `opencode.db` — field `tokens_cache_read` dan `tokens_cache_write` tetap dibaca dari DB, hanya penggabungannya yang diubah.
- **C-04:** Tidak mengubah struktur tabel SQLite — hanya cara membaca dan menggabungkan field.
- **C-05:** `verbatimModuleSyntax: true` dan aturan TypeScript lainnya tetap dipatuhi.
- **C-06:** Warna chart tidak berubah — `var(--chart-1)` s.d. `var(--chart-4)` mapping tetap sama.

## Open Questions — RESOLVED

- **Q-01:** ✅ YES — `total_tokens` di session (dan seluruh halaman: SessionsList, SessionDetail) harus meng-exclude cache_write. Cache write tidak digunakan di mana pun di website.
- **Q-02:** ✅ DROP sepenuhnya — cache_write tidak disimpan sebagai field terpisah, dihapus total dari seluruh pipeline.
- **Q-03:** ✅ YES disengaja — cache_write tidak diikutsertakan dalam perhitungan biaya (Estimated Cost). Hanya cache_read yang dihitung dengan `cache_price`.

---
Version: 2 | Author: orchestrator | Date: 2026-05-25
