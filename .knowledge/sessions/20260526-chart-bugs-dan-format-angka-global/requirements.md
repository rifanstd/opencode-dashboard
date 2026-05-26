# Requirements: Chart Bugs, Session List Project Column, dan Global Number Formatting

## Context

User melaporkan tiga area masalah pada opencode-dashboard:
1. **Overview Page — Chart Bugs:** Tiga chart (`Token Usage`, `Cost`, `Model Usage`) tidak memiliki label/nilai pada sumbu x dan y; chart `Model Usage` menampilkan background putih saat di-hover.
2. **Session List Page — Project Column:** Kolom `Project` menampilkan angka acak (sebenarnya UUID/database hash), bukan nama project yang terbaca manusia. User juga ingin tahu sumber data kolom `Tokens` dan `Cost`.
3. **Global Number & Currency Formatting:** Semua angka di seluruh website harus menggunakan format K/M/B (max 2 desimal), semua nilai mata uang menggunakan prefix `$` + format K/M/B (max 2 desimal).

---

## Codebase Exploration Findings

### 📊 Chart Axis Bug (Token Usage, Cost, Model Usage)

**Files involved:**
- `src/components/TokenUsageChart.tsx` — lines 119-120: `<XAxis dataKey="date" hide />` + `<YAxis hide />`
- `src/components/CostChart.tsx` — lines 120-121: `<XAxis dataKey="date" hide />` + `<YAxis hide />`
- `src/components/ModelUsageChart.tsx` — lines 73-74: `<XAxis dataKey="label" hide />` + `<YAxis hide />`

**Finding:** Ketiga chart secara eksplisit menyembunyikan sumbu x dan y dengan prop `hide`. Namun, requirements sebelumnya (session `20260525-penyesuaian-chart-format-number-cards-overview`, FR-05b, FR-05c, FR-07b, FR-07c) secara jelas mensyaratkan axis label harus ditampilkan. Ini adalah **BUG implementasi** — kontradiksi antara implementasi dan spesifikasi desain.

### 📊 Model Usage Chart White Background Bug

**File involved:** `src/components/ModelUsageChart.tsx`

**Finding:** Recharts `BarChart` memiliki default `cursor` overlay rectangle dan default tooltip `contentStyle` dengan `background: white`. Karena ModelUsageChart tidak meng-override properti `contentStyle` dan `cursor` pada `<Tooltip>` atau `<BarChart>`, background putih muncul saat hover. Chart lain (TokenUsageChart, CostChart) juga tidak meng-override styling ini, tetapi kemungkinan tidak menampilkan masalah yang sama karena menggunakan `LineChart` (bukan `BarChart`) di mana cursor overlay berperilaku berbeda.

**Akar masalah:** `<Tooltip content={CustomTooltip} />` pada ModelUsageChart tidak memiliki `contentStyle={{ background: 'none', border: 'none' }}` dan `<BarChart>` tidak memiliki `cursor={{ fill: 'transparent' }}` untuk mencegah background putih default Recharts.

### 📋 Session List — Project Column Data Source

**Files involved:**
- `src/pages/SessionsList.tsx` — line 215: kolom `Project` merender `s.project_id ?? '—'`
- `scripts/sync-opencode-data.js` — line 181: `project_id: s.project_id ?? null` (diambil langsung dari kolom `project_id` tabel `session` di SQLite)

**Finding:** `project_id` pada tabel `session` di database opencode adalah **UUID/hash identifier** (contoh: `a1b2c3d4-...`), bukan nama project yang terbaca manusia. Nama project tersedia di tabel `project` (kolom `name` dan `worktree`) yang di-export ke `public/data/projects.json`.

**Fakta penting:**
- `src/utils/dataLoader.ts` sudah memiliki fungsi `loadProjects()` yang mem-fetch `/data/projects.json`
- `projects.json` berisi objek `{ id, name, path, created_at }` — sync script menggunakan `p.name ?? p.worktree ?? p.id` untuk kolom `name`
- SessionsList saat ini **tidak memanggil** `loadProjects()` — tidak ada join/lookup antara session → project name

### 💰 Tokens Column Calculation

**Data source:** `sessions.json` → field `total_tokens`

