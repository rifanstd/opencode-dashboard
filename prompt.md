**MODE MULTI-AGENT, GUNAKAN SKILL**

Saya mau ada beberapa penyesuaian untuk chart, format number, dan cards key metrics yang ada di halaman overview.

# Format Number
- Untuk semua angka atau number yang dimaksudkan sebagai jumlah sesuatu maka ditulis menggunakan satuan `K`, `M`, `B`, dan seterusnya. Contoh (1000 adalah 1K)
- Untuk satuan uang, maka desimal nya maksimal adalah 2 angka di belakang koma. Misal `$0.2345` menjadi `$0.23` atau `$0.24` sesuai aturan pembulatan

# CARDS Key Metrics
- Ubah urutan cards key metrics menjadi berikut : `Total Tokens`, `Input Tokens`, `Cache Miss`, `Cache Read`, `Output Tokens`, `Total Sessions`, `Providers`, `Models`, `Estimated Costs`

# CHART

## Hapus Chart
- Hapus semua section chart `Trends`, `Breakdowns`, dan juga `Recent Activity`.

## Buat Chart
1. Chart `Token Usage`
- Sumbu `x` adalah date atau timestamp
- Sumbu `y` adalah satuan jumlah token nya, ditulis menggunakan satuan `K`, `M`, `B`, dan seterusnya. Contoh (1000 adalah 1K)
- Saya mau ada filter untuk `Daily`, `Weekly`, `Monthly`, `Year`, dan `All`
- Saya mau garis chart nya juga ada untuk input token (cache miss + read), cache read, cache miss, dan output token dengan warna yang berbeda beda.
- Chart nya merupakan chart garis curva yang tidak tajam 
- Ada `legend` nya

2. Chart `Model Usage`
- Berbentuk bar chart
- Sumbu `x` adalah *4 Model yang paling sering digunakan*, jika kurang dari 4 maka tampilkan 3, jika kurang dari 3 maka tampilkan 2, dan seterusnya. Tidak boleh **melebihi 4**
- Sumbu `y` adalah jumlah token yang digunakan secara global di seluruh opencode, itulis menggunakan satuan `K`, `M`, `B`, dan seterusnya. Contoh (1000 adalah 1K)
- Setiap model akan punya warna tersendiri
- Ada `legend` nya

3. Chart `Cost`
- Berbentuk line chart tumpul tidak tajam
- Sumbu `x` adalah timestamp
- Sumbu `y` adalah cost yang ditulis menggunakan satuan `K`, `M`, `B`, dan seterusnya. Contoh (1000 adalah 1K)
- Saya mau ada filter untuk `Daily`, `Weekly`, `Monthly`, `Year`, dan `All`

**PASTIKAN CHART DAN KEY METRICS DATA NYA SESUAI (SYNCHRONIZE)**