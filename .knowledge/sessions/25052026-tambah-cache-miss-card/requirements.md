# Requirements: Tambah Cache Miss Card di Halaman Overview

## Context

Pengguna ingin menambahkan card baru **`Cache Miss`** pada halaman Overview untuk menampilkan jumlah token input yang **tidak** terkena cache (dikenakan harga penuh `input_price`). Card `Input Tokens` yang sudah ada tidak berubah nilainya karena secara matematis `tokens_input = cache_miss + cache_read`.

Ini adalah sesi lanjutan dari `25052026-penyesuaian-halaman-overview` yang telah:
- Menghapus `cache_write` sepenuhnya dari pipeline
- Mengganti `session.cache_tokens` menjadi `tokens_cache_read` saja
- Menambah card `Output Tokens`
- Merename `Cache` → `Cache Read`

**Relasi matematis:**
- `cache_miss = tokens_input - tokens_cache_read` (computed, bukan field DB)
- `tokens_input = cache_miss + tokens_cache_read`

## Functional Requirements

### FR-01: Card "Cache Miss" — baru
- **Nama:** `Cache Miss`
- **Isi:** total `tokens_input - tokens_cache_read` di seluruh session (computed di frontend).
- **SubLabel / trend:** perbandingan 7 hari: `(cacheMiss7d - cacheMissPrev7d) / cacheMissPrev7d * 100` dengan format `+X% vs last 7 days` atau `-X% vs last 7 days`.
- **Trend indicator:** `up` jika positif, `down` jika negatif, `neutral` jika 0 atau tidak ada data pembanding.
- **Penempatan:** setelah card `Cache Read` dan sebelum card `Models`.
- **Sumber data:** computed dari field yang sudah ada (`tokens_input` dan `tokens_cache_read` dari session / token-usage aggregasi). **Tidak memerlukan perubahan sync script.**

### FR-02: Card "Input Tokens" — tidak berubah
- **Nilai tetap sama:** `sum(tokens_input)` — karena `tokens_input = cache_miss + cache_read`, card ini secara inheren sudah merepresentasikan cache_miss + cache_read.
- **SubLabel / trend:** tetap perbandingan 7 hari untuk total input tokens.
- **Verifikasi:** tidak ada perubahan kode pada perhitungan Input Tokens.

### FR-03: Card "Total Tokens" — tidak berubah
- **Formula tetap:** `sum(input + output + cache_read)`.
- **Tidak ada perubahan.**

### FR-04: Token Composition donut chart — evaluasi ulang (open)
- Saat ini `computeTokenComposition()` menghasilkan segmen: Input, Output, Cache Read.
- **Masalah matematis teridentifikasi:** `total = input + output + cache_read`, tetapi `cache_read ⊆ input`, sehingga total overcounts (cache_read dihitung dua kali). Ini adalah **bug pre-existing** yang menjadi relevan dengan penambahan Cache Miss card.
- **Opsi A:** Tambah segmen `Cache Miss` dan ubah `Input` menjadi `Cache Miss` saja (non-overlapping):
  - Cache Miss (input - cache_read) — `var(--chart-1)`
  - Cache Read — `var(--chart-4)`
  - Output — `var(--chart-2)`
  - Total = cache_miss + cache_read + output = input + output (matematis benar)
- **Opsi B:** Pertahankan donut existing + tambah Cache Miss sebagai segmen ke-4 (akan semakin overcount).
- **Opsi C:** Biarkan donut existing, tidak berubah (Cache Miss hanya di card saja).
- **Keputusan:** perlu konfirmasi user (lihat Open Questions Q-01).

### FR-05: Cost calculation — potensi bug (open)
- `calculateCost()` saat ini: `input * input_price + cache * cache_price + output * output_price`.
- Karena `cache_read ⊆ input`, cache_read tokens di-charge **dua kali** (di `input_price` DAN `cache_price`).
- **Formula yang benar secara akuntansi:**
  - Cache Miss (input - cache_read): dikenakan `input_price`
  - Cache Read: dikenakan `cache_price` (jauh lebih murah)
  - Output: dikenakan `output_price`
  - Total: `(input - cache) * input_price + cache * cache_price + output * output_price`