**Perhitungan di sync script** (`scripts/sync-opencode-data.js`, line 189):
```js
total_tokens: (s.tokens_input ?? 0) + (s.tokens_output ?? 0) + (s.tokens_reasoning ?? 0) + (s.tokens_cache_read ?? 0)
```

Total tokens = input + output + reasoning + cache read. Semua nilai berasal dari kolom tabel `session` di SQLite.

**Rendering di UI:** `SessionsList.tsx` line 217: `s.total_tokens.toLocaleString()` (format en-US standar dengan koma pemisah ribuan)

### 💵 Cost Column Calculation

**Data source:** Dihitung **client-side** di dalam `SessionsList.tsx` (lines 31-49), BUKAN dari JSON.

**Langkah perhitungan:**
1. `loadPricing(models)` — membangun `Map<string, Pricing>` dari `models.json`, di mana setiap model memiliki harga per-token (`input_price`, `output_price`, `reasoning_price`, `cache_price`)
2. Untuk setiap session dengan `model_id` yang ada di pricing map: `calculateCost(tokenCounts, pricing)` — mengalikan jumlah token dengan harga per-token masing-masing kategori
3. `calculateCost()` di `src/utils/costCalculator.ts` line 10-20:
   ```
   cost = input × inputPrice + output × outputPrice + reasoning × reasoningPrice + cache × cachePrice
   ```
4. Harga per-token sudah dikonversi dari per-1M-tokens di sync script (line 508-511: `rawPrice / 1_000_000`)

**Rendering di UI:** `SessionsList.tsx` line 218: `formatCost(s.cost)` → menampilkan `$X.XX` (2 desimal)

### 🔢 Current Number Formatting Status

**Sudah menggunakan `formatNumber()` (K/M/B) di:**
- Chart tooltips (TokenUsageChart, ModelUsageChart, TokenCompositionChart)
- TokenCompositionChart center text
- TopBar stats bar (tokens & cost)
- Key Metrics cards di halaman Overview (via `computeKeyMetrics()`)

**MASIH menggunakan `toLocaleString()` (format ribuan — BELUM K/M/B) di:**
| Lokasi | File | Baris | Nilai yang ditampilkan |
|--------|------|-------|------------------------|
| Overview summary strip | `Overview.tsx` | 224 | Sessions count |
| Overview summary strip | `Overview.tsx` | 230 | Total tokens |
| SessionsList Tokens column | `SessionsList.tsx` | 217 | `total_tokens` |
| SessionDetail token bars | `SessionDetail.tsx` | 340 | Per-kategori token |
| SessionDetail total tokens | `SessionDetail.tsx` | 380 | `total_tokens` |
| TopBar sessions count | `TopBar.tsx` | 49, 159, 178 | Sessions count |

**MASIH menggunakan format mentah (BELUM K/M/B) di:**
| Lokasi | File | Baris | Format saat ini |
|--------|------|-------|-----------------|
| Overview cost summary | `Overview.tsx` | 236 | `` `$${cost.toFixed(2)}` `` |
| Resources model pricing | `Resources.tsx` | 182-183 | `` `$${price.toFixed(2)}/Mt input` `` |
| Resources context window | `Resources.tsx` | 184 | `` `${(ctx / 1000).toFixed(0)}K ctx` `` |

**Fungsi `formatCost()` saat ini** (`src/utils/costCalculator.ts` line 22-25):
```ts
export function formatCost(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0.00'
  return `$${value.toFixed(2)}`  // ← selalu 2 desimal, tidak pakai K/M/B!
}
```

---

## Functional Requirements

### AREA A: Overview Page — Chart Bug Fixes

#### A-BUG-01: Show X and Y Axis Labels on All Charts (BUG FIX)

**Current state:** Token Usage, Cost, dan Model Usage charts menggunakan `XAxis hide` dan `YAxis hide` — menyembunyikan sumbu.

**Expected:** Sumbu x dan y harus terlihat dengan label yang sesuai:

- **Token Usage Chart** (`src/components/TokenUsageChart.tsx`):
  - X-axis: hapus `hide`, tampilkan label tanggal dengan format sesuai granularity (menggunakan `formatDateTick()`)
  - Y-axis: hapus `hide`, tampilkan nilai token dengan format K/M/B (menggunakan `formatNumber()`)

- **Cost Chart** (`src/components/CostChart.tsx`):
  - X-axis: hapus `hide`, tampilkan label tanggal dengan format sesuai granularity
  - Y-axis: hapus `hide`, tampilkan nilai cost dengan format `$` + K/M/B

- **Model Usage Chart** (`src/components/ModelUsageChart.tsx`):
  - X-axis: hapus `hide`, tampilkan nama model (dataKey: `label`)
  - Y-axis: hapus `hide`, tampilkan total tokens dengan format K/M/B

**Verification:** Buka halaman Overview, setiap chart harus menampilkan label sumbu x dan y yang terbaca.

#### A-BUG-02: Remove White Background on Model Usage Chart Hover (BUG FIX)

**Current state:** Saat hover pada bar di ModelUsageChart, muncul background putih yang mengganggu tampilan dark theme.

**Root cause:** Recharts `BarChart` default cursor overlay dan default tooltip `contentStyle` menggunakan background putih.

**Fix requirements:**
- Set `contentStyle={{ background: 'none', border: 'none', padding: 0 }}` pada `<Tooltip>` di ModelUsageChart
- Set `cursor={{ fill: 'transparent' }}` pada `<BarChart>` untuk mencegah overlay putih
- Tooltip custom content harus tetap menggunakan background dark (`#1c2128`) seperti yang sudah ada

**Applicability check:** Token Usage Chart dan Cost Chart juga perlu dicek apakah mengalami masalah yang sama. Jika iya, terapkan fix yang sama. Jika tidak (karena `LineChart` tidak memiliki cursor overlay yang sama), tidak perlu diubah.

**Verification:** Hover pada bar Model Usage — tidak boleh ada flash/background putih. Hanya tooltip custom yang muncul.

---

### AREA B: Session List Page — Project Column & Data Transparency

#### B-FR-01: Display Project Name Instead of Project ID

**Current state:** Kolom `Project` di halaman Sessions List (`src/pages/SessionsList.tsx`) menampilkan `s.project_id` — UUID/database hash yang tidak terbaca manusia.

**Expected:** Kolom `Project` harus menampilkan **nama project** (atau nama root folder, `worktree`) dari tabel `projects`.

**Implementation notes:**
- `SessionsList.tsx` harus memanggil `loadProjects()` (sudah tersedia di `src/utils/dataLoader.ts`) untuk mendapatkan data dari `/data/projects.json`
- Lakukan lookup: `projects.find(p => p.id === session.project_id)?.name`
- Jika project tidak ditemukan di tabel projects, fallback ke `project_id` asli atau tampilkan `—`
- Nama project tersedia di `projects.json` field `name` (sync script line 198: `p.name ?? p.worktree ?? p.id`)
- **✅ TERAPKAN JUGA** ke halaman `SessionDetail.tsx` yang juga menampilkan `session.project_id` di info bar (line 250) dan detail card (line 268) — DIKONFIRMASI user (S-01)

**Verification:** Buka halaman Sessions List — kolom Project harus menampilkan nama project yang terbaca (misal: `opencode-dashboard`, `my-project`), bukan hash.

#### B-FR-02: Document Tokens and Cost Calculation (INFORMATIONAL)

**Objective:** User ingin tahu dari mana data kolom Tokens dan Cost berasal. Ini bersifat informational — temuan didokumentasikan di sini; tidak ada code change untuk requirement ini.

**Tokens column:**
- **Sumber data:** `sessions.json` → field `total_tokens`
- **Cara hitung (sync script):** `total_tokens = input + output + reasoning + cache` — semua dari kolom tabel `session` di SQLite opencode
- **Rendering:** `s.total_tokens.toLocaleString()` → akan diubah menjadi `formatNumber(s.total_tokens)` per requirement C-FR-01

**Cost column:**
- **Sumber data:** Dihitung client-side dari `sessions.json` + `models.json`
- **Cara hitung:** `cost = input×inputPrice + output×outputPrice + reasoning×reasoningPrice + cache×cachePrice` — lihat `src/utils/costCalculator.ts` fungsi `calculateCost()`
- **Harga per-token:** Berasal dari `models.json` (di-sync dari opencode cache `models.json`), dikonversi dari harga per-1M-tokens ke per-token (÷ 1,000,000) di sync script line 508-511
- **Rendering:** `formatCost(s.cost)` → akan diubah menggunakan format `$` + K/M/B per requirement C-FR-03

---