- Namun, ini di luar scope eksplisit dari user request dan mempengaruhi seluruh halaman (Estimated Cost, TokenUsage cost, SessionsList cost, dll).
- **Keputusan:** perlu konfirmasi user (lihat Open Questions Q-02).

## Non-Functional Requirements

- **NFR-01: Tidak merusak perubahan sesi sebelumnya** — semua perubahan dari `25052026-penyesuaian-halaman-overview` harus tetap utuh (cache_write tetap tidak digunakan, card Cache Read, Output Tokens, formula Total Tokens tetap).
- **NFR-02: Sync script tidak berubah** — `cache_miss` adalah computed field murni di frontend. Tidak ada field baru di JSON atau perubahan di `scripts/sync-opencode-data.js`.
- **NFR-03: Backward compatibility** — file JSON di `public/data/` tidak berubah format. Semua perubahan hanya di layer frontend processing.
- **NFR-04: Build tidak terpengaruh** — `tsc -b` dan `npm run build` tetap lulus tanpa error.
- **NFR-05: Tidak ada dependensi baru** — tidak menambah npm package.
- **NFR-06: Card layout responsif** — grid `auto-fit` yang ada otomatis menampung 9 card (sebelumnya 8).

## Constraints

- **C-01:** `cache_miss` = `tokens_input - tokens_cache_read` adalah computed field. Tidak boleh menambah kolom baru di SQLite query atau file JSON.
- **C-02:** Tidak mengubah definisi `session.cache_tokens` (= tokens_cache_read) yang sudah ditetapkan di sesi sebelumnya.
- **C-03:** File `public/data/` tetap di `.gitignore`.
- **C-04:** Tidak menambah server-side code — dashboard tetap client-side only.
- **C-05:** `verbatimModuleSyntax: true` dan aturan TypeScript project references dipatuhi.

## Scope — File yang Terdampak

| File | Perubahan | Alasan |
|---|---|---|
| `src/utils/overviewDataProcessor.ts` | Tambah perhitungan `cacheMiss` di `computeKeyMetrics()`. Potensi ubah `computeTokenComposition()` dan `calculateCost()` tergantung keputusan Q-01 & Q-02. | FR-01, FR-04, FR-05 |
| `src/utils/costCalculator.ts` | Potensi ubah formula `calculateCost()` (memisahkan cache_miss vs cache_read). | FR-05 (jika dikonfirmasi) |
| `src/types/index.ts` | Tidak ada perubahan tipe baru yang diperlukan. `MetricCardData` sudah mendukung. | — |
| `scripts/sync-opencode-data.js` | **Tidak ada perubahan.** | — |
| `src/pages/Overview.tsx` | **Tidak ada perubahan.** Card dirender dari array `metrics`. | — |

## Open Questions — RESOLVED

- **Q-01:** ✅ **Opsi A** — Donut chart direstruktur ke non-overlapping: Cache Miss (`var(--chart-1)`), Cache Read (`var(--chart-4)`), Output (`var(--chart-2)`). Segmen `Input` dihapus. Total = cache_miss + cache_read + output = input + output (matematis benar).
- **Q-02:** ✅ **Perbaiki** — Formula `calculateCost()` diubah menjadi: `(input - cache_read) × input_price + cache_read × cache_price + output × output_price`. Cache_read tidak lagi di-charge dua kali.
- **Q-03:** ✅ **Biarkan** — Label `Input Tokens` tidak diubah.

## Updated Functional Requirements (post-Q&A)

### FR-04 (updated): Token Composition donut chart — restruktur
- **Segmen baru:** Cache Miss (`var(--chart-1)`), Cache Read (`var(--chart-4)`), Output (`var(--chart-2)`)
- **Segmen dihapus:** Input
- **Total:** cache_miss + cache_read + output = input + output (non-overlapping)

### FR-05 (updated): Cost calculation — perbaiki formula
- **Formula baru:** `(input - cache_read) × input_price + cache_read × cache_price + output × output_price`
- **Dampak:** Estimated Cost card, TokenUsage page, SessionsList, SessionDetail — semua otomatis menggunakan formula baru
- **File:** `src/utils/costCalculator.ts`

---
Version: 2 | Author: orchestrator | Date: 2026-05-25