### AREA C: Global Number & Currency Formatting

#### C-FR-01: All Numbers Use K/M/B Format (ENHANCEMENT)

**Requirement:** Semua tampilan angka di SELURUH website harus menggunakan format K/M/B dengan maksimal 2 desimal, menggantikan format `toLocaleString()` yang saat ini menampilkan koma pemisah ribuan.

**Format rules (sudah ada di `formatNumber()` di `src/utils/costCalculator.ts`):**
- < 1,000: tampilkan angka asli dengan pemisah ribuan (e.g., `999`, `42`)
- 1,000 – 999,999: format `X.XK` (e.g., `1.2K`, `10K`, `500K`)
- 1,000,000 – 999,999,999: format `X.XM` (e.g., `1.5M`, `250M`)
- ≥ 1,000,000,000: format `X.XB` (e.g., `2.5B`)
- Trailing `.0` di-strip (e.g., `2M` bukan `2.0M`)
- Non-finite values → `'0'`

**✅ CLARIFIED:** Opsi B — maksimal 2 desimal, strip trailing zeros. Ubah `.toFixed(1)` → `.toFixed(2)`, lalu strip trailing zeros dari hasil akhir. Contoh: `1.50K` → `1.5K`, `1.25K` tetap `1.25K`.

**File yang perlu diubah (mengganti `.toLocaleString()` → `formatNumber()`):**

| Lokasi | File | Line(s) | Perubahan |
|--------|------|---------|-----------|
| Overview summary strip — sessions | `Overview.tsx` | 224 | `overview.totalSessions.toLocaleString()` → `formatNumber(overview.totalSessions)` |
| Overview summary strip — tokens | `Overview.tsx` | 230 | `summaryTokens.toLocaleString()` → `formatNumber(summaryTokens)` |
| SessionsList Tokens column | `SessionsList.tsx` | 217 | `s.total_tokens.toLocaleString()` → `formatNumber(s.total_tokens)` |
| SessionDetail per-kategori | `SessionDetail.tsx` | 340 | `bar.value.toLocaleString()` → `formatNumber(bar.value)` |
| SessionDetail total tokens | `SessionDetail.tsx` | 380 | `session.total_tokens.toLocaleString()` → `formatNumber(session.total_tokens)` |
| TopBar sessions count | `TopBar.tsx` | 49, 159, 178 | `quickStats.totalSessions.toLocaleString()` → `formatNumber(quickStats.totalSessions)` |

**✅ CLARIFIED (R-01):** Resources page pricing tetap menggunakan format `$0.00000250/Mt` — tidak diubah. Angka terlalu kecil untuk K/M/B.

#### C-FR-02: formatNumber() Supports 2 Decimal Places with Trailing Zero Strip

**Current state:** `formatNumber()` di `src/utils/costCalculator.ts` menggunakan `.toFixed(1)` — hanya 1 desimal.

**Expected:** Ubah ke `.toFixed(2)`, lalu strip trailing zeros dari hasil akhir. Contoh: `1.50K` → `1.5K`, `1.25K` tetap `1.25K`, `10K` tetap `10K`.

#### C-FR-03: All Currency Values Use $ + K/M/B Format (ENHANCEMENT)

**Requirement:** Semua tampilan nilai mata uang di SELURUH website harus menggunakan prefix `$` + format K/M/B dengan maksimal 2 desimal.

**New format rules untuk `formatCost()`:**
- $0: `$0`
- < $1,000: tampilkan `$X.XX` dengan 2 desimal, strip trailing `.00` (e.g., `$12.34`, `$0.50`, `$12`)
- $1,000 – $999,999: format `$X.XXK`, strip trailing zero (e.g., `$1.25K` atau `$1.5K`)
- $1,000,000 – $999,999,999: format `$X.XXM`, strip trailing zero (e.g., `$1.5M`)
- ≥ $1,000,000,000: format `$X.XXB`, strip trailing zero (e.g., `$2.5B`)
- Non-finite values → `'$0'`

**✅ CLARIFIED (C-02, C-03):** Opsi B untuk keduanya — 2 desimal, strip trailing zeros. `$12.00` → `$12`, `$1.50K` → `$1.5K`.

**File yang perlu diubah:**

| Lokasi | File | Line(s) | Perubahan |
|--------|------|---------|-----------|
| `formatCost()` function | `costCalculator.ts` | 22-25 | Tambahkan logika K/M/B, preserve `$` prefix |
| Overview summary strip — cost | `Overview.tsx` | 236 | `` `$${overview.totalCost.toFixed(2)}` `` → `formatCost(overview.totalCost)` |
| SessionsList Cost column | `SessionsList.tsx` | 218 | `formatCost(s.cost)` — otomatis ter-update karena function berubah |
| SessionDetail cost card | `SessionDetail.tsx` | 276 | `formatCost(session.cost)` — otomatis ter-update |
| TopBar cost display | `TopBar.tsx` | 49, 159 | `formatCost(quickStats.totalCost)` — otomatis ter-update |
| Key Metrics Estimated Cost | `overviewDataProcessor.ts` | 265-267 | Sudah memiliki conditional `totalCost < 1000 ? formatCost(totalCost) : '$' + formatNumber(totalCost)` — logic ini tetap dipertahankan |
| CostChart tooltip | `CostChart.tsx` | 47 | `formatCost(...)` — otomatis ter-update |

---

## Non-Functional Requirements

- **NFR-01 (Consistency):** Semua chart di halaman Overview harus menggunakan styling tooltip yang konsisten — background dark (`#1c2128`), border `#30363d`, tanpa background putih default Recharts.
- **NFR-02 (Performance):** Lookup project name menggunakan `Map` atau object lookup (O(1)), bukan array `.find()` di dalam loop untuk menghindari O(n²). Build lookup map sekali di `useMemo`.
- **NFR-03 (Type Safety):** Semua perubahan harus lolos `tsc -b` (TypeScript strict mode). Import `formatNumber`/`formatCost` menggunakan `import { formatNumber, formatCost } from '../utils/costCalculator.ts'`.
- **NFR-04 (Backward Compatibility):** Perubahan `formatCost()` harus kompatibel dengan semua caller yang sudah ada — signature tidak berubah (`(value: number): string`).
- **NFR-05 (CSS Variables):** Styling chart axes harus menggunakan CSS variables (`var(--text-secondary)`, dll.) untuk konsistensi tema, bukan hardcoded color.

---

## Constraints

- **C-01:** Tidak boleh menambah dependency npm baru. Semua perubahan menggunakan library yang sudah ada (Recharts).
- **C-02:** `public/data/` di-gitignore — tidak boleh commit file JSON.
- **C-03:** Hanya file di `src/` yang perlu diubah untuk bug fixes dan formatting. Sync script (`scripts/sync-opencode-data.js`) **tidak perlu diubah** karena `projects.json` sudah tersedia dan struktur data sudah cukup.
- **C-04:** Tidak boleh mengubah struktur `sessions.json` atau file JSON lain yang dihasilkan sync script.
- **C-05:** TypeScript strict mode: `verbatimModuleSyntax: true`, `noUnusedLocals: true`. Import baru harus `import type` untuk type-only imports.

---

## Resolved Open Questions (User Clarification)

1. **✅ A-01 Chart axis style:** Gunakan rekomendasi — `var(--text-secondary)`, fontSize 11, rotate -45° untuk X-axis ModelUsageChart jika nama model > 15 karakter.

2. **✅ C-01 formatNumber() desimal:** Opsi B — maksimal 2 desimal, strip trailing zeros. `1.25K` tapi `1.5K` (bukan `1.50K`). Ubah `.toFixed(1)` → `.toFixed(2)` lalu strip trailing zeros.

3. **✅ C-02 formatCost() untuk nilai kecil (< $1,000):** Opsi B — `$X.XX`, strip `.00`. `$12` bukan `$12.00`, `$0.50` tetap.

4. **✅ C-03 formatCost() desimal untuk K/M/B:** Opsi B — 2 desimal, strip trailing zero. `$1.25K` atau `$1.5K`.

5. **✅ R-01 Resources page pricing:** Gunakan format `$0.00000250/Mt` — tetap seperti sekarang, tidak pakai K/M/B.

6. **✅ S-01 SessionDetail Project field:** Ya, ubah ke nama project. Konsisten dengan SessionList.

7. **✅ T-01 TokenCompositionChart:** Tidak perlu dicek — user sudah verifikasi manual dan aman.

---

Version: 2 | Author: analyst + user clarifications | Date: 2026-05-26
